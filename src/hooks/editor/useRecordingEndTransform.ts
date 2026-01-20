import { useCallback, useEffect, useRef, useState } from 'react';
import type { SceneObject, SimStep } from '../../types';
import {
  applyChildWorldPosition,
  calculateChildWorldPosition,
  findChildByPathString,
} from '../../utils/childTransformUtils';
import {
  createUpdateObjectCommandHelper,
  createUpdateStepCommandHelper,
} from '../undoRedo/integration';
import type { UndoRedoCommand } from '../undoRedo/types';

export interface LatestRecordingEndTransformRefValue {
  stepId: string;
  endPosition: { x: number; y: number; z: number } | null;
  endRotation?: { x: number; y: number; z: number };
  endScale?: { x: number; y: number; z: number };
}

export interface UseRecordingEndTransformArgs {
  steps: SimStep[];
  /** Prefer this for “most up-to-date” step values */
  undoRedoSteps: SimStep[];
  objects: SceneObject[];

  beginBatch: () => void;
  endBatch: () => void;
  executeCommand: (command: UndoRedoCommand) => boolean;

  onSelectObject: (id: string | null) => void;
}

export interface UseRecordingEndTransformResult {
  recordingPositionForStepId: string | null;
  latestRecordingEndPositionRef: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
  handleStartRecordingPosition: (stepId: string) => void;
  handleStopRecordingPosition: () => void;
}

/**
 * useRecordingEndTransform
 *
 * Owns the move-item end-transform recording workflow:
 * - Start recording (batch, clear existing end transform, select target)
 * - Stop recording (persist end transform via undo command, restore object to start, end batch)
 *
 * The drag pipeline updates `latestRecordingEndPositionRef` synchronously (from EditorPage),
 * and this hook reads it when committing the final command.
 */
export function useRecordingEndTransform({
  steps,
  undoRedoSteps,
  objects,
  beginBatch,
  endBatch,
  executeCommand,
  onSelectObject,
}: UseRecordingEndTransformArgs): UseRecordingEndTransformResult {
  const [recordingPositionForStepId, setRecordingPositionForStepId] = useState<string | null>(null);

  // Updated synchronously during drag (source of truth when stopping).
  const latestRecordingEndPositionRef = useRef<LatestRecordingEndTransformRefValue | null>(null);

  // Track the initial step state when recording starts (for command previousState).
  const recordingInitialStepRef = useRef<SimStep | null>(null);

  const handleStartRecordingPosition = useCallback(
    (stepId: string) => {
      setRecordingPositionForStepId(stepId);

      // Clear the ref when starting a new recording session
      latestRecordingEndPositionRef.current = null;

      // Read from undoRedoSteps to get the most up-to-date step
      const recordingStep = undoRedoSteps.find((s) => s.id === stepId) || steps.find((s) => s.id === stepId);
      if (!recordingStep?.targetObjectId) return;

      // Clear endPosition when starting a new recording session so ghost starts at startPosition
      let initialStepForCommand = { ...recordingStep };

      // Start batch FIRST so the initial state is captured before we clear endPosition
      beginBatch();

      const hasExistingEndTransform =
        !!recordingStep.endPosition || !!recordingStep.endRotation || !!recordingStep.endScale;
      if (hasExistingEndTransform) {
        // Clear end transform fields and store the cleared version as initial state
        initialStepForCommand = {
          ...recordingStep,
          endPosition: undefined,
          endRotation: undefined,
          endScale: undefined,
        };

        const clearedStep: SimStep = {
          ...recordingStep,
          endPosition: undefined,
          endRotation: undefined,
          endScale: undefined,
        };

        const clearCommand = createUpdateStepCommandHelper(
          clearedStep.id,
          recordingStep,
          clearedStep,
          `Clear end transform for recording: ${clearedStep.title || 'Untitled'}`
        );
        executeCommand(clearCommand);
      }

      recordingInitialStepRef.current = initialStepForCommand;

      // If target is a child, create compound selection ID (matches parseSelectionId format)
      if (recordingStep.targetChildPath) {
        onSelectObject(`${recordingStep.targetObjectId}/${recordingStep.targetChildPath}`);
      } else {
        onSelectObject(recordingStep.targetObjectId);
      }
    },
    [beginBatch, executeCommand, onSelectObject, steps, undoRedoSteps]
  );

  const handleStopRecordingPosition = useCallback(() => {
    if (recordingPositionForStepId && recordingInitialStepRef.current) {
      const latestEndPos =
        latestRecordingEndPositionRef.current?.stepId === recordingPositionForStepId
          ? latestRecordingEndPositionRef.current.endPosition
          : null;
      const latestEndRot =
        latestRecordingEndPositionRef.current?.stepId === recordingPositionForStepId
          ? latestRecordingEndPositionRef.current.endRotation
          : undefined;
      const latestEndScale =
        latestRecordingEndPositionRef.current?.stepId === recordingPositionForStepId
          ? latestRecordingEndPositionRef.current.endScale
          : undefined;

      const currentStep = undoRedoSteps.find((s) => s.id === recordingPositionForStepId);

      if (currentStep && recordingInitialStepRef.current) {
        const endPosToSave = latestEndPos || currentStep.endPosition;
        const endRotToSave = latestEndRot ?? currentStep.endRotation;
        const endScaleToSave = latestEndScale ?? currentStep.endScale;

        if (endPosToSave || endRotToSave || endScaleToSave) {
          const updatedStep: SimStep = {
            ...currentStep,
            endPosition: endPosToSave
              ? { x: endPosToSave.x, y: endPosToSave.y, z: endPosToSave.z }
              : currentStep.startPosition
                ? { ...currentStep.startPosition }
                : currentStep.endPosition,
            endRotation: endRotToSave ? { ...endRotToSave } : currentStep.endRotation,
            endScale: endScaleToSave ? { ...endScaleToSave } : currentStep.endScale,
          };

          if (!updatedStep.endPosition) {
            // Inconsistent; bail out safely.
            recordingInitialStepRef.current = null;
            latestRecordingEndPositionRef.current = null;
            setRecordingPositionForStepId(null);
            endBatch();
            return;
          }

          const stepCommand = createUpdateStepCommandHelper(
            updatedStep.id,
            recordingInitialStepRef.current,
            updatedStep,
            `Set end transform: ${updatedStep.title || 'Untitled'}`
          );
          executeCommand(stepCommand);
        }
      }

      recordingInitialStepRef.current = null;
    }

    // Clear the ref when recording stops
    latestRecordingEndPositionRef.current = null;

    // Restore the actual object to its start position if it was moved during recording
    if (recordingPositionForStepId) {
      const recordingStep =
        undoRedoSteps.find((s) => s.id === recordingPositionForStepId) ||
        steps.find((s) => s.id === recordingPositionForStepId);

      if (recordingStep?.targetObjectId && recordingStep.startPosition) {
        const targetObject = objects.find((obj) => obj.id === recordingStep.targetObjectId);
        if (targetObject) {
          if (recordingStep.targetChildPath) {
            // Target is a child mesh - restore child's world position
            const currentChildWorldPos = calculateChildWorldPosition(
              targetObject,
              recordingStep.targetChildPath
            );
            const isAtStartPosition =
              currentChildWorldPos &&
              currentChildWorldPos.x === recordingStep.startPosition.x &&
              currentChildWorldPos.y === recordingStep.startPosition.y &&
              currentChildWorldPos.z === recordingStep.startPosition.z;

            if (!isAtStartPosition) {
              const restoredObject = applyChildWorldPosition(
                targetObject,
                recordingStep.targetChildPath,
                recordingStep.startPosition
              );
              if (restoredObject) {
                const previousObject = objects.find((obj) => obj.id === restoredObject.id);
                if (previousObject) {
                  const command = createUpdateObjectCommandHelper(
                    restoredObject.id,
                    previousObject,
                    restoredObject,
                    `Restore ${targetObject.name} / ${findChildByPathString(targetObject, recordingStep.targetChildPath)?.name || 'child'} to start position`
                  );
                  executeCommand(command);
                }
              }
            }
          } else {
            // Target is parent object - restore parent transform
            const isAtStartPosition =
              targetObject.transform.x === recordingStep.startPosition.x &&
              targetObject.transform.y === recordingStep.startPosition.y &&
              targetObject.transform.z === recordingStep.startPosition.z;

            if (!isAtStartPosition) {
              const restoredObject: SceneObject = {
                ...targetObject,
                transform: {
                  ...targetObject.transform,
                  x: recordingStep.startPosition.x,
                  y: recordingStep.startPosition.y,
                  z: recordingStep.startPosition.z,
                },
              };
              const previousObject = objects.find((obj) => obj.id === restoredObject.id);
              if (previousObject) {
                const command = createUpdateObjectCommandHelper(
                  restoredObject.id,
                  previousObject,
                  restoredObject,
                  `Restore ${restoredObject.name} to start position`
                );
                executeCommand(command);
              }
            }
          }
        }
      }
    }

    // Clear recording state BEFORE ending batch to ensure batch commits correctly
    setRecordingPositionForStepId(null);
    endBatch();
  }, [endBatch, executeCommand, objects, recordingPositionForStepId, steps, undoRedoSteps]);

  // Cleanup: if this component unmounts mid-recording, avoid leaving batching depth hanging.
  // (Best-effort: endBatch is idempotent in useUndoRedo.)
  useEffect(() => {
    return () => {
      if (recordingPositionForStepId) {
        latestRecordingEndPositionRef.current = null;
        recordingInitialStepRef.current = null;
        endBatch();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    recordingPositionForStepId,
    latestRecordingEndPositionRef,
    handleStartRecordingPosition,
    handleStopRecordingPosition,
  };
}

