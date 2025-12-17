import { SceneObject, SimStep } from '../../types';

/**
 * Represents the complete editor state that can be undone/redone.
 */
export interface EditorState {
  objects: SceneObject[];
  steps: SimStep[];
  simulationTitle: string;
}

/**
 * Base interface for all undo/redo commands.
 */
export interface BaseCommand {
  /** Unique identifier for the command type */
  type: string;
  /** Timestamp when the command was created */
  timestamp: number;
  /** Optional human-readable description (for future UI features) */
  description?: string;
}

/**
 * Command for updating an existing object's properties or transform.
 */
export interface UpdateObjectCommand extends BaseCommand {
  type: 'updateObject';
  /** ID of the object being updated */
  objectId: string;
  /** Previous state of the object (for undo) */
  previousState: SceneObject;
  /** New state of the object (for redo) */
  newState: SceneObject;
}

/**
 * Command for deleting an object.
 */
export interface DeleteObjectCommand extends BaseCommand {
  type: 'deleteObject';
  /** The object that was deleted (for undo) */
  deletedObject: SceneObject;
  /** Index where the object was in the array (for undo) */
  index: number;
}

/**
 * Command for creating a new object.
 */
export interface CreateObjectCommand extends BaseCommand {
  type: 'createObject';
  /** The newly created object */
  createdObject: SceneObject;
  /** Index where the object was added */
  index: number;
}

/**
 * Command for updating the simulation title.
 */
export interface UpdateTitleCommand extends BaseCommand {
  type: 'updateTitle';
  /** Previous title (for undo) */
  previousTitle: string;
  /** New title (for redo) */
  newTitle: string;
}

/**
 * Command for creating a new step.
 */
export interface CreateStepCommand extends BaseCommand {
  type: 'createStep';
  /** The newly created step */
  createdStep: SimStep;
  /** Index where the step was added */
  index: number;
}

/**
 * Command that groups multiple commands into a single undo entry.
 * Used for operations like dragging, where many updates should be one undo.
 */
export interface BatchCommand extends BaseCommand {
  type: 'batch';
  /** Array of commands to execute/undo together */
  commands: UndoRedoCommand[];
}

/**
 * Discriminated union of all possible command types.
 */
export type UndoRedoCommand =
  | UpdateObjectCommand
  | DeleteObjectCommand
  | CreateObjectCommand
  | UpdateTitleCommand
  | CreateStepCommand
  | BatchCommand;

/**
 * Options for the undo/redo system.
 */
export interface UndoRedoOptions {
  /** Maximum number of operations to keep in history (default: 50) */
  maxHistory?: number;
  /** Whether to enable keyboard shortcuts (default: true) */
  enableKeyboardShortcuts?: boolean;
}

/**
 * Result of executing a command.
 */
export interface CommandExecutionResult {
  /** The new editor state after command execution */
  newState: EditorState;
  /** Whether the command was successfully executed */
  success: boolean;
  /** Optional error message if execution failed */
  error?: string;
}
