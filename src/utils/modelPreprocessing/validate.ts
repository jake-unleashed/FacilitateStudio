import * as THREE from 'three';

import { getModelBoundingBox } from './metrics';

/**
 * Validate model before preprocessing
 */
export function validateModel(model: THREE.Group): {
  valid: boolean;
  error?: string;
} {
  model.updateMatrixWorld(true);

  let hasGeometry = false;
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      hasGeometry = true;
    }
  });

  if (!hasGeometry) {
    return { valid: false, error: 'Model has no geometry' };
  }

  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (maxDimension <= 0 || !isFinite(maxDimension)) {
    return { valid: false, error: 'Model has zero or invalid size' };
  }

  if (
    !isFinite(box.min.x) ||
    !isFinite(box.max.x) ||
    !isFinite(box.min.y) ||
    !isFinite(box.max.y) ||
    !isFinite(box.min.z) ||
    !isFinite(box.max.z)
  ) {
    return { valid: false, error: 'Model has invalid geometry (NaN or Infinity)' };
  }

  return { valid: true };
}

