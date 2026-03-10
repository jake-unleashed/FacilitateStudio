import { useEffect, useRef } from 'react';
import type { StarterAssetCatalogEntry } from '../services/starterAssetService';
import { preloadModel } from '../utils/modelCache';
import { ensureStarterAssetCached } from '../utils/starterAssets/ensureStarterAssetCached';

/**
 * Preloads starter models into local storage and the in-memory model cache so first use feels instant.
 *
 * The hook is intentionally model-only. Starter backgrounds are warmed on hover/focus in the scene panel
 * to avoid preloading several large panoramic textures at once.
 */
async function preloadInBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  let currentIndex = 0;
  const runWorker = async () => {
    while (currentIndex < items.length) {
      const nextIndex = currentIndex;
      currentIndex += 1;
      await worker(items[nextIndex]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
}

export function usePreloadStarterAssets(starterModelAssets: StarterAssetCatalogEntry[]): void {
  const modelStatusRef = useRef(new Map<string, 'loading' | 'loaded'>());

  useEffect(() => {
    let cancelled = false;
    const pendingModels = starterModelAssets.filter((asset) => {
      if (asset.type !== 'model') return false;
      return !modelStatusRef.current.has(asset.id);
    });

    if (pendingModels.length === 0) return;

    for (const asset of pendingModels) {
      modelStatusRef.current.set(asset.id, 'loading');
    }

    void preloadInBatches(pendingModels, 2, async (asset) => {
      try {
        await ensureStarterAssetCached(asset);
        await preloadModel(asset.id);
        if (cancelled) return;
        modelStatusRef.current.set(asset.id, 'loaded');
      } catch (error) {
        if (cancelled) return;
        modelStatusRef.current.delete(asset.id);
        console.warn('[usePreloadStarterAssets] Failed to preload starter model:', asset.id, error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [starterModelAssets]);
}
