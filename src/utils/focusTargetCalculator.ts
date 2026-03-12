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
import { SceneObject, Transform, stringToPath } from '../types';
import { FocusTarget, sceneToWorldCoordinates } from './focusUtils';
import { getOrLoadModelForComputation } from './modelCache';
import { findChildByPath } from './modelLoaders';

interface TaggedSceneUserData {
  objectId?: unknown;
  sceneObjectId?: unknown;
  childPath?: unknown;
}

interface SceneFocusAnalysis {
  visibleBox: THREE.Box3;
  weightedCenter: THREE.Vector3;
}

function isDefaultLocalTransform(t: Transform): boolean {
  return (
    t.x === 0 &&
    t.y === 0 &&
    t.z === 0 &&
    t.rotationX === 0 &&
    t.rotationY === 0 &&
    t.rotationZ === 0 &&
    t.scaleX === 1 &&
    t.scaleY === 1 &&
    t.scaleZ === 1
  );
}

/**
 * Compute pivot points for a mesh/group in its parent's local space.
 * Mirrors the logic used by `ImportedModel.tsx` so focus targets match rendered transforms.
 */
function computeMeshPivots(mesh: THREE.Object3D): { localCenter: THREE.Vector3; localBase: THREE.Vector3 } {
  // Reset to identity to get the "base" bounding box (matches ImportedModel behavior).
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
    const parentInv = parent.matrixWorld.clone().invert();
    localCenter.applyMatrix4(parentInv);
    localBase.applyMatrix4(parentInv);
  }

  return { localCenter, localBase };
}

function calculateRotationOffset(pivot: THREE.Vector3, rotation: THREE.Euler): THREE.Vector3 {
  const rotatedPivot = pivot.clone().applyEuler(rotation);
  return pivot.clone().sub(rotatedPivot);
}

function calculateScaleOffset(
  pivot: THREE.Vector3,
  scale: { x: number; y: number; z: number }
): THREE.Vector3 {
  return new THREE.Vector3(pivot.x * (1 - scale.x), pivot.y * (1 - scale.y), pivot.z * (1 - scale.z));
}

/**
 * Apply user child localTransforms to the cloned model instance for focus calculations.
 *
 * This mirrors `ImportedModel.tsx` (pivot-aware rotation + base-aware scaling) so the focus
 * target remains correct even when users rotate/scale child groups.
 */
function applyChildLocalTransformsForFocus(model: THREE.Object3D, object: SceneObject): void {
  if (!object.children || object.children.length === 0) return;

  for (const child of object.children) {
    const lt = child.localTransform;
    if (isDefaultLocalTransform(lt)) continue;

    const meshObj = findChildByPath(model, child.path);
    if (!meshObj) continue;

    const userOffset = new THREE.Vector3(lt.x / 100, lt.y / 100, -lt.z / 100);
    const { localCenter, localBase } = computeMeshPivots(meshObj);

    const rotationEuler = new THREE.Euler(
      THREE.MathUtils.degToRad(lt.rotationX),
      THREE.MathUtils.degToRad(lt.rotationY),
      THREE.MathUtils.degToRad(lt.rotationZ),
      'XYZ'
    );

    const rotationOffset = calculateRotationOffset(localCenter, rotationEuler);
    const scaleOffset = calculateScaleOffset(localBase, { x: lt.scaleX, y: lt.scaleY, z: lt.scaleZ });

    meshObj.position.set(
      userOffset.x + rotationOffset.x + scaleOffset.x,
      userOffset.y + rotationOffset.y + scaleOffset.y,
      userOffset.z + rotationOffset.z + scaleOffset.z
    );
    meshObj.rotation.copy(rotationEuler);
    meshObj.scale.set(lt.scaleX, lt.scaleY, lt.scaleZ);
  }
}

/**
 * Convert a point in model-local space to world space, mirroring the two-group structure in
 * `ImportedModel.tsx`:
 * - Outer group: positioned at pivotWorldY (ground + modelHeight/2), applies rotation + scale
 * - Inner group: offsets model by -modelHeight/2 to keep bottom grounded during transforms
 */
function modelLocalPointToWorld(params: {
  object: SceneObject;
  parentWorld: { x: number; y: number; z: number };
  modelHeight: number;
  point: THREE.Vector3;
}): THREE.Vector3 {
  const { object, parentWorld, modelHeight, point } = params;

  const pivotWorldY = parentWorld.y + modelHeight / 2;
  const outerPos = new THREE.Vector3(parentWorld.x, pivotWorldY, parentWorld.z);

  const innerOffset = new THREE.Vector3(0, -modelHeight / 2, 0);
  const delta = point.clone().add(innerOffset);

  // Apply outer scale (component-wise), then outer rotation, then translation.
  delta.set(
    delta.x * object.transform.scaleX,
    delta.y * object.transform.scaleY,
    delta.z * object.transform.scaleZ
  );

  const outerRot = new THREE.Euler(
    THREE.MathUtils.degToRad(object.transform.rotationX),
    THREE.MathUtils.degToRad(object.transform.rotationY),
    THREE.MathUtils.degToRad(object.transform.rotationZ),
    'XYZ'
  );
  delta.applyEuler(outerRot);

  return outerPos.add(delta);
}

function isRenderableMesh(mesh: THREE.Mesh): boolean {
  const posAttr = mesh.geometry?.attributes.position;
  return !!posAttr && posAttr.count > 0;
}

function isChildPathWithinSubtree(targetChildPath: string | undefined, hitChildPath: string | null): boolean {
  if (!targetChildPath) return true;
  if (!hitChildPath) return false;
  return hitChildPath === targetChildPath || hitChildPath.startsWith(targetChildPath + '.');
}

function collectSceneFocusMeshes(
  objectRoot: THREE.Object3D,
  objectId: string,
  childPath?: string
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  objectRoot.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !isRenderableMesh(node)) return;
    const userData = node.userData as TaggedSceneUserData | undefined;
    if (userData?.sceneObjectId !== objectId) return;

    const taggedChildPath = typeof userData.childPath === 'string' ? userData.childPath : null;
    if (!isChildPathWithinSubtree(childPath, taggedChildPath)) return;

    meshes.push(node);
  });

  return meshes;
}

function findObjectRootInScene(scene: THREE.Scene, objectId: string): THREE.Object3D | null {
  let objectRoot: THREE.Object3D | null = null;

  scene.traverse((node) => {
    const userData = node.userData as TaggedSceneUserData | undefined;
    if (userData?.objectId === objectId) {
      objectRoot = node;
    }
  });

  return objectRoot;
}

function getMeshBoundingBox(mesh: THREE.Mesh): THREE.Box3 | null {
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }
  const geomBox = mesh.geometry.boundingBox;
  return geomBox && !geomBox.isEmpty() ? geomBox : null;
}

function analyzeSceneFocusMeshes(meshes: THREE.Mesh[]): SceneFocusAnalysis {
  const visibleBox = new THREE.Box3();
  let totalVolume = 0;
  const weightedSum = new THREE.Vector3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const box = getMeshBoundingBox(mesh);
    if (box) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const worldBox = box.clone();
      worldBox.applyMatrix4(mesh.matrixWorld);
      visibleBox.union(worldBox);

      center.applyMatrix4(mesh.matrixWorld);
      const volume = Math.max(size.x * size.y * size.z, 0.0001);
      weightedSum.addScaledVector(center, volume);
      totalVolume += volume;
    }
  }

  if (totalVolume > 0) {
    weightedSum.divideScalar(totalVolume);
  }

  return {
    visibleBox,
    weightedCenter: weightedSum,
  };
}

function calculateEffectiveBoundsSize(size: THREE.Vector3, fallback: number): number {
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  const largest = dims[0];
  const secondLargest = dims[1];

  if (largest > secondLargest * 2.5 && secondLargest > 0) {
    return secondLargest * 1.5;
  }

  return Math.max(largest, fallback);
}

/**
 * Derive a focus target directly from the live scene graph for an already-rendered object.
 *
 * This avoids model-cache cloning for the common editor path and respects child-subtree targeting
 * via the `sceneObjectId` / `childPath` tags attached during model rendering.
 */
export function calculateFocusTargetFromScene(params: {
  scene: THREE.Scene;
  objectId: string;
  childPath?: string;
}): FocusTarget | null {
  const { scene, objectId, childPath } = params;
  const objectRoot = findObjectRootInScene(scene, objectId);

  if (!objectRoot) return null;

  objectRoot.updateWorldMatrix(true, true);
  const meshes = collectSceneFocusMeshes(objectRoot, objectId, childPath);
  if (meshes.length === 0) return null;

  const { visibleBox, weightedCenter } = analyzeSceneFocusMeshes(meshes);
  if (visibleBox.isEmpty()) return null;

  const visibleSize = visibleBox.getSize(new THREE.Vector3());
  if (!isFinite(weightedCenter.x) || !isFinite(weightedCenter.y) || !isFinite(weightedCenter.z)) {
    return null;
  }

  return {
    targetX: weightedCenter.x,
    targetY: weightedCenter.y,
    targetZ: weightedCenter.z,
    boundsSize: calculateEffectiveBoundsSize(visibleSize, 1),
  };
}

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
    const { model, metrics } = await getOrLoadModelForComputation(object.properties.modelAssetId);
    const modelHeight = metrics.size.y;
    // IMPORTANT: Imported models are rendered with a two-group structure in `ImportedModel.tsx`:
    // - Outer group Y is placed at (groundY + modelHeight/2)
    // - Inner group offsets the model by (-modelHeight/2)
    // This makes the model visually centered around the outer group's origin, so scaling does NOT
    // shift the model up/down relative to the ground. Focus target math must mirror that layout,
    // otherwise focus height will drift when users change scale in the editor.
    const maxScale = Math.max(
      object.transform.scaleX,
      object.transform.scaleY,
      object.transform.scaleZ
    );

    // IMPORTANT: Focus uses a cloned model instance. Apply child localTransforms here so bounds/centers
    // reflect user edits (rotate/scale of child groups, etc.).
    applyChildLocalTransformsForFocus(model, object);

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
    const effectiveMaxDim = calculateEffectiveBoundsSize(
      visibleSize,
      visibleMaxDim > 0 ? visibleMaxDim : metrics.maxDimension
    );

    if (childPath) {
      // Child focus: find and compute bounds for specific child mesh
      focusTarget = calculateChildFocusTarget(
        object,
        parentWorld,
        model,
        childPath,
        modelHeight,
        effectiveMaxDim
      );
    } else {
      // Root object focus: use volume-weighted center (where the bulk of geometry is)
      const worldPoint = modelLocalPointToWorld({
        object,
        parentWorld,
        modelHeight,
        point: weightedCenter,
      });

      focusTarget = {
        targetX: worldPoint.x,
        targetY: worldPoint.y,
        targetZ: worldPoint.z,
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
        const geomBox = getMeshBoundingBox(child);
        if (geomBox) {
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
        const box = getMeshBoundingBox(child);
        if (box) {
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

  const worldPoint = modelLocalPointToWorld({
    object,
    parentWorld,
    modelHeight,
    point: weightedCenter,
  });

  return {
    targetX: worldPoint.x,
    targetY: worldPoint.y,
    targetZ: worldPoint.z,
    boundsSize: effectiveBoundsSize * maxScale,
  };
}
