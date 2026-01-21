import * as THREE from 'three';

/**
 * Calculate bounding box for a model (useful for auto-scaling).
 */
export function getModelBoundingBox(model: THREE.Group): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

/**
 * Center model at origin.
 */
export function centerModelAtOrigin(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
}

/**
 * Scale model to fit within a bounding box.
 */
export function scaleModelToFit(model: THREE.Group, maxSize: number = 1): void {
  const box = getModelBoundingBox(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (maxDimension > 0) {
    const scale = maxSize / maxDimension;
    model.scale.multiplyScalar(scale);
  }
}

