import { useEffect, useMemo, useRef } from 'react';

import {
  applyChildLocalTransform,
  applyChildWorldPosition,
  calculateChildWorldPosition,
  findChildByPathString,
} from '../../../utils/childTransformUtils';
import type { SceneObject, SimStep } from '../../../types';

export function useRecordingObjects({
  recordingPositionForStepId,
  steps,
  objects,
  latestRecordingEndPositionRef,
}: {
  recordingPositionForStepId?: string | null;
  steps: SimStep[];
  objects: SceneObject[];
  latestRecordingEndPositionRef?: React.MutableRefObject<{
    stepId: string;
    endPosition: { x: number; y: number; z: number } | null;
    endRotation?: { x: number; y: number; z: number };
    endScale?: { x: number; y: number; z: number };
  } | null>;
}): {
  recordingStep: SimStep | null;
  targetObjectId: string | null;
  targetObject: SceneObject | null;
  ghostObject: SceneObject | null;
  actualObject: SceneObject | null;
} {
  const latestEndPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const latestEndRotationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const latestEndScaleRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const recordingStep = useMemo(() => {
    if (!recordingPositionForStepId) return null;
    return steps.find((s) => s.id === recordingPositionForStepId) || null;
  }, [recordingPositionForStepId, steps]);

  const targetObjectId = recordingStep?.targetObjectId ?? null;
  const targetObject = useMemo(() => {
    if (!targetObjectId) return null;
    return objects.find((obj) => obj.id === targetObjectId) || null;
  }, [targetObjectId, objects]);

  const endPosX = recordingStep?.endPosition?.x;
  const endPosY = recordingStep?.endPosition?.y;
  const endPosZ = recordingStep?.endPosition?.z;
  const startPosX = recordingStep?.startPosition?.x;
  const startPosY = recordingStep?.startPosition?.y;
  const startPosZ = recordingStep?.startPosition?.z;
  const endRotX = recordingStep?.endRotation?.x;
  const endRotY = recordingStep?.endRotation?.y;
  const endRotZ = recordingStep?.endRotation?.z;
  const endScaleX = recordingStep?.endScale?.x;
  const endScaleY = recordingStep?.endScale?.y;
  const endScaleZ = recordingStep?.endScale?.z;

  useEffect(() => {
    latestEndPositionRef.current = recordingStep?.endPosition ?? null;
  }, [recordingStep?.endPosition]);

  useEffect(() => {
    latestEndRotationRef.current = recordingStep?.endRotation ?? null;
  }, [recordingStep?.endRotation]);

  useEffect(() => {
    latestEndScaleRef.current = recordingStep?.endScale ?? null;
  }, [recordingStep?.endScale]);

  const ghostObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;

    let startPos: { x: number; y: number; z: number };

    if (recordingStep.targetChildPath) {
      if (startPosX !== undefined && startPosY !== undefined && startPosZ !== undefined) {
        startPos = { x: startPosX, y: startPosY, z: startPosZ };
      } else {
        const childWorldPos = calculateChildWorldPosition(targetObject, recordingStep.targetChildPath);
        startPos = childWorldPos || {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        };
      }
    } else {
      startPos = {
        x: startPosX ?? targetObject.transform.x,
        y: startPosY ?? targetObject.transform.y,
        z: startPosZ ?? targetObject.transform.z,
      };
    }

    const editorRefPos =
      latestRecordingEndPositionRef?.current?.stepId === recordingStep.id
        ? latestRecordingEndPositionRef.current.endPosition
        : null;
    const localRefPos = latestEndPositionRef.current;
    const statePos =
      endPosX !== undefined || endPosY !== undefined || endPosZ !== undefined
        ? { x: endPosX ?? startPos.x, y: endPosY ?? startPos.y, z: endPosZ ?? startPos.z }
        : null;

    const ghostPos = editorRefPos || localRefPos || statePos || startPos;

    const baseChild = recordingStep.targetChildPath
      ? findChildByPathString(targetObject, recordingStep.targetChildPath)
      : null;
    const defaultRot = baseChild
      ? {
          x: baseChild.localTransform.rotationX,
          y: baseChild.localTransform.rotationY,
          z: baseChild.localTransform.rotationZ,
        }
      : {
          x: targetObject.transform.rotationX,
          y: targetObject.transform.rotationY,
          z: targetObject.transform.rotationZ,
        };
    const defaultScale = baseChild
      ? {
          x: baseChild.localTransform.scaleX,
          y: baseChild.localTransform.scaleY,
          z: baseChild.localTransform.scaleZ,
        }
      : {
          x: targetObject.transform.scaleX,
          y: targetObject.transform.scaleY,
          z: targetObject.transform.scaleZ,
        };

    const editorRefRot =
      latestRecordingEndPositionRef?.current?.stepId === recordingStep.id
        ? (latestRecordingEndPositionRef.current.endRotation ?? null)
        : null;
    const localRefRot = latestEndRotationRef.current;
    const stateRot =
      endRotX !== undefined || endRotY !== undefined || endRotZ !== undefined
        ? { x: endRotX ?? defaultRot.x, y: endRotY ?? defaultRot.y, z: endRotZ ?? defaultRot.z }
        : null;
    const ghostRot = editorRefRot || localRefRot || stateRot || defaultRot;

    const editorRefScale =
      latestRecordingEndPositionRef?.current?.stepId === recordingStep.id
        ? (latestRecordingEndPositionRef.current.endScale ?? null)
        : null;
    const localRefScale = latestEndScaleRef.current;
    const stateScale =
      endScaleX !== undefined || endScaleY !== undefined || endScaleZ !== undefined
        ? {
            x: endScaleX ?? defaultScale.x,
            y: endScaleY ?? defaultScale.y,
            z: endScaleZ ?? defaultScale.z,
          }
        : null;
    const ghostScale = editorRefScale || localRefScale || stateScale || defaultScale;

    if (recordingStep.targetChildPath) {
      const updatedForPos = applyChildWorldPosition(targetObject, recordingStep.targetChildPath, ghostPos);
      const updatedForRotScale =
        recordingStep.endRotation || recordingStep.endScale
          ? applyChildLocalTransform(updatedForPos ?? targetObject, recordingStep.targetChildPath, {
              rotationX: ghostRot.x,
              rotationY: ghostRot.y,
              rotationZ: ghostRot.z,
              scaleX: ghostScale.x,
              scaleY: ghostScale.y,
              scaleZ: ghostScale.z,
            })
          : updatedForPos;
      return updatedForRotScale ?? updatedForPos ?? targetObject;
    }

    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        x: ghostPos.x,
        y: ghostPos.y,
        z: ghostPos.z,
        rotationX: ghostRot.x,
        rotationY: ghostRot.y,
        rotationZ: ghostRot.z,
        scaleX: ghostScale.x,
        scaleY: ghostScale.y,
        scaleZ: ghostScale.z,
      },
    };
  }, [
    targetObject,
    recordingStep,
    endPosX,
    endPosY,
    endPosZ,
    startPosX,
    startPosY,
    startPosZ,
    endRotX,
    endRotY,
    endRotZ,
    endScaleX,
    endScaleY,
    endScaleZ,
    latestRecordingEndPositionRef,
  ]);

  const actualObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;

    if (recordingStep.targetChildPath) {
      const startPos =
        recordingStep.startPosition ??
        calculateChildWorldPosition(targetObject, recordingStep.targetChildPath) ?? {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        };

      const updated = applyChildWorldPosition(targetObject, recordingStep.targetChildPath, startPos);
      return updated ?? targetObject;
    }

    const startPos = recordingStep.startPosition || {
      x: targetObject.transform.x,
      y: targetObject.transform.y,
      z: targetObject.transform.z,
    };
    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        x: startPos.x,
        y: startPos.y,
        z: startPos.z,
      },
    };
  }, [targetObject, recordingStep]);

  return { recordingStep, targetObjectId, targetObject, ghostObject, actualObject };
}

