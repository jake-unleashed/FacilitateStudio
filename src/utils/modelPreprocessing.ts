/**
 * Model Preprocessing Utility
 *
 * Comprehensive preprocessing pipeline to normalize 3D models for consistent,
 * user-friendly display in the scene. Handles scaling, pivot centering, ground
 * alignment, and orientation normalization.
 */

import * as THREE from 'three';
import { MODEL_TARGET_SIZE } from '../constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV ?? process.env.NODE_ENV === 'development';

export interface ModelMetrics {
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  bottomY: number;
  topY: number;
  maxDimension: number;
  triangleCount?: number;
}

export interface PreprocessedModel {
  model: THREE.Group;
  metrics: ModelMetrics;
  originalScale: number; // Scale factor applied during preprocessing
}

/**
 * Calculate bounding box for a model
 * Forces recalculation of all geometry bounding boxes to avoid stale values.
 */
function getModelBoundingBox(model: THREE.Group): THREE.Box3 {
  // Force all world matrices to be up to date
  model.updateMatrixWorld(true);

  // Force recalculation of all geometry bounding boxes
  // This is necessary because BufferGeometry caches bounding boxes
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      child.geometry.computeBoundingBox();
      child.geometry.computeBoundingSphere();
    }
  });

  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

/**
 * Count triangles in a model (for complexity checking)
 */
function countTriangles(model: THREE.Group): number {
  let count = 0;
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      if (geometry.index) {
        count += geometry.index.count / 3;
      } else {
        count += geometry.attributes.position.count / 3;
      }
    }
  });
  return count;
}

/**
 * Calculate model metrics
 */
export function calculateModelMetrics(model: THREE.Group): ModelMetrics {
  const boundingBox = getModelBoundingBox(model);
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z);
  const triangleCount = countTriangles(model);

  return {
    boundingBox,
    center,
    size,
    bottomY: boundingBox.min.y,
    topY: boundingBox.max.y,
    maxDimension,
    triangleCount,
  };
}

/**
 * Center model pivot point to bounding box center
 * This ensures rotation/scaling happens around the visual center
 * Returns the offset that was applied (for tracking)
 */
export function centerModelPivot(model: THREE.Group): THREE.Vector3 {
  const box = getModelBoundingBox(model);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Store the center offset for later use
  const offset = center.clone();

  // Translate all geometry so center is at origin
  // We need to update geometry vertices, not just position
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        // Translate vertices
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

  // Reset model position to origin (since geometry is now centered)
  model.position.set(0, 0, 0);

  return offset;
}

/**
 * Log detailed hierarchy information for debugging
 */
function logModelHierarchy(model: THREE.Group, label: string): void {
  console.group(`[modelPreprocessing] ${label} - Model Hierarchy`);

  // Log root transform
  console.log('Root transform:', {
    position: `(${model.position.x.toFixed(4)}, ${model.position.y.toFixed(4)}, ${model.position.z.toFixed(4)})`,
    rotation: `(${model.rotation.x.toFixed(4)}, ${model.rotation.y.toFixed(4)}, ${model.rotation.z.toFixed(4)})`,
    scale: `(${model.scale.x.toFixed(6)}, ${model.scale.y.toFixed(6)}, ${model.scale.z.toFixed(6)})`,
  });

  // Find all transforms in hierarchy
  const transforms: Array<{ name: string; depth: number; scale: string; position: string }> = [];
  let meshCount = 0;
  let totalVertices = 0;

  model.traverse((child: THREE.Object3D) => {
    // Calculate depth
    let depth = 0;
    let parent = child.parent;
    while (parent) {
      depth++;
      parent = parent.parent;
    }

    // Log non-identity transforms
    const hasNonIdentityScale =
      Math.abs(child.scale.x - 1) > 0.0001 ||
      Math.abs(child.scale.y - 1) > 0.0001 ||
      Math.abs(child.scale.z - 1) > 0.0001;
    const hasPosition =
      Math.abs(child.position.x) > 0.0001 ||
      Math.abs(child.position.y) > 0.0001 ||
      Math.abs(child.position.z) > 0.0001;

    if (hasNonIdentityScale || hasPosition) {
      transforms.push({
        name: child.name || child.type,
        depth,
        scale: `(${child.scale.x.toFixed(4)}, ${child.scale.y.toFixed(4)}, ${child.scale.z.toFixed(4)})`,
        position: `(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`,
      });
    }

    if (child instanceof THREE.Mesh && child.geometry) {
      meshCount++;
      const posAttr = child.geometry.attributes.position;
      if (posAttr) {
        totalVertices += posAttr.count;
      }
    }
  });

  console.log(`Meshes: ${meshCount}, Total vertices: ${totalVertices}`);

  if (transforms.length > 0) {
    console.log('Non-identity transforms in hierarchy:');
    transforms.forEach((t) => {
      console.log(`  ${'  '.repeat(t.depth)}${t.name}: scale=${t.scale}, pos=${t.position}`);
    });
  } else {
    console.log('All transforms are identity (scale=1, position=0)');
  }

  console.groupEnd();
}

/**
 * Check if an object has any mesh geometry with actual vertices in its descendants.
 * Used to identify empty transform nodes that should be removed during preprocessing.
 *
 * @param obj - The Three.js object to check
 * @returns True if the object or any descendant has geometry with vertices
 */
function hasGeometryDescendants(obj: THREE.Object3D): boolean {
  if (obj instanceof THREE.Mesh && obj.geometry) {
    const positionAttr = obj.geometry.attributes.position;
    return positionAttr && positionAttr.count > 0;
  }

  for (const child of obj.children) {
    if (hasGeometryDescendants(child)) {
      return true;
    }
  }

  return false;
}

/**
 * Remove helper objects that have no geometry descendants.
 *
 * CAD software (SolidWorks, Fusion 360, etc.) often exports view presets,
 * cameras, lights, and other helper objects that have transforms but no
 * actual geometry. These can throw off bounding box calculations.
 *
 * Common patterns for helper objects:
 * - Names starting with * (view presets like *Front, *Top, *Isometric)
 * - Names starting with - (like -Home)
 * - Empty groups with non-identity transforms
 *
 * @returns The number of objects removed
 */
function removeHelperObjects(model: THREE.Group): number {
  let removedCount = 0;
  const objectsToRemove: THREE.Object3D[] = [];

  // First pass: identify objects to remove
  // Remove ALL objects without geometry descendants - they serve no visual purpose
  // and can cause focus/bounding box issues
  model.traverse((child: THREE.Object3D) => {
    // Skip the root model itself
    if (child === model) return;

    // Check if this object has no geometry descendants
    // This removes CAD view presets, cameras, lights, empty groups, etc.
    if (!hasGeometryDescendants(child)) {
      objectsToRemove.push(child);
    }
  });

  // Second pass: remove identified objects
  for (const obj of objectsToRemove) {
    if (obj.parent) {
      if (IS_DEV) {
        console.log(`[modelPreprocessing] Removing empty object: "${obj.name || obj.type}"`);
      }
      obj.parent.remove(obj);
      removedCount++;
    }
  }

  return removedCount;
}

/**
 * Bake all transforms into geometry vertices
 *
 * This function "flattens" the model by:
 * 1. Computing the world matrix for each mesh
 * 2. Applying the world matrix directly to vertex positions
 * 3. Resetting all transforms to identity
 *
 * This eliminates issues with nested transform hierarchies that can cause
 * inconsistent behavior when models are added to different scene graphs.
 */
function bakeTransformsIntoGeometry(model: THREE.Group): void {
  // Ensure world matrices are up to date
  model.updateMatrixWorld(true);

  // Process all meshes
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        // Get the world matrix for this mesh
        const worldMatrix = child.matrixWorld.clone();

        // Apply world matrix to all vertices
        const vertex = new THREE.Vector3();
        for (let i = 0; i < positionAttribute.count; i++) {
          vertex.set(
            positionAttribute.getX(i),
            positionAttribute.getY(i),
            positionAttribute.getZ(i)
          );
          vertex.applyMatrix4(worldMatrix);
          positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        positionAttribute.needsUpdate = true;

        // Also transform normals if present
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

  // Reset all transforms to identity (geometry now contains world-space positions)
  model.traverse((child: THREE.Object3D) => {
    child.position.set(0, 0, 0);
    child.rotation.set(0, 0, 0);
    child.scale.set(1, 1, 1);
    child.updateMatrix();
  });

  // Update world matrices after resetting
  model.updateMatrixWorld(true);
}

/**
 * Auto-scale model to target size
 * Preserves aspect ratio and handles edge cases
 *
 * This function ensures consistent normalization by:
 * 1. Baking all transforms into geometry to eliminate nested scale issues
 * 2. Computing the world-space bounding box
 * 3. Scaling geometry vertices directly to achieve target size
 *
 * @returns The scale factor applied to normalize the model
 */
export function autoScaleModel(model: THREE.Group, targetSize: number = MODEL_TARGET_SIZE): number {
  // Ensure all transforms in the hierarchy are up to date
  model.updateMatrixWorld(true);

  // Log hierarchy before any processing
  logModelHierarchy(model, 'BEFORE auto-scale');

  // Step 0: Remove helper objects (CAD view presets, cameras, etc.)
  // These have transforms but no geometry and can throw off bounding box calculations
  const removedCount = removeHelperObjects(model);
  if (IS_DEV && removedCount > 0) {
    console.log(`[modelPreprocessing] Removed ${removedCount} helper objects`);
  }

  // Step 1: Bake all transforms into geometry
  // This eliminates issues with nested scales (e.g., 1000 at root, 0.001 at child)
  if (IS_DEV) console.log('[modelPreprocessing] Baking transforms into geometry...');
  bakeTransformsIntoGeometry(model);

  // Calculate world-space bounding box using robust method (forces fresh calculation)
  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const rawMaxDimension = Math.max(size.x, size.y, size.z);

  // Apply aspect ratio capping: if one dimension is extremely elongated
  // (like tiny screws extending far above the main body), use a capped value
  // This prevents small parts at extreme positions from making the model too small
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  const largest = dims[0];
  const secondLargest = dims[1];

  let effectiveMaxDimension: number;
  if (largest > secondLargest * 2.5 && secondLargest > 0) {
    // Cap at 1.5x the second largest dimension
    effectiveMaxDimension = secondLargest * 1.5;
    if (IS_DEV) {
      console.log('[modelPreprocessing] Aspect ratio cap applied for scaling:', {
        largest: largest.toFixed(2),
        secondLargest: secondLargest.toFixed(2),
        capped: effectiveMaxDimension.toFixed(2),
      });
    }
  } else {
    effectiveMaxDimension = rawMaxDimension;
  }

  // Debug logging for troubleshooting
  if (IS_DEV) {
    console.log('[modelPreprocessing] World-space bounds (after baking):', {
      min: `(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)})`,
      max: `(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`,
      size: `(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`,
      center: `(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
      rawMaxDimension: rawMaxDimension.toFixed(2),
      effectiveMaxDimension: effectiveMaxDimension.toFixed(2),
    });
  }

  // Handle edge cases: zero size, NaN, or Infinity
  if (effectiveMaxDimension <= 0 || !isFinite(effectiveMaxDimension)) {
    console.warn('[modelPreprocessing] Model has invalid size, using default scale');
    return 1.0;
  }

  // Calculate scale factor to reach target size using EFFECTIVE dimension
  // (capped if extreme outliers are present)
  const scaleFactor = targetSize / effectiveMaxDimension;

  if (IS_DEV) {
    console.log('[modelPreprocessing] Scale calculation:', {
      targetSize,
      effectiveMaxDimension: effectiveMaxDimension.toFixed(2),
      scaleFactor: scaleFactor.toFixed(8),
    });
  }

  // Step 2: Apply scale factor directly to geometry vertices
  // This ensures the scale is "baked in" and can't be affected by parent transforms
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        for (let i = 0; i < positionAttribute.count; i++) {
          positionAttribute.setX(i, positionAttribute.getX(i) * scaleFactor);
          positionAttribute.setY(i, positionAttribute.getY(i) * scaleFactor);
          positionAttribute.setZ(i, positionAttribute.getZ(i) * scaleFactor);
        }
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }
    }
  });

  // Verify the result using the robust bounding box calculation
  const verifyBox = getModelBoundingBox(model);
  const verifySize = new THREE.Vector3();
  verifyBox.getSize(verifySize);

  const actualMaxDimension = Math.max(verifySize.x, verifySize.y, verifySize.z);
  if (IS_DEV) {
    console.log('[modelPreprocessing] AFTER scaling - verification:', {
      newSize: `(${verifySize.x.toFixed(2)}, ${verifySize.y.toFixed(2)}, ${verifySize.z.toFixed(2)})`,
      newMaxDimension: actualMaxDimension.toFixed(2),
      expectedMaxDimension: targetSize.toFixed(2),
      match: Math.abs(actualMaxDimension - targetSize) < 0.01 ? 'OK' : 'MISMATCH',
    });
  }

  // Log hierarchy after processing
  logModelHierarchy(model, 'AFTER auto-scale');

  return scaleFactor;
}

/**
 * Align model to ground plane (bottom at y=0)
 * Modifies geometry vertices directly since transforms are baked.
 */
export function alignModelToGround(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const minY = box.min.y;

  // Translate all geometry vertices up so bottom is at y=0
  // We modify geometry directly since transforms are now identity
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

/**
 * Normalize model orientation to ensure +Y is up
 * Detects if model is lying down and rotates if needed
 */
export function normalizeModelOrientation(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  // If model is wider than tall, it might be lying down
  // Check if X or Z is the "up" dimension
  if (size.x > size.y * 1.5 && size.x > size.z * 1.5) {
    // Model is lying along X axis, rotate 90 degrees around Z
    model.rotateZ(Math.PI / 2);
  } else if (size.z > size.y * 1.5 && size.z > size.x * 1.5) {
    // Model is lying along Z axis, rotate 90 degrees around X
    model.rotateX(-Math.PI / 2);
  }

  // Ensure +Y is up (check if model is upside down)
  // This is a heuristic - if bottom is higher than top after rotation, flip
  const newBox = getModelBoundingBox(model);
  if (newBox.max.y < newBox.min.y + 0.1) {
    // Model might be upside down, rotate 180 degrees around X
    model.rotateX(Math.PI);
  }
}

/**
 * Disable animations in model (if present)
 */
export function disableModelAnimations(model: THREE.Group): void {
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.SkinnedMesh) {
      // Disable skeleton animations
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

/**
 * Validate model before preprocessing
 */
export function validateModel(model: THREE.Group): {
  valid: boolean;
  error?: string;
} {
  // Ensure all transforms are up to date before validation
  model.updateMatrixWorld(true);

  // Check if model has geometry
  let hasGeometry = false;
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      hasGeometry = true;
    }
  });

  if (!hasGeometry) {
    return { valid: false, error: 'Model has no geometry' };
  }

  // Check bounding box
  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (maxDimension <= 0 || !isFinite(maxDimension)) {
    return { valid: false, error: 'Model has zero or invalid size' };
  }

  // Check for invalid values
  if (
    !isFinite(box.min.x) ||
    !isFinite(box.max.x) ||
    !isFinite(box.min.y) ||
    !isFinite(box.max.y) ||
    !isFinite(box.min.z) ||
    !isFinite(box.max.z)
  ) {
    return { valid: false, error: 'Model has invalid geometry (NaN or Infinity)' };
  }

  return { valid: true };
}

/**
 * Main preprocessing pipeline
 * Applies all normalization steps in the correct order
 */
export function preprocessModel(
  model: THREE.Group,
  targetSize: number = MODEL_TARGET_SIZE
): PreprocessedModel {
  if (IS_DEV) {
    console.group('[modelPreprocessing] ========== PREPROCESSING PIPELINE START ==========');
    console.log('Target size:', targetSize);
  }

  // Validate model first
  const validation = validateModel(model);
  if (!validation.valid) {
    if (IS_DEV) console.groupEnd();
    throw new Error(`Invalid model: ${validation.error}`);
  }

  // Clone model to avoid modifying original
  const processedModel = model.clone();
  if (IS_DEV) console.log('Model cloned successfully');

  // NOTE: We intentionally skip centerModelPivot() here.
  // The previous implementation had a coordinate space bug where world-space center
  // was subtracted from local-space vertex positions, which corrupts models with
  // non-identity transforms in their hierarchy (very common with FBX models).
  // The ImportedModel component handles pivot centering at render time instead.

  // Step 1: Auto-scale to target size (must be first, before any other transforms)
  if (IS_DEV) console.log('--- Step 1: Auto-scale ---');
  const originalScale = autoScaleModel(processedModel, targetSize);

  // Step 2: Align to ground plane (bottom at y=0)
  if (IS_DEV) console.log('--- Step 2: Align to ground ---');
  alignModelToGround(processedModel);

  // Step 3: Normalize orientation (skip for now - can cause unexpected rotations)
  // normalizeModelOrientation(processedModel);

  // Step 4: Disable animations
  disableModelAnimations(processedModel);

  // Step 5: Recalculate metrics after all transformations
  if (IS_DEV) console.log('--- Step 3: Final metrics ---');
  const metrics = calculateModelMetrics(processedModel);

  if (IS_DEV) {
    console.log('[modelPreprocessing] FINAL STATE:', {
      boundingBox: {
        min: `(${metrics.boundingBox.min.x.toFixed(2)}, ${metrics.boundingBox.min.y.toFixed(2)}, ${metrics.boundingBox.min.z.toFixed(2)})`,
        max: `(${metrics.boundingBox.max.x.toFixed(2)}, ${metrics.boundingBox.max.y.toFixed(2)}, ${metrics.boundingBox.max.z.toFixed(2)})`,
      },
      size: `(${metrics.size.x.toFixed(2)}, ${metrics.size.y.toFixed(2)}, ${metrics.size.z.toFixed(2)})`,
      maxDimension: metrics.maxDimension.toFixed(2),
      scaleApplied: originalScale.toFixed(8),
      rootScale: `(${processedModel.scale.x.toFixed(8)}, ${processedModel.scale.y.toFixed(8)}, ${processedModel.scale.z.toFixed(8)})`,
    });
    console.log('[modelPreprocessing] ========== PREPROCESSING PIPELINE END ==========');
    console.groupEnd();
  }

  return {
    model: processedModel,
    metrics,
    originalScale,
  };
}
