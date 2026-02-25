import React, { useEffect, useMemo } from 'react';
import CameraControlsImpl from 'camera-controls';
import { SimStep, SceneObject } from '../../types';
import { calculateChildWorldPosition, findChildByPathString } from '../../utils/childTransformUtils';
import { usePreviewMoveItemCamera } from './previewMoveItemStep/usePreviewMoveItemCamera';

interface PreviewIdentifyStepProps {
  step: SimStep;
  objects: SceneObject[];
  cameraControlsRef: React.RefObject<CameraControlsImpl>;
  isPositioningCameraRef?: React.MutableRefObject<boolean>;
  onComplete: () => void;
}

/**
 * Positions camera for identify steps using the same framing logic as move-item,
 * but without rendering any target outline.
 */
export const PreviewIdentifyStep: React.FC<PreviewIdentifyStepProps> = ({
  step,
  objects,
  cameraControlsRef,
  isPositioningCameraRef,
  onComplete,
}) => {
  const targetObject = useMemo(() => {
    if (!step.targetObjectId) return null;
    return objects.find((obj) => obj.id === step.targetObjectId) || null;
  }, [step.targetObjectId, objects]);

  const targetChild = useMemo(() => {
    if (!targetObject || !step.targetChildPath) return null;
    return findChildByPathString(targetObject, step.targetChildPath);
  }, [targetObject, step.targetChildPath]);

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

  const isValidStep = useMemo(() => {
    if (step.type !== 'identify' || !step.targetObjectId || !targetObject) return false;
    if (step.targetChildPath && !targetChild) return false;
    return true;
  }, [step, targetObject, targetChild]);

  usePreviewMoveItemCamera({
    step,
    isValidStep,
    targetObject,
    implicitStartPosition,
    cameraControlsRef,
    isPositioningCameraRef,
    isAnimating: false,
    distanceMultiplier: 1.6,
  });

  useEffect(() => {
    if (!isValidStep || !targetObject) onComplete();
  }, [isValidStep, targetObject, onComplete]);

  return null;
};
