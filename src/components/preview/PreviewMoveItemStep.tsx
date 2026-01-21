import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { SimStep, SceneObject } from '../../types';
import {
  calculateChildWorldPosition,
  findChildByPathString,
} from '../../utils/childTransformUtils';
import type { PreviewOutlineTarget } from './types';
import { usePreviewMoveItemAnimation } from './previewMoveItemStep/usePreviewMoveItemAnimation';
import { usePreviewMoveItemCamera } from './previewMoveItemStep/usePreviewMoveItemCamera';
import { usePreviewMoveItemOutlineTarget } from './previewMoveItemStep/usePreviewMoveItemOutlineTarget';

interface PreviewMoveItemStepProps {
  step: SimStep;
  objects: SceneObject[];
  cameraControlsRef: React.RefObject<CameraControlsImpl>;
  isPositioningCameraRef?: React.MutableRefObject<boolean>;
  onComplete: () => void;
  /** Trigger animation when object is clicked */
  shouldAnimate?: boolean;
  /** Callback when animation starts */
  onAnimationStart?: () => void;
  /** Callback when object transform changes during animation */
  onTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  /**
   * Callback to control which object/child is outlined in preview mode.
   * Used to drive postprocessing silhouette outlines without coupling to editor selection state.
   */
  onPreviewOutlineTargetChange?: (target: PreviewOutlineTarget | null) => void;
}

/**
 * Manages move-item step execution in preview mode.
 * Shows pulsing outline, handles click, animates object movement.
 */
export const PreviewMoveItemStep: React.FC<PreviewMoveItemStepProps> = ({
  step,
  objects,
  cameraControlsRef,
  isPositioningCameraRef,
  onComplete,
  shouldAnimate = false,
  onAnimationStart,
  onTransformUpdate,
  onPreviewOutlineTargetChange,
}) => {
  const { invalidate } = useThree();

  // Find target object
  const targetObject = useMemo(() => {
    if (!step.targetObjectId) return null;
    return objects.find((obj) => obj.id === step.targetObjectId) || null;
  }, [step.targetObjectId, objects]);

  // Find target child if applicable
  const targetChild = useMemo(() => {
    if (!targetObject || !step.targetChildPath) return null;
    return findChildByPathString(targetObject, step.targetChildPath);
  }, [targetObject, step.targetChildPath]);

  /**
   * Implicit start position:
   * - If step.startPosition is provided, use it (backwards compatible)
   * - Otherwise, use the object's current position at the moment the step runs
   *   (for child targets: use the child's world position)
   */
  const implicitStartPosition = useMemo(() => {
    if (!targetObject) return null;

    if (step.targetChildPath) {
      return (
        calculateChildWorldPosition(targetObject, step.targetChildPath) ?? {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        }
      );
    }

    return {
      x: targetObject.transform.x,
      y: targetObject.transform.y,
      z: targetObject.transform.z,
    };
  }, [targetObject, step.targetChildPath]);

  /**
   * Implicit start rotation/scale:
   * - If startRotation/startScale are provided, use them (backwards compatible)
   * - Otherwise, use the target's current local rotation/scale at the moment the step runs
   */
  const implicitStartRotationScale = useMemo(() => {
    if (!targetObject) return null;

    if (step.targetChildPath) {
      const child = targetChild;
      if (!child) return null;
      return {
        rotation: {
          x: child.localTransform.rotationX,
          y: child.localTransform.rotationY,
          z: child.localTransform.rotationZ,
        },
        scale: {
          x: child.localTransform.scaleX,
          y: child.localTransform.scaleY,
          z: child.localTransform.scaleZ,
        },
      };
    }

    return {
      rotation: {
        x: targetObject.transform.rotationX,
        y: targetObject.transform.rotationY,
        z: targetObject.transform.rotationZ,
      },
      scale: {
        x: targetObject.transform.scaleX,
        y: targetObject.transform.scaleY,
        z: targetObject.transform.scaleZ,
      },
    };
  }, [targetObject, targetChild, step.targetChildPath]);

  // Validate step has required data
  const isValidStep = useMemo(() => {
    if (step.type !== 'move-item' || !step.targetObjectId || !targetObject) {
      return false;
    }
    const hasEndTransform = !!step.endPosition || !!step.endRotation || !!step.endScale;
    if (!hasEndTransform) return false;
    // If targetChildPath is specified, validate that child exists
    if (step.targetChildPath && !targetChild) {
      return false;
    }
    return true;
  }, [step, targetObject, targetChild]);

  const { isAnimating } = usePreviewMoveItemAnimation({
    step,
    targetObject,
    isValidStep,
    shouldAnimate,
    implicitStartPosition,
    implicitStartRotationScale,
    onComplete,
    onAnimationStart,
    onTransformUpdate,
  });

  const { showOutline } = usePreviewMoveItemCamera({
    step,
    isValidStep,
    targetObject,
    implicitStartPosition,
    cameraControlsRef,
    isPositioningCameraRef,
    isAnimating,
  });

  useEffect(() => {
    if (!isValidStep || !targetObject) onComplete();
  }, [isValidStep, targetObject, onComplete]);

  // Render outline around target object - only show after camera settles, and before object is clicked
  // Hide outline immediately when clicked, before animation starts
  const shouldShowOutline = isValidStep && showOutline && !shouldAnimate && !isAnimating;

  usePreviewMoveItemOutlineTarget({
    step,
    isValidStep,
    shouldShowOutline,
    invalidate,
    onPreviewOutlineTargetChange,
  });

  // No in-canvas geometry outline here: preview outlines are now driven via postprocessing
  // selection outlines in MainCanvas (silhouette-based, works for uploaded models).
  return null;
};
