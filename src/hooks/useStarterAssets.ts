import { useEffect, useState } from 'react';
import {
  fetchStarterAssets,
  type StarterAssetCatalogEntry,
  type StarterAssetType,
} from '../services/starterAssetService';

interface UseStarterAssetsResult {
  assets: StarterAssetCatalogEntry[];
  isLoading: boolean;
  error: string | null;
}

const cache = new Map<StarterAssetType, StarterAssetCatalogEntry[]>();
const inFlight = new Map<StarterAssetType, Promise<StarterAssetCatalogEntry[]>>();

async function loadStarterAssets(type: StarterAssetType): Promise<StarterAssetCatalogEntry[]> {
  const cached = cache.get(type);
  if (cached) return cached;

  const existing = inFlight.get(type);
  if (existing) return existing;

  const request = fetchStarterAssets(type)
    .then((assets) => {
      cache.set(type, assets);
      return assets;
    })
    .finally(() => {
      inFlight.delete(type);
    });

  inFlight.set(type, request);
  return request;
}

/**
 * Loads starter assets for a given type and memoizes the result across hook consumers.
 */
export function useStarterAssets(type: StarterAssetType): UseStarterAssetsResult {
  const [assets, setAssets] = useState<StarterAssetCatalogEntry[]>(() => cache.get(type) ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cache.has(type));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (cache.has(type)) {
      setAssets(cache.get(type) ?? []);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    loadStarterAssets(type)
      .then((loadedAssets) => {
        if (cancelled) return;
        setAssets(loadedAssets);
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setAssets([]);
        setIsLoading(false);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load starter assets.');
      });

    return () => {
      cancelled = true;
    };
  }, [type]);

  return { assets, isLoading, error };
}
