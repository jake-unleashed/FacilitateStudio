import { useEffect, type MutableRefObject } from 'react';
import type { SceneObject } from '../../types';
import type { UndoRedoCommand, UpdateObjectCommand } from '../undoRedo/types';

interface UseTestHooksArgs {
  objects: SceneObject[];
  canUndo: boolean;
  canRedo: boolean;
  executeCommand: (command: UndoRedoCommand) => void;
  undo: () => void;
  redo: () => void;
  undoStackSizeRef: MutableRefObject<number>;
  redoStackSizeRef: MutableRefObject<number>;
}

export function useTestHooks(args: UseTestHooksArgs): void {
  const {
    objects,
    canUndo,
    canRedo,
    executeCommand,
    undo,
    redo,
    undoStackSizeRef,
    redoStackSizeRef,
  } = args;

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const createMoveCommand = (
      objectId: string,
      x: number,
      z: number,
      description?: string
    ): UpdateObjectCommand => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj) throw new Error(`Object ${objectId} not found`);

      return {
        type: 'updateObject',
        timestamp: Date.now(),
        description: description || `Move to (${x.toFixed(1)}, ${z.toFixed(1)})`,
        objectId,
        previousState: obj,
        newState: { ...obj, transform: { ...obj.transform, x, z } },
      };
    };

    (window as Window).__testHooks = {
      getUndoStackSize: () => undoStackSizeRef.current,
      getRedoStackSize: () => redoStackSizeRef.current,
      getCurrentObjects: () => objects,
      canUndo,
      canRedo,
      executeCommand: (command: UndoRedoCommand) => executeCommand(command),
      undo,
      redo,
      moveObject: (objectId: string, x: number, z: number, description?: string) => {
        const command = createMoveCommand(objectId, x, z, description);
        executeCommand(command);
        return command;
      },
      testMove: (objectId: string, deltaX: number, deltaZ: number) => {
        const obj = objects.find((o) => o.id === objectId);
        if (!obj) throw new Error(`Object ${objectId} not found`);

        const command = createMoveCommand(
          objectId,
          obj.transform.x + deltaX,
          obj.transform.z + deltaZ,
          `Move by (${deltaX.toFixed(1)}, ${deltaZ.toFixed(1)})`
        );
        executeCommand(command);
        return command;
      },
    };

    return () => {
      delete window.__testHooks;
    };
  }, [objects, canUndo, canRedo, executeCommand, undo, redo, undoStackSizeRef, redoStackSizeRef]);
}
