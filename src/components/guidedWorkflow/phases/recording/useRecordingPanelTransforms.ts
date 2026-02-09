import { useCallback, useMemo } from 'react';

import type { SceneObject, SimStep } from '../../../../types';
import type { RotationAxis } from '../../../rightSidebar/types';
import { getRotationKey } from '../../../rightSidebar/utils';
import { calculateScaleAdjustedY, DEFAULT_MODEL_HEIGHT } from '../../../../utils/groundHeight';
import type { LatestRecordingEndTransformRefValue } from '../../../../hooks/editor/useRecordingEndTransform';
import {
  applyChildLocalTransform,
  applyChildWorldPosition,
  findChildByPathString,
} from '../../../../utils/childTransformUtils';

type Vec3 = { x: number; y: number; z: number };

function getLatestRecordedForStep(
  stepId: string,
  latestRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>
): LatestRecordingEndTransformRefValue | null {
  const latest = latestRef?.current ?? null;
  if (!latest) return null;
  return latest.stepId === stepId ? latest : null;
}

function getFallbackEndPos(step: SimStep, targetObject: SceneObject | null): Vec3 {
  return (
    step.endPosition ??
    step.startPosition ??
    (targetObject
      ? { x: targetObject.transform.x, y: targetObject.transform.y, z: targetObject.transform.z }
      : { x: 0, y: 0, z: 0 })
  );
}

export function useRecordingPanelTransforms({
  step,
  objects,
  onUpdateObject,
  latestRecordingEndPositionRef,
}: {
  step: SimStep;
  objects: SceneObject[];
  onUpdateObject: (obj: SceneObject) => void;
  latestRecordingEndPositionRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
}): {
  targetObject: SceneObject | null;
  ghostLikeObject: SceneObject | null;
  handleRotationChange: (axis: RotationAxis, rotation: number) => void;
  handleScaleChange: (scale: number) => void;
} {
  const targetObject = useMemo(
    () => (step.targetObjectId ? objects.find((o) => o.id === step.targetObjectId) ?? null : null),
    [objects, step.targetObjectId]
  );

  const targetChild = useMemo(
    () =>
      targetObject && step.targetChildPath ? findChildByPathString(targetObject, step.targetChildPath) : null,
    [step.targetChildPath, targetObject]
  );

  const defaultRot = useMemo(
    () =>
      targetChild
        ? {
            x: targetChild.localTransform.rotationX,
            y: targetChild.localTransform.rotationY,
            z: targetChild.localTransform.rotationZ,
          }
        : targetObject
          ? {
              x: targetObject.transform.rotationX,
              y: targetObject.transform.rotationY,
              z: targetObject.transform.rotationZ,
            }
          : { x: 0, y: 0, z: 0 },
    [targetChild, targetObject]
  );

  const defaultScale = useMemo(
    () =>
      targetChild
        ? {
            x: targetChild.localTransform.scaleX,
            y: targetChild.localTransform.scaleY,
            z: targetChild.localTransform.scaleZ,
          }
        : targetObject
          ? {
              x: targetObject.transform.scaleX,
              y: targetObject.transform.scaleY,
              z: targetObject.transform.scaleZ,
            }
          : { x: 1, y: 1, z: 1 },
    [targetChild, targetObject]
  );

  const currentEndRot = useMemo(() => step.endRotation ?? defaultRot, [defaultRot, step.endRotation]);
  const currentEndScale = useMemo(() => step.endScale ?? defaultScale, [defaultScale, step.endScale]);
  const currentEndPos = useMemo(() => getFallbackEndPos(step, targetObject), [step, targetObject]);

  const getBase = useCallback(() => {
    const latest = getLatestRecordedForStep(step.id, latestRecordingEndPositionRef);
    const basePos = latest?.endPosition ?? currentEndPos;
    const baseRot = latest?.endRotation ?? currentEndRot;
    const baseScale = latest?.endScale ?? currentEndScale;
    return { basePos, baseRot, baseScale };
  }, [currentEndPos, currentEndRot, currentEndScale, latestRecordingEndPositionRef, step.id]);

  const handleRotationChange = useCallback(
    (axis: RotationAxis, rotation: number) => {
      if (!targetObject) return;

      const { basePos, baseRot, baseScale } = getBase();
      const key = getRotationKey(axis);
      const rotField = key === 'rotationX' ? 'x' : key === 'rotationY' ? 'y' : 'z';
      const newRot = { ...baseRot, [rotField]: rotation };

      if (step.targetChildPath) {
        const baseForPos = applyChildWorldPosition(targetObject, step.targetChildPath, basePos) ?? targetObject;
        const updated = applyChildLocalTransform(baseForPos, step.targetChildPath, {
          rotationX: newRot.x,
          rotationY: newRot.y,
          rotationZ: newRot.z,
          scaleX: baseScale.x,
          scaleY: baseScale.y,
          scaleZ: baseScale.z,
        });
        onUpdateObject(updated ?? baseForPos);
        return;
      }

      onUpdateObject({
        ...targetObject,
        transform: {
          ...targetObject.transform,
          x: basePos.x,
          y: basePos.y,
          z: basePos.z,
          rotationX: newRot.x,
          rotationY: newRot.y,
          rotationZ: newRot.z,
          scaleX: baseScale.x,
          scaleY: baseScale.y,
          scaleZ: baseScale.z,
        },
      });
    },
    [getBase, onUpdateObject, step.targetChildPath, targetObject]
  );

  const handleScaleChange = useCallback(
    (scale: number) => {
      if (!targetObject) return;

      const { basePos, baseRot, baseScale } = getBase();

      if (step.targetChildPath) {
        const baseForPos = applyChildWorldPosition(targetObject, step.targetChildPath, basePos) ?? targetObject;
        const updated = applyChildLocalTransform(baseForPos, step.targetChildPath, {
          scaleX: scale,
          scaleY: scale,
          scaleZ: scale,
          rotationX: baseRot.x,
          rotationY: baseRot.y,
          rotationZ: baseRot.z,
        });
        onUpdateObject(updated ?? baseForPos);
        return;
      }

      const modelHeightRaw = targetObject.properties.modelHeight;
      const modelHeight = typeof modelHeightRaw === 'number' ? modelHeightRaw : DEFAULT_MODEL_HEIGHT;
      const newY = calculateScaleAdjustedY(basePos.y, baseScale.y, scale, modelHeight);

      onUpdateObject({
        ...targetObject,
        transform: {
          ...targetObject.transform,
          x: basePos.x,
          y: newY,
          z: basePos.z,
          rotationX: baseRot.x,
          rotationY: baseRot.y,
          rotationZ: baseRot.z,
          scaleX: scale,
          scaleY: scale,
          scaleZ: scale,
        },
      });
    },
    [getBase, onUpdateObject, step.targetChildPath, targetObject]
  );

  const ghostLikeObject = useMemo<SceneObject | null>(() => {
    if (!targetObject) return null;
    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        rotationX: currentEndRot.x,
        rotationY: currentEndRot.y,
        rotationZ: currentEndRot.z,
        scaleX: currentEndScale.x,
        scaleY: currentEndScale.y,
        scaleZ: currentEndScale.z,
      },
    };
  }, [currentEndRot, currentEndScale, targetObject]);

  return { targetObject, ghostLikeObject, handleRotationChange, handleScaleChange };
}

