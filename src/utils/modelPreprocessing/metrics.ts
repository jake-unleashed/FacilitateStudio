import * as THREE from 'three';

import type { ModelMetrics } from './types';

/**
 * Calculate bounding box for a model
 * Forces recalculation of all geometry bounding boxes to avoid stale values.
 */
export function getModelBoundingBox(model: THREE.Group): THREE.Box3 {
  model.updateMatrixWorld(true);

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      child.geometry.computeBoundingBox();
      child.geometry.computeBoundingSphere();
    }
  });

  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

/**
 * Count triangles in a model (for complexity checking)
 */
function countTriangles(model: THREE.Group): number {
  let count = 0;
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      if (geometry.index) {
        count += geometry.index.count / 3;
      } else {
        count += geometry.attributes.position.count / 3;
      }
    }
  });
  return count;
}

/**
 * Calculate model metrics
 */
export function calculateModelMetrics(model: THREE.Group): ModelMetrics {
  const boundingBox = getModelBoundingBox(model);
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z);
  const triangleCount = countTriangles(model);

  return {
    boundingBox,
    center,
    size,
    bottomY: boundingBox.min.y,
    topY: boundingBox.max.y,
    maxDimension,
    triangleCount,
  };
}

