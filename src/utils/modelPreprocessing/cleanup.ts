import * as THREE from 'three';

import { IS_DEV } from './env';

/**
 * Check if an object has any mesh geometry with actual vertices in its descendants.
 * Used to identify empty transform nodes that should be removed during preprocessing.
 */
export function hasGeometryDescendants(obj: THREE.Object3D): boolean {
  if (obj instanceof THREE.Mesh && obj.geometry) {
    const positionAttr = obj.geometry.attributes.position;
    return positionAttr && positionAttr.count > 0;
  }

  for (const child of obj.children) {
    if (hasGeometryDescendants(child)) {
      return true;
    }
  }

  return false;
}

/**
 * Remove helper objects that have no geometry descendants.
 *
 * CAD software (SolidWorks, Fusion 360, etc.) often exports view presets,
 * cameras, lights, and other helper objects that have transforms but no
 * actual geometry. These can throw off bounding box calculations.
 *
 * @returns The number of objects removed
 */
export function removeHelperObjects(model: THREE.Group): number {
  let removedCount = 0;
  const objectsToRemove: THREE.Object3D[] = [];

  model.traverse((child: THREE.Object3D) => {
    if (child === model) return;
    if (!hasGeometryDescendants(child)) {
      objectsToRemove.push(child);
    }
  });

  for (const obj of objectsToRemove) {
    if (obj.parent) {
      if (IS_DEV) {
        console.log(`[modelPreprocessing] Removing empty object: "${obj.name || obj.type}"`);
      }
      obj.parent.remove(obj);
      removedCount++;
    }
  }

  return removedCount;
}

