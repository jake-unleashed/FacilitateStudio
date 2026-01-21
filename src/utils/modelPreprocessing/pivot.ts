import * as THREE from 'three';

import { getModelBoundingBox } from './metrics';

/**
 * Center model pivot point to bounding box center
 * This ensures rotation/scaling happens around the visual center
 * Returns the offset that was applied (for tracking)
 */
export function centerModelPivot(model: THREE.Group): THREE.Vector3 {
  const box = getModelBoundingBox(model);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const offset = center.clone();

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        for (let i = 0; i < positionAttribute.count; i++) {
          const x = positionAttribute.getX(i);
          const y = positionAttribute.getY(i);
          const z = positionAttribute.getZ(i);

          positionAttribute.setX(i, x - center.x);
          positionAttribute.setY(i, y - center.y);
          positionAttribute.setZ(i, z - center.z);
        }

        positionAttribute.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }
    }
  });

  model.position.set(0, 0, 0);

  return offset;
}

