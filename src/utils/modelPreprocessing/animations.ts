import * as THREE from 'three';

/**
 * Disable animations in model (if present)
 */
export function disableModelAnimations(model: THREE.Group): void {
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.SkinnedMesh) {
      if (child.skeleton) {
        child.skeleton.bones.forEach((bone) => {
          bone.position.set(0, 0, 0);
          bone.rotation.set(0, 0, 0);
          bone.scale.set(1, 1, 1);
        });
      }
    }
  });
}

