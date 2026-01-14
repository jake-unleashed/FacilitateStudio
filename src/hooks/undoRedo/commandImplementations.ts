import {
  EditorState,
  UndoRedoCommand,
  UpdateObjectCommand,
  DeleteObjectCommand,
  CreateObjectCommand,
  UpdateTitleCommand,
  CreateStepCommand,
  UpdateStepCommand,
  DeleteStepCommand,
  ReorderStepsCommand,
  BatchCommand,
  CommandExecutionResult,
} from './types';
import { SceneObject, SimStep } from '../../types';

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
      case 'createStep':
        return executeCreateStep(command, currentState);
      case 'updateStep':
        return executeUpdateStep(command, currentState);
      case 'deleteStep':
        return executeDeleteStep(command, currentState);
      case 'reorderSteps':
        return executeReorderSteps(command, currentState);
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
      case 'createStep':
        return undoCreateStep(command, currentState);
      case 'updateStep':
        return undoUpdateStep(command, currentState);
      case 'deleteStep':
        return undoDeleteStep(command, currentState);
      case 'reorderSteps':
        return undoReorderSteps(command, currentState);
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

function executeCreateStep(
  command: CreateStepCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newSteps = [...currentState.steps];
  newSteps.splice(command.index, 0, command.createdStep);

  return {
    newState: {
      ...currentState,
      steps: newSteps,
    },
    success: true,
  };
}

function executeUpdateStep(
  command: UpdateStepCommand,
  currentState: EditorState
): CommandExecutionResult {
  const stepIndex = currentState.steps.findIndex((step) => step.id === command.stepId);
  if (stepIndex === -1) {
    console.error('[executeUpdateStep] Step not found:', {
      stepId: command.stepId,
      availableStepIds: currentState.steps.map((s) => s.id),
    });
    return {
      newState: currentState,
      success: false,
      error: `Step with id ${command.stepId} not found`,
    };
  }

  const oldStep = currentState.steps[stepIndex];
  const newSteps = [...currentState.steps];
  newSteps[stepIndex] = command.newState;

  console.log('[executeUpdateStep] Executing step update:', {
    stepId: command.stepId,
    oldEndPos: oldStep.endPosition,
    newEndPos: command.newState.endPosition,
    oldStep: oldStep,
    newStep: command.newState,
  });

  return {
    newState: {
      ...currentState,
      steps: newSteps,
    },
    success: true,
  };
}

function executeDeleteStep(
  command: DeleteStepCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newSteps = currentState.steps.filter((step) => step.id !== command.deletedStep.id);

  return {
    newState: {
      ...currentState,
      steps: newSteps,
    },
    success: true,
  };
}

function executeReorderSteps(
  command: ReorderStepsCommand,
  currentState: EditorState
): CommandExecutionResult {
  // Create a map of step ID to step for quick lookup
  const stepMap = new Map(currentState.steps.map((step) => [step.id, step]));

  // Reorder steps according to newOrder
  const newSteps = command.newOrder
    .map((id) => stepMap.get(id))
    .filter((step): step is SimStep => step !== undefined);

  // Verify we didn't lose any steps
  if (newSteps.length !== currentState.steps.length) {
    return {
      newState: currentState,
      success: false,
      error: 'Reorder failed: step count mismatch',
    };
  }

  return {
    newState: {
      ...currentState,
      steps: newSteps,
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

function undoCreateStep(
  command: CreateStepCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newSteps = currentState.steps.filter((step) => step.id !== command.createdStep.id);

  return {
    newState: {
      ...currentState,
      steps: newSteps,
    },
    success: true,
  };
}

function undoUpdateStep(
  command: UpdateStepCommand,
  currentState: EditorState
): CommandExecutionResult {
  const stepIndex = currentState.steps.findIndex((step) => step.id === command.stepId);
  if (stepIndex === -1) {
    return {
      newState: currentState,
      success: false,
      error: `Step with id ${command.stepId} not found`,
    };
  }

  const newSteps = [...currentState.steps];
  newSteps[stepIndex] = command.previousState;

  return {
    newState: {
      ...currentState,
      steps: newSteps,
    },
    success: true,
  };
}

function undoDeleteStep(
  command: DeleteStepCommand,
  currentState: EditorState
): CommandExecutionResult {
  const newSteps = [...currentState.steps];
  newSteps.splice(command.index, 0, command.deletedStep);

  return {
    newState: {
      ...currentState,
      steps: newSteps,
    },
    success: true,
  };
}

function undoReorderSteps(
  command: ReorderStepsCommand,
  currentState: EditorState
): CommandExecutionResult {
  // Create a map of step ID to step for quick lookup
  const stepMap = new Map(currentState.steps.map((step) => [step.id, step]));

  // Reorder steps according to previousOrder
  const newSteps = command.previousOrder
    .map((id) => stepMap.get(id))
    .filter((step): step is SimStep => step !== undefined);

  // Verify we didn't lose any steps
  if (newSteps.length !== currentState.steps.length) {
    return {
      newState: currentState,
      success: false,
      error: 'Undo reorder failed: step count mismatch',
    };
  }

  return {
    newState: {
      ...currentState,
      steps: newSteps,
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

/**
 * Creates a CreateStepCommand.
 */
export function createCreateStepCommand(
  createdStep: SimStep,
  index: number,
  description?: string
): CreateStepCommand {
  return {
    type: 'createStep',
    timestamp: Date.now(),
    description,
    createdStep,
    index,
  };
}

/**
 * Creates an UpdateStepCommand.
 */
export function createUpdateStepCommand(
  stepId: string,
  previousState: SimStep,
  newState: SimStep,
  description?: string
): UpdateStepCommand {
  return {
    type: 'updateStep',
    timestamp: Date.now(),
    description,
    stepId,
    previousState,
    newState,
  };
}

/**
 * Creates a DeleteStepCommand.
 */
export function createDeleteStepCommand(
  deletedStep: SimStep,
  index: number,
  description?: string
): DeleteStepCommand {
  return {
    type: 'deleteStep',
    timestamp: Date.now(),
    description,
    deletedStep,
    index,
  };
}

/**
 * Creates a ReorderStepsCommand.
 */
export function createReorderStepsCommand(
  previousOrder: string[],
  newOrder: string[],
  description?: string
): ReorderStepsCommand {
  return {
    type: 'reorderSteps',
    timestamp: Date.now(),
    description,
    previousOrder,
    newOrder,
  };
}
