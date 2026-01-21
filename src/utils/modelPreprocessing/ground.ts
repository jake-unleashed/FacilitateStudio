import * as THREE from 'three';

import { getModelBoundingBox } from './metrics';

/**
 * Align model to ground plane (bottom at y=0)
 * Modifies geometry vertices directly since transforms are baked.
 */
export function alignModelToGround(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const minY = box.min.y;

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        for (let i = 0; i < positionAttribute.count; i++) {
          positionAttribute.setY(i, positionAttribute.getY(i) - minY);
        }
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }
    }
  });
}

