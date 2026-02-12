/**
 * Model Cache
 *
 * In-memory cache for preprocessed THREE.Object3D models.
 * Prevents redundant model loading and preprocessing across components.
 *
 * Features:
 * - Deduplicates concurrent load requests for the same asset
 * - LRU eviction when cache exceeds threshold
 * - Proper Three.js resource disposal to prevent memory leaks
 */

import * as THREE from 'three';
import { ModelMetrics, STORAGE_CONFIG } from '../types/model';
import type { ModelFileType } from '../types/model';
import { getAsset, updateAssetMetadata, blobToArrayBuffer } from './modelAssetStore';
import { loadAndPreprocessModelFromArrayBuffer, PreprocessedModel } from './modelLoaders';
import { deepCloneGroup } from './deepCloneModel';
import { supabase } from '../lib/supabase';

type AssetResolverResult = { url: string; fileType: ModelFileType } | null;

let assetResolver:
  | ((assetId: string) => Promise<AssetResolverResult> | AssetResolverResult)
  | null = null;

/**
 * Provide an alternate asset resolution mechanism for cases where an `assetId` cannot be loaded
 * from IndexedDB / private cloud storage (e.g. public published viewer via `assetManifest` URLs).
 */
export function setAssetResolver(
  resolver: (assetId: string) => Promise<AssetResolverResult> | AssetResolverResult
): void {
  assetResolver = resolver;
}

/**
 * Clear any previously registered asset resolver.
 */
export function clearAssetResolver(): void {
  assetResolver = null;
}

// =============================================================================
// Types
// =============================================================================

interface CachedModel {
  model: THREE.Group;
  metrics: ModelMetrics;
  lastAccessed: number;
}

interface PendingLoad {
  promise: Promise<CachedModel>;
}

// =============================================================================
// Cache Storage
// =============================================================================

const cache = new Map<string, CachedModel>();
const pendingLoads = new Map<string, PendingLoad>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a model from cache, loading it if not present.
 * Returns a deep clone to ensure independent materials per instance.
 *
 * @param assetId - The asset ID to load
 * @returns The model and its metrics
 * @throws Error if the asset doesn't exist or loading fails
 */
export async function getOrLoadModel(
  assetId: string
): Promise<{ model: THREE.Group; metrics: ModelMetrics }> {
  // Check cache first
  const cached = cache.get(assetId);
  if (cached) {
    cached.lastAccessed = Date.now();
    // Deep clone ensures independent materials for opacity/emissive modifications
    const clonedModel = deepCloneGroup(cached.model);
    return {
      model: clonedModel,
      metrics: cached.metrics,
    };
  }

  // Check if already loading (deduplicate concurrent requests)
  const pending = pendingLoads.get(assetId);
  if (pending) {
    const result = await pending.promise;
    return {
      model: deepCloneGroup(result.model),
      metrics: result.metrics,
    };
  }

  // Start new load
  const loadPromise = loadModelInternal(assetId);
  pendingLoads.set(assetId, { promise: loadPromise });

  try {
    const result = await loadPromise;
    return {
      model: deepCloneGroup(result.model),
      metrics: result.metrics,
    };
  } finally {
    pendingLoads.delete(assetId);
  }
}

/**
 * Cache a preprocessed model directly.
 * Used during upload to avoid reprocessing.
 *
 * @param assetId - The asset ID
 * @param model - The preprocessed model
 * @param metrics - The computed metrics
 */
export function cachePreprocessedModel(
  assetId: string,
  model: THREE.Group,
  metrics: ModelMetrics
): void {
  maybeCleanupCache();

  cache.set(assetId, {
    // Deep clone ensures cached model is independent from uploaded instance
    model: deepCloneGroup(model),
    metrics,
    lastAccessed: Date.now(),
  });
}

/**
 * Preload a model into cache.
 * Useful for preloading assets the user is likely to use.
 */
export async function preloadModel(assetId: string): Promise<void> {
  try {
    await getOrLoadModel(assetId);
  } catch (error) {
    console.warn(`[modelCache] Failed to preload ${assetId}:`, error);
  }
}

/**
 * Check if a model is in cache.
 */
export function isModelCached(assetId: string): boolean {
  return cache.has(assetId);
}

/**
 * Remove a model from cache and dispose its resources.
 */
export function removeFromCache(assetId: string): void {
  const cached = cache.get(assetId);
  if (cached) {
    disposeModel(cached.model);
    cache.delete(assetId);
  }
}

/**
 * Clear all cached models and dispose their resources.
 */
export function clearCache(): void {
  for (const cached of cache.values()) {
    disposeModel(cached.model);
  }
  cache.clear();
  pendingLoads.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: cache.size,
    maxSize: STORAGE_CONFIG.MAX_CACHE_SIZE,
  };
}

// =============================================================================
// Internal Functions
// =============================================================================

/**
 * Load a model from IndexedDB and cache it.
 * Uses ArrayBuffer-based loading for proper embedded texture support.
 */
async function loadModelInternal(assetId: string): Promise<CachedModel> {
  // Prefer session-based lookup to avoid any network roundtrip during model loads.
  // (We only need a best-effort user id for cloud fallback.)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    console.warn('[modelCache] Failed to resolve current session for cloud fallback:', sessionError);
  }
  const userId = session?.user?.id;

  const assetData = await getAsset(assetId, userId ? { userId } : undefined);
  if (!assetData) {
    if (!assetResolver) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const resolved = await assetResolver(assetId);
    if (!resolved) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const response = await fetch(resolved.url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch model from URL (${response.status} ${response.statusText})`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const preprocessed = await loadAndPreprocessModelFromArrayBuffer(arrayBuffer, resolved.fileType);
    const metrics = serializeMetrics(preprocessed.metrics, preprocessed.originalScale);

    maybeCleanupCache();

    const cachedModel: CachedModel = {
      model: deepCloneGroup(preprocessed.model),
      metrics,
      lastAccessed: Date.now(),
    };

    cache.set(assetId, cachedModel);
    return cachedModel;
  }

  // Convert blob to ArrayBuffer (more efficient than base64, better texture handling)
  const arrayBuffer = await blobToArrayBuffer(assetData.blob);

  // Load and preprocess the model using ArrayBuffer-based parsing
  // This ensures embedded textures in GLB/FBX are properly extracted
  const preprocessed = await loadAndPreprocessModelFromArrayBuffer(
    arrayBuffer,
    assetData.metadata.fileType
  );

  // Serialize metrics for storage (convert THREE.Vector3/Box3 to plain objects)
  // Include originalScale from preprocessing to track the normalization factor
  const metrics = serializeMetrics(preprocessed.metrics, preprocessed.originalScale);

  // Update stored metadata if metrics weren't present
  if (!assetData.metadata.metrics) {
    await updateAssetMetadata(assetId, { metrics });
  }

  // Cleanup if needed before adding to cache
  maybeCleanupCache();

  // Store in cache - deep clone to ensure cache is independent
  // (consistent with cachePreprocessedModel behavior)
  const cachedModel: CachedModel = {
    model: deepCloneGroup(preprocessed.model),
    metrics,
    lastAccessed: Date.now(),
  };

  cache.set(assetId, cachedModel);
  return cachedModel;
}

/**
 * Serialize THREE.js metrics to plain JSON-serializable objects.
 *
 * @param metrics - The metrics from preprocessing (may contain THREE.js Vector3/Box3)
 * @param originalScale - The scale factor applied during preprocessing to normalize the model
 */
function serializeMetrics(
  metrics: PreprocessedModel['metrics'],
  originalScale?: number
): ModelMetrics {
  return {
    boundingBox: {
      min: {
        x: metrics.boundingBox.min.x,
        y: metrics.boundingBox.min.y,
        z: metrics.boundingBox.min.z,
      },
      max: {
        x: metrics.boundingBox.max.x,
        y: metrics.boundingBox.max.y,
        z: metrics.boundingBox.max.z,
      },
    },
    center: {
      x: metrics.center.x,
      y: metrics.center.y,
      z: metrics.center.z,
    },
    size: {
      x: metrics.size.x,
      y: metrics.size.y,
      z: metrics.size.z,
    },
    bottomY: metrics.bottomY,
    topY: metrics.topY,
    maxDimension: metrics.maxDimension,
    triangleCount: metrics.triangleCount,
    originalScale,
  };
}

/**
 * Remove least recently used entries when cache exceeds threshold.
 */
function maybeCleanupCache(): void {
  if (cache.size < STORAGE_CONFIG.CACHE_CLEANUP_THRESHOLD) return;

  // Sort by last accessed (oldest first)
  const entries = Array.from(cache.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

  // Remove oldest entries
  const toRemove = cache.size - STORAGE_CONFIG.CACHE_CLEANUP_THRESHOLD + 5;
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    const [id, cached] = entries[i];
    disposeModel(cached.model);
    cache.delete(id);
  }

  console.log(`[modelCache] Evicted ${toRemove} models (LRU)`);
}

/**
 * Properly dispose of a Three.js model to free GPU memory.
 */
function disposeModel(model: THREE.Group): void {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    // Dispose geometry
    child.geometry?.dispose();

    // Dispose materials and their textures
    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (!material) continue;

      // Dispose common texture maps
      const textureProps = [
        'map',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'emissiveMap',
        'lightMap',
        'bumpMap',
        'displacementMap',
        'alphaMap',
        'envMap',
      ] as const;

      for (const prop of textureProps) {
        const texture = (material as Record<string, unknown>)[prop];
        if (texture instanceof THREE.Texture) {
          texture.dispose();
        }
      }

      material.dispose();
    }
  });
}
