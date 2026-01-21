import { useCallback, useMemo } from 'react';
import type { SceneObject, SimStep } from '../../types';
import { parseSelectionId } from '../../types';
import { calculateChildWorldPosition, findChildByPathString } from '../../utils/childTransformUtils';

export interface MoveItemTargetArgs {
  step: SimStep;
  objects: SceneObject[];
  selectedObjectId?: string | null;
  targetObjectId: string;
  targetChildPath: string;
  setTargetObjectId: (id: string) => void;
  setTargetChildPath: (path: string) => void;
  createUpdatedStep: (overrides?: Partial<SimStep>) => SimStep;
  onUpdate: (updated: SimStep) => void;
  isRecordingPosition: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onFocusObject?: (object: SceneObject) => void;
}

export function useMoveItemTarget({
  step,
  objects,
  selectedObjectId,
  targetObjectId,
  targetChildPath,
  setTargetObjectId,
  setTargetChildPath,
  createUpdatedStep,
  onUpdate,
  isRecordingPosition,
  onStartRecording,
  onStopRecording,
  onFocusObject,
}: MoveItemTargetArgs): {
  effectiveTargetObjectId: string | undefined;
  effectiveTargetChildPath: string | undefined;
  targetObject: SceneObject | null;
  targetChild: ReturnType<typeof findChildByPathString> | null;
  canUseSelectedObject: boolean;
  handleUseSelectedObject: () => void;
  handleToggleRecording: () => void;
  handleRemoveTargetObject: () => void;
  handleFocusTargetObject: (targetObj: SceneObject) => void;
} {
  const effectiveTargetObjectId = targetObjectId || step.targetObjectId;
  const effectiveTargetChildPath = targetChildPath || step.targetChildPath;

  const targetObject = useMemo(() => {
    if (!effectiveTargetObjectId) return null;
    return objects.find((obj) => obj.id === effectiveTargetObjectId) ?? null;
  }, [effectiveTargetObjectId, objects]);

  const targetChild = useMemo(() => {
    if (!targetObject || !effectiveTargetChildPath) return null;
    return findChildByPathString(targetObject, effectiveTargetChildPath);
  }, [targetObject, effectiveTargetChildPath]);

  const hasSelectedObject = selectedObjectId !== null && selectedObjectId !== undefined;
  const canUseSelectedObject = hasSelectedObject && selectedObjectId !== effectiveTargetObjectId;

  const handleUseSelectedObject = useCallback(() => {
    if (!selectedObjectId) return;
    const parsed = parseSelectionId(selectedObjectId);
    if (!parsed) return;
    const selectedObject = objects.find((obj) => obj.id === parsed.objectId);
    if (!selectedObject) return;

    let startPosition: { x: number; y: number; z: number };
    let childPath: string | undefined;

    if (parsed.childPath) {
      const childWorldPos = calculateChildWorldPosition(selectedObject, parsed.childPath);
      if (childWorldPos) {
        startPosition = childWorldPos;
        childPath = parsed.childPath;
      } else {
        startPosition = {
          x: selectedObject.transform.x,
          y: selectedObject.transform.y,
          z: selectedObject.transform.z,
        };
      }
    } else {
      startPosition = {
        x: selectedObject.transform.x,
        y: selectedObject.transform.y,
        z: selectedObject.transform.z,
      };
    }

    setTargetObjectId(parsed.objectId);
    setTargetChildPath(childPath || '');

    onUpdate(
      createUpdatedStep({
        targetObjectId: parsed.objectId,
        targetChildPath: childPath,
        startPosition,
      })
    );
  }, [selectedObjectId, objects, setTargetObjectId, setTargetChildPath, onUpdate, createUpdatedStep]);

  const handleToggleRecording = useCallback(() => {
    if (isRecordingPosition) {
      onStopRecording?.();
    } else {
      onStartRecording?.();
    }
  }, [isRecordingPosition, onStartRecording, onStopRecording]);

  const handleRemoveTargetObject = useCallback(() => {
    setTargetObjectId('');
    setTargetChildPath('');
    onUpdate(
      createUpdatedStep({
        targetObjectId: undefined,
        targetChildPath: undefined,
        startPosition: undefined,
        endPosition: undefined,
        startRotation: undefined,
        endRotation: undefined,
        startScale: undefined,
        endScale: undefined,
      })
    );
  }, [setTargetObjectId, setTargetChildPath, createUpdatedStep, onUpdate]);

  const handleFocusTargetObject = useCallback(
    (targetObj: SceneObject) => {
      onFocusObject?.(targetObj);
    },
    [onFocusObject]
  );

  return {
    effectiveTargetObjectId,
    effectiveTargetChildPath,
    targetObject,
    targetChild,
    canUseSelectedObject,
    handleUseSelectedObject,
    handleToggleRecording,
    handleRemoveTargetObject,
    handleFocusTargetObject,
  };
}

