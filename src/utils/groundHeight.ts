/**
 * Ground Height Utilities
 *
 * This module provides utilities for calculating ground-relative positioning
 * of 3D objects. These are used primarily as fallbacks when the actual 3D
 * bounding box is not available.
 *
 * IMPORTANT: For accurate ground positioning, prefer using the actual Three.js
 * bounding box (box.min.y) when the 3D scene is available. These utilities
 * provide approximations based on model dimensions.
 *
 * @module groundHeight
 */

import * as THREE from 'three';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default model height used when actual model height is not available.
 * This corresponds to the MODEL_TARGET_SIZE used during model preprocessing.
 * Models are normalized to fit within a 2.0 world unit bounding box.
 */
export const DEFAULT_MODEL_HEIGHT = 2.0;

/**
 * Conversion factor between internal units and world units.
 * Internal units use 100 = 1 world unit (meter).
 */
export const INTERNAL_TO_WORLD = 100;

// ============================================================================
// Bounding Box Approximation
// ============================================================================

/**
 * Calculates how far below the object's center the lowest point of the mesh is,
 * taking into account rotation, scale, and actual model dimensions.
 *
 * This is an APPROXIMATION that assumes the model is a cube. For accurate
 * results, use the actual Three.js bounding box when available.
 *
 * The model is assumed to be a cube with the given height, centered at origin.
 * The 8 corners are at (±height/2, ±height/2, ±height/2).
 * After applying scale and rotation, we find which corner is lowest (minimum Y).
 *
 * @param rotationX - Rotation around X axis in degrees
 * @param rotationY - Rotation around Y axis in degrees
 * @param rotationZ - Rotation around Z axis in degrees
 * @param scaleX - Scale factor on X axis
 * @param scaleY - Scale factor on Y axis
 * @param scaleZ - Scale factor on Z axis
 * @param modelHeight - The base height of the model in world units (default: 2.0)
 * @returns The Y offset of the lowest point from the center (always negative or zero)
 *
 * @example
 * // For an unrotated, unscaled model with height 2.0:
 * calculateLowestPointOffset(0, 0, 0, 1, 1, 1, 2.0) // returns -1.0
 *
 * // For a 45° X-rotated model:
 * calculateLowestPointOffset(45, 0, 0, 1, 1, 1, 2.0) // returns approximately -1.414
 */
export const calculateLowestPointOffset = (
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  modelHeight: number = DEFAULT_MODEL_HEIGHT
): number => {
  // Use modelHeight to determine the half-extent
  // Assume a cubic bounding box for simplicity
  const halfExtent = modelHeight / 2;

  // Define the 8 corners of the bounding box centered at origin
  const corners = [
    new THREE.Vector3(-halfExtent, -halfExtent, -halfExtent),
    new THREE.Vector3(-halfExtent, -halfExtent, halfExtent),
    new THREE.Vector3(-halfExtent, halfExtent, -halfExtent),
    new THREE.Vector3(-halfExtent, halfExtent, halfExtent),
    new THREE.Vector3(halfExtent, -halfExtent, -halfExtent),
    new THREE.Vector3(halfExtent, -halfExtent, halfExtent),
    new THREE.Vector3(halfExtent, halfExtent, -halfExtent),
    new THREE.Vector3(halfExtent, halfExtent, halfExtent),
  ];

  // Create rotation euler (Three.js uses radians)
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotationX),
    THREE.MathUtils.degToRad(rotationY),
    THREE.MathUtils.degToRad(rotationZ)
  );

  // Create scale vector
  const scaleVec = new THREE.Vector3(scaleX, scaleY, scaleZ);

  // Transform each corner and find the minimum Y
  let minY = Infinity;
  for (const corner of corners) {
    // Apply scale first, then rotation (matches Three.js transform order)
    const transformed = corner.clone().multiply(scaleVec).applyEuler(euler);

    if (transformed.y < minY) {
      minY = transformed.y;
    }
  }

  return minY;
};

// ============================================================================
// Height Conversion Utilities
// ============================================================================

/**
 * Calculates the Y position of the object's center given a desired height above ground.
 * Height is defined as the distance from ground (Y=0) to the lowest point of the mesh.
 *
 * @param height - Desired height above ground (in internal units, where 100 = 1 meter)
 * @param lowestPointOffset - The offset from calculateLowestPointOffset (in world units)
 * @returns The Y position for the object's center (in internal units)
 */
export const heightToYPosition = (height: number, lowestPointOffset: number): number => {
  // lowestPointOffset is in world units (meters), height is in internal units (cm-like)
  // Y_center = height + |lowestPointOffset| * 100
  return height + Math.abs(lowestPointOffset) * INTERNAL_TO_WORLD;
};

/**
 * Calculates the height above ground given the object's Y position.
 * Height is defined as the distance from ground (Y=0) to the lowest point of the mesh.
 *
 * @param yPosition - The Y position of the object's center (in internal units)
 * @param lowestPointOffset - The offset from calculateLowestPointOffset (in world units)
 * @returns The height above ground (in internal units), clamped to >= 0
 */
export const yPositionToHeight = (yPosition: number, lowestPointOffset: number): number => {
  // height = Y_center - |lowestPointOffset| * 100
  const height = yPosition - Math.abs(lowestPointOffset) * INTERNAL_TO_WORLD;
  return Math.max(0, height); // Clamp to non-negative
};

// ============================================================================
// Scale Adjustment Utilities
// ============================================================================

/**
 * Calculates the Y position adjustment needed when scaling an object to maintain
 * the same ground-relative position of its bottom.
 *
 * This calculation is derived from the ImportedModel architecture:
 * - Outer group is positioned at: groundLevel + modelHeight/2
 * - Inner group has a fixed offset of: -modelHeight/2
 * - Scale is applied to outer group, which scales the inner offset
 *
 * Model bottom Y in world space: groundLevel + modelHeight/2 * (1 - scaleY)
 *
 * To maintain the same bottom position when scale changes:
 * newTransformY = currentTransformY + modelHeight * 50 * (newScale - currentScale)
 *
 * @param currentTransformY - Current Y transform value (internal units)
 * @param currentScale - Current scale factor
 * @param newScale - New scale factor
 * @param modelHeight - Model height in world units (default: 2.0)
 * @returns New Y transform value to maintain ground-relative position
 *
 * @example
 * // Scaling from 1.0 to 2.0 with model on ground (y=0):
 * calculateScaleAdjustedY(0, 1.0, 2.0, 2.0) // returns 100
 */
export const calculateScaleAdjustedY = (
  currentTransformY: number,
  currentScale: number,
  newScale: number,
  modelHeight: number = DEFAULT_MODEL_HEIGHT
): number => {
  const scaleDelta = newScale - currentScale;
  const yAdjustment = modelHeight * (INTERNAL_TO_WORLD / 2) * scaleDelta;
  return currentTransformY + yAdjustment;
};
