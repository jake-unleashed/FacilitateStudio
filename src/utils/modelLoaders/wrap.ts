import * as THREE from 'three';

/**
 * Wrap model in a Group for consistent structure.
 *
 * NOTE: We do NOT clone here. The original model from the loader is used directly.
 * Deep cloning is handled by the model cache when returning instances to the scene.
 * This prevents unnecessary cloning during the loading pipeline.
 */
export function wrapInGroup(model: THREE.Object3D): THREE.Group {
  if (model instanceof THREE.Group) {
    return model;
  }

  const group = new THREE.Group();
  group.add(model);
  return group;
}

