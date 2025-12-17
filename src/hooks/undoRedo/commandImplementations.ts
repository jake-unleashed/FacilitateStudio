import {
  EditorState,
  UndoRedoCommand,
  UpdateObjectCommand,
  DeleteObjectCommand,
  CreateObjectCommand,
  UpdateTitleCommand,
  BatchCommand,
  CommandExecutionResult,
} from './types';
import { SceneObject } from '../../types';

/**
 * Executes a command and returns the new state.
 */
export function executeCommand(
  command: UndoRedoCommand,
  currentState: EditorState
): CommandExecutionResult {
  try {
    switch (command.type) {
      case 'updateObject':
        return executeUpdateObject(command, currentState);
      case 'deleteObject':
        return executeDeleteObject(command, currentState);
      case 'createObject':
        return executeCreateObject(command, currentState);
      case 'updateTitle':
        return executeUpdateTitle(command, currentState);
      case 'batch':
        return executeBatch(command, currentState);
      default:
        return {
          newState: currentState,
          success: false,
          error: `Unknown command type: ${(command as UndoRedoCommand).type}`,
        };
    }
  } catch (error) {
    return {
      newState: currentState,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing command',
    };
  }
}

/**
 * Undoes a command and returns the previous state.
 */
export function undoCommand(
  command: UndoRedoCommand,
  currentState: EditorState
): CommandExecutionResult {
  try {
    switch (command.type) {
      case 'updateObject':
        return undoUpdateObject(command, currentState);
      case 'deleteObject':
        return undoDeleteObject(command, currentState);
      case 'createObject':
        return undoCreateObject(command, currentState);
      case 'updateTitle':
        return undoUpdateTitle(command, currentState);
      case 'batch':
        return undoBatch(command, currentState);
      default:
        return {
          newState: currentState,
          success: false,
          error: `Unknown command type: ${(command as UndoRedoCommand).type}`,
        };
    }
  } catch (error) {
    return {
      newState: currentState,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error undoing command',
    };
  }
}

// ============================================================================
// Command Execution Functions
// ============================================================================

function executeUpdateObject(
  command: UpdateObjectCommand,
  currentState: EditorState
): CommandExecutionResult {
  const objectIndex = currentState.objects.findIndex((obj) => obj.id === command.objectId);
  if (objectIndex === -1) {
    return {
      newState: currentState,
      success: false,
      error: `Object with id ${command.objectId} not found`,
    };
  }

  const newObjects = [...currentState.objects];
  newObjects[objectIndex] = command.newState;

  return {
    newState: {
      ...currentState,
      objects: newObjects,
    },
    success: true,
  };
}

function executeDeleteObject(
  command: DeleteObjectCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newObjects = currentState.objects.filter((obj) => obj.id !== command.deletedObject.id);

  return {
    newState: {
      ...currentState,
      objects: newObjects,
    },
    success: true,
  };
}

function executeCreateObject(
  command: CreateObjectCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newObjects = [...currentState.objects];
  newObjects.splice(command.index, 0, command.createdObject);

  return {
    newState: {
      ...currentState,
      objects: newObjects,
    },
    success: true,
  };
}

function executeUpdateTitle(
  command: UpdateTitleCommand,
  currentState: EditorState
): CommandExecutionResult {
  return {
    newState: {
      ...currentState,
      simulationTitle: command.newTitle,
    },
    success: true,
  };
}

function executeBatch(command: BatchCommand, currentState: EditorState): CommandExecutionResult {
  let state = currentState;
  for (const subCommand of command.commands) {
    const result = executeCommand(subCommand, state);
    if (!result.success) {
      return {
        newState: currentState,
        success: false,
        error: `Batch command failed: ${result.error}`,
      };
    }
    state = result.newState;
  }

  return {
    newState: state,
    success: true,
  };
}

// ============================================================================
// Command Undo Functions
// ============================================================================

function undoUpdateObject(
  command: UpdateObjectCommand,
  currentState: EditorState
): CommandExecutionResult {
  const objectIndex = currentState.objects.findIndex((obj) => obj.id === command.objectId);
  if (objectIndex === -1) {
    return {
      newState: currentState,
      success: false,
      error: `Object with id ${command.objectId} not found`,
    };
  }

  const newObjects = [...currentState.objects];
  newObjects[objectIndex] = command.previousState;

  return {
    newState: {
      ...currentState,
      objects: newObjects,
    },
    success: true,
  };
}

function undoDeleteObject(
  command: DeleteObjectCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newObjects = [...currentState.objects];
  newObjects.splice(command.index, 0, command.deletedObject);

  return {
    newState: {
      ...currentState,
      objects: newObjects,
    },
    success: true,
  };
}

function undoCreateObject(
  command: CreateObjectCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newObjects = currentState.objects.filter((obj) => obj.id !== command.createdObject.id);

  return {
    newState: {
      ...currentState,
      objects: newObjects,
    },
    success: true,
  };
}

function undoUpdateTitle(
  command: UpdateTitleCommand,
  currentState: EditorState
): CommandExecutionResult {
  return {
    newState: {
      ...currentState,
      simulationTitle: command.previousTitle,
    },
    success: true,
  };
}

function undoBatch(command: BatchCommand, currentState: EditorState): CommandExecutionResult {
  // Undo commands in reverse order
  let state = currentState;
  for (let i = command.commands.length - 1; i >= 0; i--) {
    const subCommand = command.commands[i];
    const result = undoCommand(subCommand, state);
    if (!result.success) {
      return {
        newState: currentState,
        success: false,
        error: `Batch undo failed: ${result.error}`,
      };
    }
    state = result.newState;
  }

  return {
    newState: state,
    success: true,
  };
}

// ============================================================================
// Command Factory Functions
// ============================================================================

/**
 * Creates an UpdateObjectCommand.
 */
export function createUpdateObjectCommand(
  objectId: string,
  previousState: SceneObject,
  newState: SceneObject,
  description?: string
): UpdateObjectCommand {
  return {
    type: 'updateObject',
    timestamp: Date.now(),
    description,
    objectId,
    previousState,
    newState,
  };
}

/**
 * Creates a DeleteObjectCommand.
 */
export function createDeleteObjectCommand(
  deletedObject: SceneObject,
  index: number,
  description?: string
): DeleteObjectCommand {
  return {
    type: 'deleteObject',
    timestamp: Date.now(),
    description,
    deletedObject,
    index,
  };
}

/**
 * Creates a CreateObjectCommand.
 */
export function createCreateObjectCommand(
  createdObject: SceneObject,
  index: number,
  description?: string
): CreateObjectCommand {
  return {
    type: 'createObject',
    timestamp: Date.now(),
    description,
    createdObject,
    index,
  };
}

/**
 * Creates an UpdateTitleCommand.
 */
export function createUpdateTitleCommand(
  previousTitle: string,
  newTitle: string,
  description?: string
): UpdateTitleCommand {
  return {
    type: 'updateTitle',
    timestamp: Date.now(),
    description,
    previousTitle,
    newTitle,
  };
}

/**
 * Creates a BatchCommand that groups multiple commands.
 */
export function createBatchCommand(
  commands: UndoRedoCommand[],
  description?: string
): BatchCommand {
  return {
    type: 'batch',
    timestamp: Date.now(),
    description,
    commands,
  };
}
