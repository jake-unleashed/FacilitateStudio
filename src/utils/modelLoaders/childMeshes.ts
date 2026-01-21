import * as THREE from 'three';

import { IS_DEV } from './env';
import { ChildMesh, DEFAULT_TRANSFORM } from '../../types';

/**
 * Information about an extracted child mesh for scene hierarchy display.
 */
export interface ExtractedChildInfo {
  name: string;
  path: string[];
  meshCount: number;
}

/**
 * Check if an object or any of its descendants has actual renderable geometry.
 * This verifies not just that a THREE.Mesh exists, but that it has vertices.
 */
function hasActualGeometry(obj: THREE.Object3D): boolean {
  if (obj instanceof THREE.Mesh && obj.geometry) {
    const positionAttr = obj.geometry.attributes.position;
    if (positionAttr && positionAttr.count > 0) {
      return true;
    }
  }

  for (const child of obj.children) {
    if (hasActualGeometry(child)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate the geometry center offset for a mesh or group.
 * This is the offset from the object's local origin to the center of its bounding box.
 * Used for center-based rotation instead of rotating around the arbitrary pivot point.
 */
function calculateGeometryCenterOffset(obj: THREE.Object3D): { x: number; y: number; z: number } {
  const center = new THREE.Vector3();

  obj.updateMatrixWorld(true);

  if (obj instanceof THREE.Mesh && obj.geometry) {
    obj.geometry.computeBoundingBox();
    const box = obj.geometry.boundingBox;

    if (box && !box.isEmpty()) {
      box.getCenter(center);

      if (IS_DEV) {
        console.log(
          `[calculateGeometryCenterOffset] Mesh "${obj.name}": center = (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`
        );
      }

      return { x: center.x, y: center.y, z: center.z };
    }
    return { x: 0, y: 0, z: 0 };
  }

  const box = new THREE.Box3();
  let hasGeometry = false;

  obj.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const positionAttr = child.geometry.attributes.position;
      if (!positionAttr || positionAttr.count === 0) return;

      child.geometry.computeBoundingBox();
      const geomBox = child.geometry.boundingBox;

      if (geomBox && !geomBox.isEmpty()) {
        const corners = [
          new THREE.Vector3(geomBox.min.x, geomBox.min.y, geomBox.min.z),
          new THREE.Vector3(geomBox.min.x, geomBox.min.y, geomBox.max.z),
          new THREE.Vector3(geomBox.min.x, geomBox.max.y, geomBox.min.z),
          new THREE.Vector3(geomBox.min.x, geomBox.max.y, geomBox.max.z),
          new THREE.Vector3(geomBox.max.x, geomBox.min.y, geomBox.min.z),
          new THREE.Vector3(geomBox.max.x, geomBox.min.y, geomBox.max.z),
          new THREE.Vector3(geomBox.max.x, geomBox.max.y, geomBox.min.z),
          new THREE.Vector3(geomBox.max.x, geomBox.max.y, geomBox.max.z),
        ];

        const childWorldMatrix = child.matrixWorld.clone();
        const objWorldMatrixInverse = obj.matrixWorld.clone().invert();
        const localMatrix = objWorldMatrixInverse.multiply(childWorldMatrix);

        for (const corner of corners) {
          corner.applyMatrix4(localMatrix);
          box.expandByPoint(corner);
        }
        hasGeometry = true;
      }
    }
  });

  if (!hasGeometry || box.isEmpty()) {
    return { x: 0, y: 0, z: 0 };
  }

  box.getCenter(center);

  if (IS_DEV) {
    console.log(
      `[calculateGeometryCenterOffset] Group "${obj.name}": center = (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`
    );
  }

  return { x: center.x, y: center.y, z: center.z };
}

/**
 * Sanitize a child name for display.
 * Removes common prefixes, underscores to spaces, etc.
 */
function sanitizeChildName(name: string): string {
  if (!name) return '';

  let cleaned = name
    .replace(/^(Object|Mesh|Group|Node|Scene)_?/i, '')
    .replace(/^_+/, '')
    .replace(/_+$/, '');

  cleaned = cleaned.replace(/[_-]+/g, ' ');

  cleaned = cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();

  return cleaned || name;
}

/**
 * Get the path from root to a specific object in the hierarchy.
 */
function getObjectPath(root: THREE.Object3D, target: THREE.Object3D): string[] | null {
  const path: string[] = [];

  function findPath(obj: THREE.Object3D, current: string[]): boolean {
    if (obj === target) {
      path.push(...current);
      return true;
    }
    for (const child of obj.children) {
      const childPath = [...current, child.name || `child_${child.id}`];
      if (findPath(child, childPath)) {
        return true;
      }
    }
    return false;
  }

  findPath(root, []);
  return path.length > 0 ? path : null;
}

/**
 * Extract child mesh hierarchy from a loaded 3D model.
 * Returns an array of ChildMesh objects suitable for storing in SceneObject.children.
 */
export function extractChildMeshes(model: THREE.Group): ChildMesh[] {
  const children: ChildMesh[] = [];

  let meshCount = 0;
  let namedGroupCount = 0;

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      meshCount++;
    }
    if (child instanceof THREE.Group && child.name && child.name !== '' && child !== model) {
      namedGroupCount++;
    }
  });

  if (meshCount <= 1 && namedGroupCount === 0) {
    if (IS_DEV) {
      console.log('[extractChildMeshes] Single mesh model, no children to extract');
    }
    return children;
  }

  const visitedPaths = new Set<string>();

  function extractChildrenRecursive(obj: THREE.Object3D, currentPath: string[]): void {
    for (const child of obj.children) {
      const childPath = [...currentPath, child.name || `child_${child.id}`];
      const pathKey = childPath.join('/');

      if (visitedPaths.has(pathKey)) continue;
      if (!hasActualGeometry(child)) continue;

      if (child instanceof THREE.Mesh) {
        visitedPaths.add(pathKey);
        children.push({
          name: sanitizeChildName(child.name) || `Part ${children.length + 1}`,
          path: childPath,
          localTransform: { ...DEFAULT_TRANSFORM },
          geometryCenterOffset: calculateGeometryCenterOffset(child),
        });
      } else {
        const hasName = child.name && child.name !== '' && !child.name.startsWith('_');

        if (hasName) {
          visitedPaths.add(pathKey);
          children.push({
            name: sanitizeChildName(child.name),
            path: childPath,
            localTransform: { ...DEFAULT_TRANSFORM },
            geometryCenterOffset: calculateGeometryCenterOffset(child),
          });
        }

        extractChildrenRecursive(child, childPath);
      }
    }
  }

  extractChildrenRecursive(model, []);

  if (children.length === 0 && meshCount > 1) {
    let partIndex = 1;
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && (child as THREE.Object3D) !== (model as THREE.Object3D)) {
        const path = getObjectPath(model, child);
        if (path) {
          children.push({
            name: sanitizeChildName(child.name) || `Part ${partIndex++}`,
            path: path,
            localTransform: { ...DEFAULT_TRANSFORM },
            geometryCenterOffset: calculateGeometryCenterOffset(child),
          });
        }
      }
    });
  }

  if (IS_DEV) {
    console.log(
      `[extractChildMeshes] Extracted ${children.length} children:`,
      children.map((c) => ({ name: c.name, depth: c.path.length }))
    );
  }

  return children;
}

/**
 * Find a child object in a model by its path.
 */
export function findChildByPath(model: THREE.Object3D, path: string[]): THREE.Object3D | null {
  let current: THREE.Object3D = model;

  for (const segment of path) {
    const child = current.children.find((c) => c.name === segment || `child_${c.id}` === segment);
    if (!child) {
      if (IS_DEV) {
        console.warn(`[findChildByPath] Could not find segment "${segment}" in path`, path);
      }
      return null;
    }
    current = child;
  }

  return current;
}

