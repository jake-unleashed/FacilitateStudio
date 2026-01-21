import * as THREE from 'three';

/**
 * Bake all transforms into geometry vertices.
 *
 * This function "flattens" the model by:
 * 1. Computing the world matrix for each mesh
 * 2. Applying the world matrix directly to vertex positions
 * 3. Resetting all transforms to identity
 */
export function bakeTransformsIntoGeometry(model: THREE.Group): void {
  model.updateMatrixWorld(true);

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        const worldMatrix = child.matrixWorld.clone();

        const vertex = new THREE.Vector3();
        for (let i = 0; i < positionAttribute.count; i++) {
          vertex.set(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
          vertex.applyMatrix4(worldMatrix);
          positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        positionAttribute.needsUpdate = true;

        const normalAttribute = geometry.attributes.normal;
        if (normalAttribute) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
          const normal = new THREE.Vector3();
          for (let i = 0; i < normalAttribute.count; i++) {
            normal.set(normalAttribute.getX(i), normalAttribute.getY(i), normalAttribute.getZ(i));
            normal.applyMatrix3(normalMatrix).normalize();
            normalAttribute.setXYZ(i, normal.x, normal.y, normal.z);
          }
          normalAttribute.needsUpdate = true;
        }

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }
    }
  });

  model.traverse((child: THREE.Object3D) => {
    child.position.set(0, 0, 0);
    child.rotation.set(0, 0, 0);
    child.scale.set(1, 1, 1);
    child.updateMatrix();
  });

  model.updateMatrixWorld(true);
}

