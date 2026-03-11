import { useEffect, useRef } from 'react';
import type { StarterAssetCatalogEntry } from '../services/starterAssetService';
import { preloadModel } from '../utils/modelCache';
import { ensureStarterAssetCached } from '../utils/starterAssets/ensureStarterAssetCached';
import { logger } from '../utils/logger';

const PRELOAD_CONCURRENCY = 2;
const PRELOAD_START_DELAY_MS = 300;

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
    const modelStatus = modelStatusRef.current;
    let cancelled = false;
    let hasStarted = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;
    const pendingModels = starterModelAssets.filter((asset) => {
      if (asset.type !== 'model') return false;
      return !modelStatus.has(asset.id);
    });

    if (pendingModels.length === 0) return;

    for (const asset of pendingModels) {
      modelStatus.set(asset.id, 'loading');
    }

    const startPreload = () => {
      if (cancelled) return;
      hasStarted = true;

      void preloadInBatches(pendingModels, PRELOAD_CONCURRENCY, async (asset) => {
        try {
          await ensureStarterAssetCached(asset);
          await preloadModel(asset.id);
          if (cancelled) return;
          modelStatus.set(asset.id, 'loaded');
        } catch (error) {
          if (cancelled) return;
          modelStatus.delete(asset.id);
          logger.warn('[usePreloadStarterAssets] Failed to preload starter model:', asset.id, error);
        }
      });
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(() => {
        startPreload();
      }, { timeout: PRELOAD_START_DELAY_MS });
    } else {
      timeoutId = setTimeout(() => {
        startPreload();
      }, PRELOAD_START_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (!hasStarted) {
        for (const asset of pendingModels) {
          if (modelStatus.get(asset.id) === 'loading') {
            modelStatus.delete(asset.id);
          }
        }
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (
        idleCallbackId !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [starterModelAssets]);
}
