/**
 * Model Preprocessing Utility
 *
 * Comprehensive preprocessing pipeline to normalize 3D models for consistent,
 * user-friendly display in the scene. Handles scaling, pivot centering, ground
 * alignment, and orientation normalization.
 */

import * as THREE from 'three';
import {
  MODEL_TARGET_SIZE,
  MODEL_MIN_SIZE,
  MODEL_MAX_SIZE,
  MODEL_COMPLEXITY_WARNING_THRESHOLD,
} from '../constants';

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
 */
function getModelBoundingBox(model: THREE.Group | THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

/**
 * Count triangles in a model (for complexity checking)
 */
function countTriangles(model: THREE.Group | THREE.Object3D): number {
  let count = 0;
  model.traverse((child) => {
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
  model.traverse((child) => {
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
 * Auto-scale model to target size
 * Preserves aspect ratio and handles edge cases
 */
export function autoScaleModel(model: THREE.Group, targetSize: number = MODEL_TARGET_SIZE): number {
  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z);

  // Handle edge cases
  if (maxDimension <= 0) {
    console.warn('[modelPreprocessing] Model has zero or negative size, using default scale');
    return 1.0;
  }

  // Calculate scale factor
  const scaleFactor = targetSize / maxDimension;

  // Clamp scale to prevent models that are too small or too large
  const clampedScale = Math.max(
    MODEL_MIN_SIZE / maxDimension,
    Math.min(scaleFactor, MODEL_MAX_SIZE / maxDimension)
  );

  // Apply uniform scale
  model.scale.multiplyScalar(clampedScale);

  return clampedScale;
}

/**
 * Align model to ground plane (bottom at y=0)
 * Should be called after pivot centering
 */
export function alignModelToGround(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const minY = box.min.y;

  // Translate model up so bottom is at y=0
  model.position.y -= minY;
}

/**
 * Normalize model orientation to ensure +Y is up
 * Detects if model is lying down and rotates if needed
 */
export function normalizeModelOrientation(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Determine primary orientation
  const maxDim = Math.max(size.x, size.y, size.z);
  const isFlat = maxDim / Math.min(size.x, size.y, size.z) > 5; // Very flat model

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
  model.traverse((child) => {
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
export function validateModel(model: THREE.Group | THREE.Object3D): {
  valid: boolean;
  error?: string;
} {
  // Check if model has geometry
  let hasGeometry = false;
  model.traverse((child) => {
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

  if (maxDimension <= 0) {
    return { valid: false, error: 'Model has zero size' };
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
  // Validate model first
  const validation = validateModel(model);
  if (!validation.valid) {
    throw new Error(`Invalid model: ${validation.error}`);
  }

  // Clone model to avoid modifying original
  const processedModel = model.clone();

  // Step 1: Center pivot point (geometry centered at origin)
  centerModelPivot(processedModel);

  // Step 2: Auto-scale to target size
  const originalScale = autoScaleModel(processedModel, targetSize);

  // Step 3: Align to ground plane (move geometry so bottom is at y=0)
  // After this, the model's visual center will be at (0, height/2, 0) where height is the model height
  alignModelToGround(processedModel);

  // Step 4: Normalize orientation
  normalizeModelOrientation(processedModel);

  // Step 5: Disable animations
  disableModelAnimations(processedModel);

  // Step 6: Recalculate metrics after all transformations
  const metrics = calculateModelMetrics(processedModel);

  return {
    model: processedModel,
    metrics,
    originalScale,
  };
}
