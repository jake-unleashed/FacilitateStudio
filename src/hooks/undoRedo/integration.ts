import { SceneObject, SimStep } from '../../types';
import {
  createUpdateObjectCommand,
  createDeleteObjectCommand,
  createCreateObjectCommand,
  createUpdateTitleCommand,
  createCreateStepCommand,
} from './commandImplementations';
import type { UndoRedoCommand } from './types';

/**
 * Helper function to create an update object command and execute it.
 * This is a convenience wrapper for the common case of updating an object.
 */
export function createUpdateObjectCommandHelper(
  objectId: string,
  previousState: SceneObject,
  newState: SceneObject,
  description?: string
): UndoRedoCommand {
  return createUpdateObjectCommand(objectId, previousState, newState, description);
}

/**
 * Helper function to create a delete object command.
 */
export function createDeleteObjectCommandHelper(
  deletedObject: SceneObject,
  index: number,
  description?: string
): UndoRedoCommand {
  return createDeleteObjectCommand(deletedObject, index, description);
}

/**
 * Helper function to create a create object command.
 */
export function createCreateObjectCommandHelper(
  createdObject: SceneObject,
  index: number,
  description?: string
): UndoRedoCommand {
  return createCreateObjectCommand(createdObject, index, description);
}

/**
 * Helper function to create an update title command.
 */
export function createUpdateTitleCommandHelper(
  previousTitle: string,
  newTitle: string,
  description?: string
): UndoRedoCommand {
  return createUpdateTitleCommand(previousTitle, newTitle, description);
}

/**
 * Finds the index of an object in an array by its ID.
 * Returns -1 if not found.
 */
export function findObjectIndex(objects: SceneObject[], objectId: string): number {
  return objects.findIndex((obj) => obj.id === objectId);
}

/**
 * Gets an object from an array by its ID.
 * Returns undefined if not found.
 */
export function getObjectById(objects: SceneObject[], objectId: string): SceneObject | undefined {
  return objects.find((obj) => obj.id === objectId);
}

/**
 * Helper function to create a create step command.
 */
export function createCreateStepCommandHelper(
  createdStep: SimStep,
  index: number,
  description?: string
): UndoRedoCommand {
  return createCreateStepCommand(createdStep, index, description);
}
