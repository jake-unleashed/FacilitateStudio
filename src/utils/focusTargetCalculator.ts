/**
 * Focus Target Calculator
 *
 * Shared implementation of the “good framing” focus target logic used by edit mode.
 * This is intentionally reused by preview mode camera framing so both modes feel consistent.
 *
 * Key behaviors:
 * - Compute bounds from ONLY renderable geometry (exclude empty transforms/lights/cameras)
 * - Use volume-weighted center (focuses on the visual bulk, not outliers)
 * - Cap extreme aspect ratios so long/thin outliers don’t force excessive zoom-out
 * - Support focusing on a specific child mesh within an imported model
 */

import * as THREE from 'three';
import { SceneObject, stringToPath } from '../types';
import { FocusTarget, sceneToWorldCoordinates } from './focusUtils';
import { getOrLoadModel } from './modelCache';
import { findChildByPath } from './modelLoaders';

/**
 * Calculate focus target for an object (handles both imported models and primitives).
 * Determines the orbit center point and bounds size for camera positioning.
 *
 * Note: For preview framing at arbitrary positions, callers can pass an `object` copy with
 * `transform.x/y/z` set to the desired pose before calling this.
 */
export async function calculateFocusTargetForObject(params: {
  object: SceneObject;
  childPath?: string;
}): Promise<FocusTarget> {
  const { object, childPath } = params;

  // Convert scene coordinates to Three.js world coordinates
  const parentWorld = sceneToWorldCoordinates(
    object.transform.x,
    object.transform.y,
    object.transform.z
  );

  // Default values for primitives
  let focusTarget: FocusTarget = {
    targetX: parentWorld.x,
    targetY: parentWorld.y + 0.5, // Default cube center
    targetZ: parentWorld.z,
    boundsSize: 1,
  };

  if (!object.properties.modelAssetId) {
    return focusTarget;
  }

  try {
    // Load model from cache (fast - already loaded)
    const { model, metrics } = await getOrLoadModel(object.properties.modelAssetId);
    const modelHeight = metrics.size.y;
    const maxScale = Math.max(
      object.transform.scaleX,
      object.transform.scaleY,
      object.transform.scaleZ
    );

    // Calculate actual world-space bounding box from ONLY visible geometry
    // This excludes empty transforms, cameras, lights, etc.
    const visibleBox = calculateVisibleBounds(model);
    const visibleSize = new THREE.Vector3();
    visibleBox.getSize(visibleSize);
    const visibleMaxDim = Math.max(visibleSize.x, visibleSize.y, visibleSize.z);

    // Use volume-weighted center instead of bounding box center
    // This focuses on where the bulk of the geometry is, not outlier parts
    const weightedCenter = calculateWeightedCenter(model);

    // Calculate effective bounds size for camera distance
    // When one dimension is extremely elongated, use the second-largest dimension to avoid zooming out
    const dims = [visibleSize.x, visibleSize.y, visibleSize.z].sort((a, b) => b - a);
    const largest = dims[0];
    const secondLargest = dims[1];

    // If largest is more than 2.5x the second largest, the model has extreme outliers
    // Use a capped value based on the second largest dimension
    let effectiveMaxDim: number;
    if (largest > secondLargest * 2.5 && secondLargest > 0) {
      // Cap at 1.5x the second largest dimension
      effectiveMaxDim = secondLargest * 1.5;
    } else {
      effectiveMaxDim = visibleMaxDim > 0 ? visibleMaxDim : metrics.maxDimension;
    }

    const effectiveHeight = visibleSize.y > 0 ? visibleSize.y : modelHeight;

    if (childPath) {
      // Child focus: find and compute bounds for specific child mesh
      focusTarget = calculateChildFocusTarget(
        object,
        parentWorld,
        model,
        childPath,
        effectiveHeight,
        effectiveMaxDim
      );
    } else {
      // Root object focus: use volume-weighted center (where the bulk of geometry is)
      focusTarget = {
        targetX: parentWorld.x + weightedCenter.x * object.transform.scaleX,
        targetY: parentWorld.y + weightedCenter.y * object.transform.scaleY,
        targetZ: parentWorld.z + weightedCenter.z * object.transform.scaleZ,
        boundsSize: effectiveMaxDim * maxScale,
      };
    }
  } catch (error) {
    // Fall back to primitive defaults
    console.warn('[Focus] Failed to load model for camera focus target:', error);
  }

  return focusTarget;
}

/**
 * Check if a Three.js object has actual renderable geometry.
 * Returns true only if there are meshes with vertices.
 */
function hasActualGeometry(obj: THREE.Object3D): boolean {
  let found = false;
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      if (posAttr && posAttr.count > 0) {
        found = true;
      }
    }
  });
  return found;
}

/**
 * Calculate bounding box only from meshes with actual geometry.
 * This excludes empty transforms, cameras, lights, etc. that might have positions
 * but no visible geometry.
 */
function calculateVisibleBounds(obj: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      // Only include meshes with actual vertices
      if (posAttr && posAttr.count > 0) {
        child.geometry.computeBoundingBox();
        const geomBox = child.geometry.boundingBox;
        if (geomBox && !geomBox.isEmpty()) {
          // Transform geometry bounding box to world space
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
 * Returns a center that represents where the visual bulk of the model is.
 */
function calculateWeightedCenter(obj: THREE.Object3D): THREE.Vector3 {
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

          // Transform center to world space
          center.applyMatrix4(child.matrixWorld);

          // Use volume as weight (larger meshes contribute more)
          const volume = Math.max(size.x * size.y * size.z, 0.0001); // Prevent zero
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
 * Calculate focus target for a child mesh within a model.
 */
function calculateChildFocusTarget(
  object: SceneObject,
  parentWorld: { x: number; y: number; z: number },
  model: THREE.Object3D,
  childPath: string,
  modelHeight: number,
  modelMaxDimension: number
): FocusTarget {
  const pathArray = stringToPath(childPath);
  const childMesh = findChildByPath(model, pathArray);

  // Fallback to parent metrics
  const fallback: FocusTarget = {
    targetX: parentWorld.x,
    targetY: parentWorld.y + modelHeight / 2,
    targetZ: parentWorld.z,
    boundsSize: modelMaxDimension,
  };

  if (!childMesh) {
    console.warn('[Focus] Child not found, using parent bounds:', childPath);
    return fallback;
  }

  // Check if this child has actual geometry - skip empty transforms
  if (!hasActualGeometry(childMesh)) {
    console.warn('[Focus] Child has no geometry, using parent bounds:', childPath);
    return fallback;
  }

  // Apply child's local transform if modified
  const childData = object.children?.find((c) => c.path.join('.') === childPath);
  if (childData?.localTransform) {
    const lt = childData.localTransform;
    childMesh.position.set(lt.x / 100, lt.y / 100, -lt.z / 100);
  }

  // Compute bounding box from only visible geometry (excludes empty transforms)
  const childBox = calculateVisibleBounds(childMesh);

  // Validate the bounding box - check for empty or infinite values
  if (childBox.isEmpty()) {
    console.warn('[Focus] Child has empty visible bounds, using parent bounds:', childPath);
    return fallback;
  }

  const childSize = childBox.getSize(new THREE.Vector3());

  // Check for invalid/infinite values
  if (
    !isFinite(childSize.x) ||
    !isFinite(childSize.y) ||
    !isFinite(childSize.z) ||
    childSize.length() === 0
  ) {
    console.warn('[Focus] Child has invalid bounds, using parent bounds:', childPath);
    return fallback;
  }

  // Use volume-weighted center (same as root object focus)
  const weightedCenter = calculateWeightedCenter(childMesh);

  // Validate weighted center
  if (!isFinite(weightedCenter.x) || !isFinite(weightedCenter.y) || !isFinite(weightedCenter.z)) {
    console.warn('[Focus] Child has invalid weighted center, using parent bounds:', childPath);
    return fallback;
  }

  const maxScale = Math.max(
    object.transform.scaleX,
    object.transform.scaleY,
    object.transform.scaleZ
  );

  // Apply aspect ratio capping for elongated child parts
  const dims = [childSize.x, childSize.y, childSize.z].sort((a, b) => b - a);
  const largest = dims[0];
  const secondLargest = dims[1];

  let effectiveBoundsSize: number;
  if (largest > secondLargest * 2.5 && secondLargest > 0) {
    // Cap at 1.5x the second largest dimension
    effectiveBoundsSize = secondLargest * 1.5;
  } else {
    effectiveBoundsSize = Math.max(childSize.x, childSize.y, childSize.z);
  }

  return {
    targetX: parentWorld.x + weightedCenter.x * object.transform.scaleX,
    targetY: parentWorld.y + weightedCenter.y * object.transform.scaleY,
    targetZ: parentWorld.z + weightedCenter.z * object.transform.scaleZ,
    boundsSize: effectiveBoundsSize * maxScale,
  };
}
