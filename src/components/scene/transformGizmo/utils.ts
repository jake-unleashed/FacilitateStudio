/**
 * TransformGizmo Utility Functions
 *
 * Helper functions for the TransformGizmo component.
 */

import * as THREE from 'three';
import { ChildMesh, pathToString } from '../../../types';
import { ViewMode } from './types';
import { SIDE_VIEW_THRESHOLD, TOPDOWN_VIEW_THRESHOLD, VIEW_MODE_HYSTERESIS } from './constants';

/**
 * Calculate bounding box only from meshes with actual geometry.
 * This excludes empty transforms, cameras, lights, and other non-renderable objects
 * that may have positions but no visible geometry.
 *
 * @param obj - The Three.js object to calculate bounds for
 * @returns A Box3 containing only the bounds of visible geometry
 */
export function calculateVisibleBounds(obj: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      if (posAttr && posAttr.count > 0) {
        child.geometry.computeBoundingBox();
        const geomBox = child.geometry.boundingBox;
        if (geomBox && !geomBox.isEmpty()) {
          const worldBox = geomBox.clone();
          worldBox.applyMatrix4(child.matrixWorld);
          box.union(worldBox);
        }
      }
    }
  });

  return box;
}

/**
 * Calculate volume-weighted center from meshes with actual geometry.
 * This gives more weight to larger meshes (main body) and less to tiny parts (screws).
 * Useful for positioning gizmos at the visual center of a model rather than at
 * the mathematical center of the bounding box (which can be skewed by outliers).
 *
 * @param obj - The Three.js object to calculate the weighted center for
 * @returns A Vector3 representing the volume-weighted center position
 */
export function calculateWeightedCenter(obj: THREE.Object3D): THREE.Vector3 {
  let totalVolume = 0;
  const weightedSum = new THREE.Vector3();
  obj.updateMatrixWorld(true);

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      if (posAttr && posAttr.count > 0) {
        child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox;
        if (box && !box.isEmpty()) {
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          center.applyMatrix4(child.matrixWorld);

          const volume = Math.max(size.x * size.y * size.z, 0.0001);
          weightedSum.addScaledVector(center, volume);
          totalVolume += volume;
        }
      }
    }
  });

  if (totalVolume > 0) {
    weightedSum.divideScalar(totalVolume);
  }
  return weightedSum;
}

/**
 * Determines the current view mode based on camera pitch angle.
 * Uses hysteresis to prevent flickering at mode boundaries.
 *
 * @param camera - The Three.js camera
 * @param currentMode - The current view mode (for hysteresis)
 * @param cameraDirection - Reusable vector for camera direction (avoids allocation)
 * @returns The appropriate view mode for the camera angle
 */
export function getViewMode(
  camera: THREE.Camera,
  currentMode: ViewMode,
  cameraDirection: THREE.Vector3
): ViewMode {
  camera.getWorldDirection(cameraDirection);

  // Calculate pitch angle (0 = horizontal, 90 = straight down/up)
  const pitchAngle = Math.asin(Math.abs(cameraDirection.y)) * (180 / Math.PI);

  // Apply hysteresis based on current mode
  const sideThreshold =
    currentMode === 'side' ? SIDE_VIEW_THRESHOLD + VIEW_MODE_HYSTERESIS : SIDE_VIEW_THRESHOLD;
  const topdownThreshold =
    currentMode === 'topdown'
      ? TOPDOWN_VIEW_THRESHOLD - VIEW_MODE_HYSTERESIS
      : TOPDOWN_VIEW_THRESHOLD;

  if (pitchAngle < sideThreshold) {
    return 'side';
  }
  if (pitchAngle > topdownThreshold) {
    return 'topdown';
  }
  return 'isometric';
}

/**
 * Finds a child mesh data object by its path string
 */
export function findChildDataByPath(
  children: ChildMesh[] | undefined,
  pathStr: string
): ChildMesh | null {
  if (!children) return null;

  for (const child of children) {
    if (pathToString(child.path) === pathStr) {
      return child;
    }
  }
  return null;
}

/**
 * Finds a Three.js object in the scene by its custom objectId userData property
 */
export function findObjectGroupInScene(
  scene: THREE.Scene,
  objectId: string
): THREE.Object3D | null {
  let result: THREE.Object3D | null = null;

  scene.traverse((obj) => {
    if (obj.userData?.objectId === objectId) {
      result = obj;
    }
  });

  return result;
}

/**
 * Traverses a group to find the actual loaded model
 * (handles nested group structures from model loaders)
 */
export function findModelInGroup(group: THREE.Object3D): THREE.Object3D | null {
  if (group.children.length === 0) {
    return group;
  }

  const firstChild = group.children[0];

  // If first child is a mesh, the group itself contains the model
  if (firstChild instanceof THREE.Mesh) {
    return group;
  }

  // If first child is a group, dive deeper
  if (firstChild instanceof THREE.Group && firstChild.children.length > 0) {
    return firstChild.children[0] ?? null;
  }

  return group;
}

/**
 * Extracts the scale component from a world matrix for a given axis
 * @param matrix - The world matrix to extract from
 * @param axis - 'x' | 'y' | 'z'
 * @returns The scale value for that axis
 */
export function extractScaleFromMatrix(matrix: THREE.Matrix4, axis: 'x' | 'y' | 'z'): number {
  const elements = matrix.elements;

  // Matrix columns for each axis basis vector:
  // X: [0,1,2], Y: [4,5,6], Z: [8,9,10]
  const offsets = { x: 0, y: 4, z: 8 };
  const offset = offsets[axis];

  return Math.sqrt(
    elements[offset] * elements[offset] +
      elements[offset + 1] * elements[offset + 1] +
      elements[offset + 2] * elements[offset + 2]
  );
}

/**
 * Converts a world-space delta vector into the parent-local delta vector.
 *
 * This is used for child translation: user gestures are interpreted in world space
 * (consistent across root/parent/child), but we persist child movement as
 * `localTransform` deltas in the child's parent space.
 *
 * This implementation is robust for:
 * - Parent rotation on any axis (X/Y/Z)
 * - Non-uniform scaling
 *
 * Note: Translation components are intentionally ignored (deltas only).
 */
export function worldDeltaToParentLocalDelta(
  parentWorldMatrix: THREE.Matrix4,
  worldDelta: THREE.Vector3
): THREE.Vector3 {
  const linear = new THREE.Matrix3().setFromMatrix4(parentWorldMatrix);
  const invLinear = linear.invert();
  return worldDelta.clone().applyMatrix3(invLinear);
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculates how many screen pixels correspond to one world unit at a given distance.
 * Uses perspective projection geometry for a view-angle-independent result.
 *
 * This ensures consistent screen-space sizing regardless of whether the camera
 * is looking from the side, top, bottom, or any angle.
 *
 * @param camera - The perspective camera
 * @param targetPosition - The world position to measure at
 * @param viewportHeight - The viewport height in pixels
 * @returns Pixels per world unit at the target position's depth
 */
export function calculatePixelsPerWorldUnit(
  camera: THREE.Camera,
  targetPosition: THREE.Vector3,
  viewportHeight: number
): number {
  const cameraDistance = camera.position.distanceTo(targetPosition);

  // Guard against zero/negative distance
  if (cameraDistance <= 0) return 1;

  const perspCamera = camera as THREE.PerspectiveCamera;
  const vFovRadians = perspCamera.fov * (Math.PI / 180);
  const halfFovTan = Math.tan(vFovRadians / 2);

  // Perspective projection: at distance d, visible height = 2 * d * tan(fov/2)
  // pixels per world unit = viewport height / visible height
  return viewportHeight / (2 * cameraDistance * halfFovTan);
}

/**
 * Converts a target screen-space pixel distance to world units.
 * Used for maintaining consistent visual spacing regardless of zoom level.
 *
 * @param targetPixels - Desired distance in screen pixels
 * @param pixelsPerWorldUnit - Current pixels per world unit ratio
 * @returns Equivalent distance in world units
 */
export function pixelsToWorldUnits(targetPixels: number, pixelsPerWorldUnit: number): number {
  // Guard against division by zero
  if (pixelsPerWorldUnit <= 0) return 0;
  return targetPixels / pixelsPerWorldUnit;
}

/**
 * Generates CSS classes for handle button based on state
 */
export function getHandleClasses(isDragging: boolean, isHovered: boolean): string {
  const baseClasses = `
    flex items-center justify-center
    w-10 h-10 rounded-2xl
    bg-white/90 text-slate-500
    border border-white/60
    backdrop-blur-xl
    transition-all duration-150 ease-out
    cursor-grab active:cursor-grabbing
    select-none
    hover:text-slate-700
  `;

  if (isDragging) {
    return `${baseClasses} scale-95 ring-2 ring-blue-400 shadow-md`;
  }
  if (isHovered) {
    return `${baseClasses} scale-110 bg-white shadow-xl`;
  }
  return `${baseClasses} shadow-lg`;
}
