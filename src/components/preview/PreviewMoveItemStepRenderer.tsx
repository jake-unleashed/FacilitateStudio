import React from 'react';
import { PreviewMoveItemStep } from './PreviewMoveItemStep';
import { SimStep, SceneObject } from '../../types';
import CameraControlsImpl from 'camera-controls';
import type { PreviewOutlineTarget } from './types';

interface PreviewMoveItemStepRendererProps {
  step: SimStep;
  objects: SceneObject[];
  cameraControlsRef: React.RefObject<CameraControlsImpl>;
  isPositioningCameraRef?: React.MutableRefObject<boolean>;
  shouldAnimate?: boolean;
  onTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  onComplete?: () => void;
  onPreviewOutlineTargetChange?: (target: PreviewOutlineTarget | null) => void;
}

/**
 * Wrapper component for PreviewMoveItemStep that handles callbacks.
 * Rendered inside Canvas/SceneContent.
 */
export const PreviewMoveItemStepRenderer: React.FC<PreviewMoveItemStepRendererProps> = ({
  step,
  objects,
  cameraControlsRef,
  isPositioningCameraRef,
  shouldAnimate = false,
  onTransformUpdate,
  onComplete,
  onPreviewOutlineTargetChange,
}) => {
  return (
    <PreviewMoveItemStep
      step={step}
      objects={objects}
      cameraControlsRef={cameraControlsRef}
      isPositioningCameraRef={isPositioningCameraRef}
      onComplete={onComplete || (() => {})}
      shouldAnimate={shouldAnimate}
      onTransformUpdate={(update, childPath) => {
        onTransformUpdate?.(update, childPath);
      }}
      onPreviewOutlineTargetChange={onPreviewOutlineTargetChange}
    />
  );
};
