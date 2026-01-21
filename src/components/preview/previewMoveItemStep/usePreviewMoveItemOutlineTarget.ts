import { useEffect } from 'react';
import type { PreviewOutlineTarget } from '../types';
import type { SimStep } from '../../../types';

export function usePreviewMoveItemOutlineTarget(args: {
  step: SimStep;
  isValidStep: boolean;
  shouldShowOutline: boolean;
  invalidate: () => void;
  onPreviewOutlineTargetChange?: (target: PreviewOutlineTarget | null) => void;
}): void {
  const { step, isValidStep, shouldShowOutline, invalidate, onPreviewOutlineTargetChange } = args;

  useEffect(() => {
    if (!onPreviewOutlineTargetChange) return;
    if (!step.targetObjectId || !isValidStep) {
      onPreviewOutlineTargetChange(null);
      invalidate();
      return;
    }

    if (shouldShowOutline) {
      onPreviewOutlineTargetChange({
        objectId: step.targetObjectId,
        childPath: step.targetChildPath ?? null,
      });
      invalidate();
    } else {
      onPreviewOutlineTargetChange(null);
      invalidate();
    }

    return () => {
      onPreviewOutlineTargetChange(null);
      invalidate();
    };
  }, [
    onPreviewOutlineTargetChange,
    isValidStep,
    shouldShowOutline,
    step.targetObjectId,
    step.targetChildPath,
    invalidate,
  ]);
}

