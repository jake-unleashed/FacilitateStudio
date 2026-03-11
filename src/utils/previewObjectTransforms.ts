import type { SceneObject } from '../types';
import { applyChildLocalTransform, applyChildWorldPosition } from './childTransformUtils';

export interface PreviewTransformUpdate {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

/**
 * Applies a preview-time transform update to either a parent object or a targeted child mesh.
 */
export function applyPreviewTransformUpdate(
  objects: SceneObject[],
  objectId: string,
  update: PreviewTransformUpdate,
  childPath?: string
): SceneObject[] {
  const object = objects.find((candidate) => candidate.id === objectId);
  if (!object) {
    return objects;
  }

  if (childPath) {
    const updatedForPos = applyChildWorldPosition(object, childPath, update.position) ?? object;
    const updatedForRotScale =
      applyChildLocalTransform(updatedForPos, childPath, {
        rotationX: update.rotation.x,
        rotationY: update.rotation.y,
        rotationZ: update.rotation.z,
        scaleX: update.scale.x,
        scaleY: update.scale.y,
        scaleZ: update.scale.z,
      }) ?? updatedForPos;

    return objects.map((candidate) => (candidate.id === objectId ? updatedForRotScale : candidate));
  }

  return objects.map((candidate) =>
    candidate.id === objectId
      ? {
          ...candidate,
          transform: {
            ...candidate.transform,
            x: update.position.x,
            y: update.position.y,
            z: update.position.z,
            rotationX: update.rotation.x,
            rotationY: update.rotation.y,
            rotationZ: update.rotation.z,
            scaleX: update.scale.x,
            scaleY: update.scale.y,
            scaleZ: update.scale.z,
          },
        }
      : candidate
  );
}
