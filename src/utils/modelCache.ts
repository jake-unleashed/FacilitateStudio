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
import { getAsset, updateAssetMetadata, blobToBase64 } from './modelAssetStore';
import { loadAndPreprocessModel, PreprocessedModel } from './modelLoaders';

// =============================================================================
// Types
// =============================================================================

interface CachedModel {
  model: THREE.Object3D;
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
 * Returns a clone to prevent modifications to the cached version.
 *
 * @param assetId - The asset ID to load
 * @returns The model and its metrics
 * @throws Error if the asset doesn't exist or loading fails
 */
export async function getOrLoadModel(
  assetId: string
): Promise<{ model: THREE.Object3D; metrics: ModelMetrics }> {
  // Check cache first
  const cached = cache.get(assetId);
  if (cached) {
    cached.lastAccessed = Date.now();
    return {
      model: cached.model.clone(),
      metrics: cached.metrics,
    };
  }

  // Check if already loading (deduplicate concurrent requests)
  const pending = pendingLoads.get(assetId);
  if (pending) {
    const result = await pending.promise;
    return {
      model: result.model.clone(),
      metrics: result.metrics,
    };
  }

  // Start new load
  const loadPromise = loadModelInternal(assetId);
  pendingLoads.set(assetId, { promise: loadPromise });

  try {
    const result = await loadPromise;
    return {
      model: result.model.clone(),
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
  model: THREE.Object3D,
  metrics: ModelMetrics
): void {
  maybeCleanupCache();

  cache.set(assetId, {
    model: model.clone(), // Store a clone to prevent external modifications
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
 */
async function loadModelInternal(assetId: string): Promise<CachedModel> {
  const assetData = await getAsset(assetId);
  if (!assetData) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  // Convert blob to base64 for the loader
  const base64 = await blobToBase64(assetData.blob);

  // Load and preprocess the model
  const preprocessed = await loadAndPreprocessModel(
    base64,
    assetData.metadata.fileType
  );

  // Serialize metrics for storage (convert THREE.Vector3/Box3 to plain objects)
  const metrics = serializeMetrics(preprocessed.metrics);

  // Update stored metadata if metrics weren't present
  if (!assetData.metadata.metrics) {
    await updateAssetMetadata(assetId, { metrics });
  }

  // Cleanup if needed before adding to cache
  maybeCleanupCache();

  // Store in cache
  const cachedModel: CachedModel = {
    model: preprocessed.model,
    metrics,
    lastAccessed: Date.now(),
  };

  cache.set(assetId, cachedModel);
  return cachedModel;
}

/**
 * Serialize THREE.js metrics to plain JSON-serializable objects.
 */
function serializeMetrics(metrics: PreprocessedModel['metrics']): ModelMetrics {
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
  };
}

/**
 * Remove least recently used entries when cache exceeds threshold.
 */
function maybeCleanupCache(): void {
  if (cache.size < STORAGE_CONFIG.CACHE_CLEANUP_THRESHOLD) return;

  // Sort by last accessed (oldest first)
  const entries = Array.from(cache.entries()).sort(
    (a, b) => a[1].lastAccessed - b[1].lastAccessed
  );

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
function disposeModel(model: THREE.Object3D): void {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    // Dispose geometry
    child.geometry?.dispose();

    // Dispose materials and their textures
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

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
