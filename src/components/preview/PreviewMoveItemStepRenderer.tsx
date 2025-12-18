import React from 'react';
import { PreviewMoveItemStep } from './PreviewMoveItemStep';
import { SimStep, SceneObject } from '../../types';
import CameraControlsImpl from 'camera-controls';

interface PreviewMoveItemStepRendererProps {
  step: SimStep;
  objects: SceneObject[];
  cameraControlsRef: React.RefObject<CameraControlsImpl>;
  isPositioningCameraRef?: React.MutableRefObject<boolean>;
  shouldAnimate?: boolean;
  onPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
  onComplete?: () => void;
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
  onPositionUpdate,
  onComplete,
}) => {
  return (
    <PreviewMoveItemStep
      step={step}
      objects={objects}
      cameraControlsRef={cameraControlsRef}
      isPositioningCameraRef={isPositioningCameraRef}
      onComplete={onComplete || (() => {})}
      shouldAnimate={shouldAnimate}
      onPositionUpdate={onPositionUpdate}
    />
  );
};
