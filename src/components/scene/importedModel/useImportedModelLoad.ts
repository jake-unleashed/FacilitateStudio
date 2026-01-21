import { useEffect, useState } from 'react';
import type * as THREE from 'three';

import { getOrLoadModel } from '../../../utils/modelCache';

export function useImportedModelLoad({
  modelAssetId,
  isGhost,
  isActualReference,
}: {
  modelAssetId?: string;
  isGhost: boolean;
  isActualReference: boolean;
}): {
  model: THREE.Group | null;
  loading: boolean;
  error: string | null;
  modelHeight: number;
  opacity: number;
  setOpacity: React.Dispatch<React.SetStateAction<number>>;
} {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelHeight, setModelHeight] = useState<number>(0);

  // Start at opacity 1 - models should be visible immediately
  // Fade-in animation will temporarily reduce opacity if enabled
  // If isGhost is true, use ghost opacity (0.45 for draggable ghost, 0.2 for actual reference)
  const [opacity, setOpacity] = useState(isActualReference ? 0.2 : isGhost ? 0.45 : 1);

  useEffect(() => {
    if (!modelAssetId) {
      setError('No model asset ID provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reset opacity for new model load (respect isGhost prop)
    setOpacity(isGhost ? 0.45 : 0);

    getOrLoadModel(modelAssetId)
      .then(({ model: loadedModel, metrics }) => {
        if (cancelled) return;
        setModel(loadedModel);
        setModelHeight(metrics.size.y);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ImportedModel] Failed to load model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelAssetId, isGhost]);

  // If ghost mode flips after initial mount, sync default opacity immediately.
  useEffect(() => {
    if (isActualReference) {
      setOpacity(0.2);
      return;
    }
    if (isGhost) {
      setOpacity(0.45);
    }
  }, [isGhost, isActualReference]);

  return { model, loading, error, modelHeight, opacity, setOpacity };
}

