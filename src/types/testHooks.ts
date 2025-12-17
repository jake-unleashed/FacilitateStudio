/**
 * Type definitions for development test hooks
 * These are only available when NODE_ENV === 'development'
 */

import type { SceneObject } from '../types';
import type { UndoRedoCommand } from '../hooks/undoRedo/types';

export interface TestHooks {
  // Stack queries
  getUndoStackSize: () => number;
  getRedoStackSize: () => number;
  getCurrentObjects: () => SceneObject[];
  canUndo: boolean;
  canRedo: boolean;

  // Command execution
  executeCommand: (command: UndoRedoCommand) => void;
  undo: () => void;
  redo: () => void;

  // Programmatic object movement
  moveObject: (objectId: string, x: number, z: number, description?: string) => UndoRedoCommand;
  testMove: (objectId: string, deltaX: number, deltaZ: number) => UndoRedoCommand;
}

declare global {
  interface Window {
    __testHooks?: TestHooks;
    programmaticTest?: {
      multiMove: (numMoves?: number) => Promise<unknown>;
      rapidMove: (numMoves?: number) => Promise<unknown>;
      verifyUndoRedo: () => Promise<unknown>;
      complexScenario: () => Promise<unknown>;
      fullSuite: () => Promise<{ results: unknown; allPassed: boolean }>;
      quick5: () => Promise<unknown>;
      quick10: () => Promise<unknown>;
      quick20: () => Promise<unknown>;
      quick50: () => Promise<unknown>;
    };
  }
}
