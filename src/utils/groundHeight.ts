import * as THREE from 'three';

/**
 * Calculates how far below the object's center the lowest point of the mesh is,
 * taking into account rotation and scale.
 *
 * For a unit cube centered at origin, the 8 corners are at (±0.5, ±0.5, ±0.5).
 * After applying scale and rotation, we find which corner is lowest (minimum Y).
 *
 * @param rotationX - Rotation around X axis in degrees
 * @param rotationY - Rotation around Y axis in degrees
 * @param rotationZ - Rotation around Z axis in degrees
 * @param scaleX - Scale factor on X axis
 * @param scaleY - Scale factor on Y axis
 * @param scaleZ - Scale factor on Z axis
 * @returns The Y offset of the lowest point from the center (always negative or zero)
 */
export const calculateLowestPointOffset = (
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number
): number => {
  // Define the 8 corners of a unit cube centered at origin
  const corners = [
    new THREE.Vector3(-0.5, -0.5, -0.5),
    new THREE.Vector3(-0.5, -0.5, 0.5),
    new THREE.Vector3(-0.5, 0.5, -0.5),
    new THREE.Vector3(-0.5, 0.5, 0.5),
    new THREE.Vector3(0.5, -0.5, -0.5),
    new THREE.Vector3(0.5, -0.5, 0.5),
    new THREE.Vector3(0.5, 0.5, -0.5),
    new THREE.Vector3(0.5, 0.5, 0.5),
  ];

  // Create rotation euler (Three.js uses radians)
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotationX),
    THREE.MathUtils.degToRad(rotationY),
    THREE.MathUtils.degToRad(rotationZ)
  );

  // Create scale vector
  const scale = new THREE.Vector3(scaleX, scaleY, scaleZ);

  // Transform each corner and find the minimum Y
  let minY = Infinity;
  for (const corner of corners) {
    // Apply scale first, then rotation
    const transformed = corner.clone().multiply(scale).applyEuler(euler);

    if (transformed.y < minY) {
      minY = transformed.y;
    }
  }

  return minY; // This will be negative (how far below center the lowest point is)
};

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
  return height + Math.abs(lowestPointOffset) * 100;
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
  const height = yPosition - Math.abs(lowestPointOffset) * 100;
  return Math.max(0, height); // Clamp to non-negative
};
