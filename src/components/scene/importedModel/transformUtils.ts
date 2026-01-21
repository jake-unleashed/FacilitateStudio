import * as THREE from 'three';

/**
 * Returns true if `node` is the same as `root` or a descendant of `root`.
 * Useful for filtering pointer intersections to a specific model subtree.
 */
export function isWithinSubtree(root: THREE.Object3D, node: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = node;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Computes pivot points for a mesh in its parent's local space.
 * Used to apply rotation around the geometric center and scale around the base.
 */
export function computeMeshPivots(mesh: THREE.Object3D): {
  localCenter: THREE.Vector3;
  localBase: THREE.Vector3;
} {
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(mesh);

  const worldCenter = new THREE.Vector3();
  box.getCenter(worldCenter);

  const worldBase = new THREE.Vector3(worldCenter.x, box.min.y, worldCenter.z);

  const parent = mesh.parent as THREE.Object3D | null;
  const localCenter = worldCenter.clone();
  const localBase = worldBase.clone();

  if (parent) {
    parent.updateMatrixWorld(true);
    const parentWorldMatrixInverse = parent.matrixWorld.clone().invert();
    localCenter.applyMatrix4(parentWorldMatrixInverse);
    localBase.applyMatrix4(parentWorldMatrixInverse);
  }

  return { localCenter, localBase };
}

/**
 * Calculates the position offset needed to rotate around a pivot point.
 */
export function calculateRotationOffset(pivot: THREE.Vector3, rotation: THREE.Euler): THREE.Vector3 {
  const rotatedPivot = pivot.clone().applyEuler(rotation);
  return pivot.clone().sub(rotatedPivot);
}

/**
 * Calculates the position offset needed to scale around a pivot point.
 */
export function calculateScaleOffset(
  pivot: THREE.Vector3,
  scale: { x: number; y: number; z: number }
): THREE.Vector3 {
  return new THREE.Vector3(pivot.x * (1 - scale.x), pivot.y * (1 - scale.y), pivot.z * (1 - scale.z));
}

