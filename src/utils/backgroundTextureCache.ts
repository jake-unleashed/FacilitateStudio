import * as THREE from 'three';
import { logger } from './logger';

/**
 * Module-level cache for 360 background textures.
 *
 * Keyed by the URL pathname (origin + path, without query params) so that
 * different signed-URL rotations for the same Supabase storage object resolve
 * to the same cache entry. This lets the texture survive across page
 * navigations (Editor -> Preview -> Editor) without a re-download.
 */

interface CacheEntry {
  texture: THREE.Texture | null;
  loadPromise: Promise<THREE.Texture>;
  lastAccessedAt: number;
}

const MAX_CACHED_BACKGROUND_TEXTURES = 8;
const cache = new Map<string, CacheEntry>();
const warnedLoadFailures = new Set<string>();

/**
 * Returns the canonical cache key for a background texture URL.
 *
 * We intentionally drop query params so that rotating signed URLs for the same storage object
 * still hit the same in-memory texture across Editor/Preview/Published route transitions.
 */
export function getBackgroundTextureCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

function maybeEvictOldTextures(): void {
  const target = MAX_CACHED_BACKGROUND_TEXTURES;
  if (cache.size <= target) return;

  // Only evict fully-loaded textures. Keeping in-flight loads avoids weird edge cases where
  // a caller awaits a Promise that resolves to a texture we immediately dispose.
  const evictable: Array<{ key: string; entry: CacheEntry }> = [];
  for (const [key, entry] of cache.entries()) {
    if (entry.texture) {
      evictable.push({ key, entry });
    }
  }
  if (evictable.length === 0) return;

  evictable.sort((a, b) => a.entry.lastAccessedAt - b.entry.lastAccessedAt);
  for (const { key, entry } of evictable) {
    if (cache.size <= target) break;
    entry.texture?.dispose();
    cache.delete(key);
  }
}

function touchEntry(entry: CacheEntry): void {
  entry.lastAccessedAt = Date.now();
}

function warnLoadFailureOnce(key: string, error: unknown): void {
  if (warnedLoadFailures.has(key)) return;
  warnedLoadFailures.add(key);
  logger.warn('[backgroundTextureCache] Failed to load background texture:', key, error);
}

/** Returns a cached texture instance if available. */
export function getCachedBackgroundTexture(imageUrl: string): THREE.Texture | null {
  const entry = cache.get(getBackgroundTextureCacheKey(imageUrl));
  if (!entry?.texture) return null;
  touchEntry(entry);
  return entry.texture;
}

/** Returns true if a fully-loaded cached texture is available for the URL. */
export function hasCachedBackgroundTexture(imageUrl: string | undefined | null): boolean {
  if (!imageUrl) return false;
  return getCachedBackgroundTexture(imageUrl) !== null;
}

/**
 * Loads the background texture (deduped by cache key).
 * If already in-flight or loaded, returns the existing Promise.
 */
export function loadBackgroundTexture(imageUrl: string): Promise<THREE.Texture> {
  const key = getBackgroundTextureCacheKey(imageUrl);
  const existing = cache.get(key);
  if (existing) {
    touchEntry(existing);
    return existing.loadPromise;
  }

  const now = Date.now();
  let resolvePromise: (texture: THREE.Texture) => void;
  let rejectPromise: (error: unknown) => void;

  const loadPromise = new Promise<THREE.Texture>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  // Important: register the entry before starting the load, so even if a loader
  // invokes callbacks synchronously (e.g. from a warm cache), we still populate
  // the cache correctly.
  const entry: CacheEntry = { texture: null, loadPromise, lastAccessedAt: now };
  cache.set(key, entry);

  const loader = new THREE.TextureLoader();
  loader.load(
    imageUrl,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const cached = cache.get(key);
      if (cached) {
        cached.texture = texture;
        touchEntry(cached);
      }
      maybeEvictOldTextures();
      resolvePromise(texture);
    },
    undefined,
    (err) => {
      cache.delete(key);
      warnLoadFailureOnce(key, err);
      rejectPromise(err);
    }
  );

  return loadPromise;
}

/**
 * Best-effort preloading to overlap the texture download with app/page initialization.
 * Callers should not await this; failures are logged and do not throw.
 */
export function preloadBackgroundTexture(imageUrl: string | undefined | null): void {
  if (!imageUrl) return;
  loadBackgroundTexture(imageUrl).catch(() => undefined);
}

/** Clears and disposes all cached textures (useful for tests). */
export function clearBackgroundTextureCache(): void {
  for (const entry of cache.values()) {
    entry.texture?.dispose();
  }
  cache.clear();
  warnedLoadFailures.clear();
}
