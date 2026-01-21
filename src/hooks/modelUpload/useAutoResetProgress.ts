import { useEffect, useRef } from 'react';

import type { UploadProgress } from '../../types/model';

// Auto-reset delay: Time to show "Added to scene" message before resetting to "Upload 3D Model"
const AUTO_RESET_DELAY_MS = 2500;

export function useAutoResetProgress({
  stage,
  resetProgress,
}: {
  stage: UploadProgress['stage'];
  resetProgress: () => void;
}): void {
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    if (stage === 'complete') {
      resetTimeoutRef.current = setTimeout(() => {
        resetProgress();
        resetTimeoutRef.current = null;
      }, AUTO_RESET_DELAY_MS);
    }

    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [stage, resetProgress]);
}

