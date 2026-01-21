import { useEffect } from 'react';
import type * as THREE from 'three';

import { FADE_IN_DURATION_MS } from './constants';

export function useImportedModelFadeIn({
  model,
  loading,
  error,
  setOpacity,
}: {
  model: THREE.Group | null;
  loading: boolean;
  error: string | null;
  setOpacity: React.Dispatch<React.SetStateAction<number>>;
}): void {
  useEffect(() => {
    if (!loading && !error && model) {
      let cancelled = false;
      const startTime = Date.now();

      const animate = () => {
        if (cancelled) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / FADE_IN_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        setOpacity(eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);

      return () => {
        cancelled = true;
      };
    }
  }, [loading, error, model, setOpacity]);
}

