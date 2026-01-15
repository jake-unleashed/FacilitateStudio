/**
 * Utilities for calculating and applying child mesh world positions.
 * Child meshes have local transforms relative to their parent object.
 */

import { SceneObject, ChildMesh, Transform, pathToString } from '../types';

/**
 * Find a child mesh by its path string in an object's children array.
 * @param object - The parent object
 * @param childPathStr - Path string (e.g., "Scene.Wheel_FL")
 * @returns The child mesh or null if not found
 */
export function findChildByPathString(object: SceneObject, childPathStr: string): ChildMesh | null {
  if (!object.children) return null;
  return object.children.find((child) => pathToString(child.path) === childPathStr) ?? null;
}

/**
 * Calculate the world position of a child mesh based on parent transform and child localTransform.
 *
 * This accounts for:
 * - Parent position (x, y, z)
 * - Child localTransform position (x, y, z) - applied in parent's local space
 * - Parent rotation and scale (affects how child localTransform is applied)
 *
 * Note: This is a simplified calculation that treats the child's localTransform position
 * as being directly added to the parent position, scaled by parent scale. For full accuracy,
 * we'd need to apply parent rotation to the child offset, but for move-item steps this
 * approximation should be sufficient since we're typically moving objects that are
 * positioned on the ground plane with minimal rotation.
 *
 * @param object - The parent object
 * @param childPathStr - Path string of the child (e.g., "Scene.Wheel_FL")
 * @returns World position in scene units (centimeters), or null if child not found
 */
export function calculateChildWorldPosition(
  object: SceneObject,
  childPathStr: string
): { x: number; y: number; z: number } | null {
  const child = findChildByPathString(object, childPathStr);
  if (!child) return null;

  // Start with parent position
  const parentX = object.transform.x;
  const parentY = object.transform.y;
  const parentZ = object.transform.z;

  // Add child's localTransform position, scaled by parent scale
  // This approximates the world position (ignoring parent rotation for simplicity)
  const childX = child.localTransform.x * object.transform.scaleX;
  const childY = child.localTransform.y * object.transform.scaleY;
  const childZ = child.localTransform.z * object.transform.scaleZ;

  return {
    x: parentX + childX,
    y: parentY + childY,
    z: parentZ + childZ,
  };
}

/**
 * Apply a world position to a child mesh by updating its localTransform.
 * This calculates the required localTransform offset to achieve the desired world position.
 *
 * @param object - The parent object
 * @param childPathStr - Path string of the child
 * @param worldPos - Desired world position in scene units (centimeters)
 * @returns Updated object with modified child localTransform, or null if child not found
 */
export function applyChildWorldPosition(
  object: SceneObject,
  childPathStr: string,
  worldPos: { x: number; y: number; z: number }
): SceneObject | null {
  const child = findChildByPathString(object, childPathStr);
  if (!child || !object.children) return null;

  // Calculate required localTransform offset
  // Reverse the calculation: localTransform = (worldPos - parentPos) / parentScale
  const parentX = object.transform.x;
  const parentY = object.transform.y;
  const parentZ = object.transform.z;

  const deltaX = worldPos.x - parentX;
  const deltaY = worldPos.y - parentY;
  const deltaZ = worldPos.z - parentZ;

  // Avoid division by zero
  const scaleX = object.transform.scaleX !== 0 ? object.transform.scaleX : 1;
  const scaleY = object.transform.scaleY !== 0 ? object.transform.scaleY : 1;
  const scaleZ = object.transform.scaleZ !== 0 ? object.transform.scaleZ : 1;

  const newLocalTransform = {
    ...child.localTransform,
    x: deltaX / scaleX,
    y: deltaY / scaleY,
    z: deltaZ / scaleZ,
  };

  // Update the child in the children array
  const updatedChildren = object.children.map((c) =>
    pathToString(c.path) === childPathStr ? { ...c, localTransform: newLocalTransform } : c
  );

  return {
    ...object,
    children: updatedChildren,
  };
}

/**
 * Apply partial localTransform updates to a child mesh.
 * This is used when we want to update child rotation/scale without affecting its local position,
 * or vice-versa.
 *
 * @param object - The parent object
 * @param childPathStr - Path string of the child
 * @param updates - Partial local transform updates to merge
 * @returns Updated object with modified child localTransform, or null if child not found
 */
export function applyChildLocalTransform(
  object: SceneObject,
  childPathStr: string,
  updates: Partial<Transform>
): SceneObject | null {
  const child = findChildByPathString(object, childPathStr);
  if (!child || !object.children) return null;

  const newLocalTransform: Transform = {
    ...child.localTransform,
    ...updates,
  };

  const updatedChildren = object.children.map((c) =>
    pathToString(c.path) === childPathStr ? { ...c, localTransform: newLocalTransform } : c
  );

  return {
    ...object,
    children: updatedChildren,
  };
}
