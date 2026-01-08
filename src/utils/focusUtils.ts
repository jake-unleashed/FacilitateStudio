/**
 * Camera Focus Utilities
 *
 * Provides pure functions for calculating camera focus positions and behaviors.
 * These utilities power the "soft" and "full" focus modes when selecting objects.
 *
 * Focus Modes:
 * - 'full': Move camera directly to ideal framing position (F key, sidebar clicks)
 * - 'soft': Adaptive focus - moves camera proportionally toward ideal based on distance.
 *           Always updates orbit center. Zooms in if too far, zooms out if too close.
 *
 * The "comfort zone" defines a range of acceptable camera distances:
 * - Below COMFORT_MIN (0.6x ideal): Camera is too close, zoom out aggressively
 * - Above COMFORT_MAX (2.0x ideal): Camera is too far, zoom in moderately
 * - Within zone: Only update orbit center, don't move camera position
 */

import * as THREE from 'three';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Multiplier for calculating ideal camera distance from object bounds.
 * Ideal distance = boundsSize * MODEL_CAMERA_DISTANCE_MULTIPLIER
 */
export const MODEL_CAMERA_DISTANCE_MULTIPLIER = 2.5;

/**
 * Minimum camera distance (prevents getting too close to tiny objects)
 */
export const MIN_CAMERA_DISTANCE = 0.5;

/**
 * Maximum camera distance (prevents zooming out too far)
 */
export const MAX_CAMERA_DISTANCE = 20;

/**
 * Comfort zone minimum: Below this ratio (current/ideal), camera is too close.
 * At 0.6x ideal distance, we're uncomfortably close and need to zoom out.
 */
export const COMFORT_MIN = 0.6;

/**
 * Comfort zone maximum: Above this ratio (current/ideal), camera is too far.
 * At 2.0x ideal distance, we're too far and need to zoom in.
 */
export const COMFORT_MAX = 2.0;

/**
 * Soft focus intensity: How aggressively to zoom in when too far.
 * Range 0-1. Higher = more aggressive movement toward ideal.
 */
export const SOFT_FOCUS_INTENSITY = 0.5;

/**
 * Minimum zoom-out intensity when camera is too close.
 * Even at the edge of comfort zone, we move at least 60% toward ideal.
 */
export const MIN_ZOOM_OUT_INTENSITY = 0.6;

/**
 * Additional zoom-out intensity range when very close.
 * Camera moves 60-100% toward ideal based on how close.
 */
export const ZOOM_OUT_INTENSITY_RANGE = 0.4;

/**
 * Minimum interpolation factor to trigger camera movement.
 * Below this threshold, we only update orbit center.
 */
export const MIN_INTERPOLATION_THRESHOLD = 0.05;

/**
 * Camera viewing angle in radians (45 degrees from object).
 */
export const CAMERA_VIEWING_ANGLE = Math.PI / 4;

/**
 * Camera height factor relative to ideal distance.
 * Camera is positioned at targetY + idealDistance * CAMERA_HEIGHT_FACTOR
 */
export const CAMERA_HEIGHT_FACTOR = 0.6;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of focus target calculation.
 */
export interface FocusTarget {
  /** Target X position (orbit center) in world coordinates */
  targetX: number;
  /** Target Y position (orbit center) in world coordinates */
  targetY: number;
  /** Target Z position (orbit center) in world coordinates */
  targetZ: number;
  /** Size of the bounds (used for distance calculation) */
  boundsSize: number;
}

/**
 * Ideal camera position for framing an object.
 */
export interface IdealCameraPosition {
  /** Ideal camera X in world coordinates */
  x: number;
  /** Ideal camera Y in world coordinates */
  y: number;
  /** Ideal camera Z in world coordinates */
  z: number;
  /** Ideal distance from target */
  distance: number;
}

/**
 * Result of soft focus interpolation calculation.
 */
export interface SoftFocusResult {
  /** Whether camera position should be updated */
  shouldMoveCamera: boolean;
  /** New camera position (if shouldMoveCamera is true) */
  newCameraPosition?: THREE.Vector3;
  /** Interpolation factor used (for debugging/testing) */
  interpolationFactor: number;
  /** Distance ratio (current/ideal) */
  distanceRatio: number;
  /** Whether camera was too close */
  wasTooClose: boolean;
  /** Whether camera was too far */
  wasTooFar: boolean;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Calculate the ideal camera distance for a given bounds size.
 * Clamps result to MIN_CAMERA_DISTANCE and MAX_CAMERA_DISTANCE.
 *
 * @param boundsSize - The diagonal size of the object's bounding box
 * @returns Clamped ideal distance from the object
 */
export function calculateIdealDistance(boundsSize: number): number {
  const rawDistance = boundsSize * MODEL_CAMERA_DISTANCE_MULTIPLIER;
  return Math.max(MIN_CAMERA_DISTANCE, Math.min(rawDistance, MAX_CAMERA_DISTANCE));
}

/**
 * Calculate the ideal camera position for framing an object.
 *
 * @param target - The focus target (center point to look at)
 * @returns Ideal camera position and distance
 */
export function calculateIdealCameraPosition(target: FocusTarget): IdealCameraPosition {
  const idealDistance = calculateIdealDistance(target.boundsSize);

  return {
    x: target.targetX + Math.cos(CAMERA_VIEWING_ANGLE) * idealDistance,
    y: target.targetY + idealDistance * CAMERA_HEIGHT_FACTOR,
    z: target.targetZ + Math.sin(CAMERA_VIEWING_ANGLE) * idealDistance,
    distance: idealDistance,
  };
}

/**
 * Calculate the interpolation factor for zooming out when camera is too close.
 * Uses an aggressive curve: 60% at comfort edge, up to 100% when very close.
 *
 * @param distanceRatio - Current distance / ideal distance
 * @returns Interpolation factor (0.6 to 1.0)
 */
export function calculateZoomOutFactor(distanceRatio: number): number {
  // closenessFactor: 0 at COMFORT_MIN edge, approaches 1 as we get very close
  const closenessFactor = 1 - distanceRatio / COMFORT_MIN;
  // Scale from MIN_ZOOM_OUT_INTENSITY (0.6) to 1.0
  return MIN_ZOOM_OUT_INTENSITY + closenessFactor * ZOOM_OUT_INTENSITY_RANGE;
}

/**
 * Calculate the interpolation factor for zooming in when camera is too far.
 * Increases proportionally with distance, capped at 1.0.
 *
 * @param distanceRatio - Current distance / ideal distance
 * @returns Interpolation factor (0.5 to 1.0)
 */
export function calculateZoomInFactor(distanceRatio: number): number {
  // How far beyond COMFORT_MAX we are (0 at edge, increases with distance)
  const excessRatio = distanceRatio / COMFORT_MAX - 1;
  // Start at SOFT_FOCUS_INTENSITY, increase proportionally
  return Math.min(1.0, SOFT_FOCUS_INTENSITY * excessRatio + SOFT_FOCUS_INTENSITY);
}

/**
 * Calculate the soft focus result - determines if and how much to move the camera.
 *
 * @param currentCameraPosition - Current camera position in world coordinates
 * @param target - Focus target (orbit center)
 * @param idealCamera - Ideal camera position
 * @returns Soft focus calculation result
 */
export function calculateSoftFocus(
  currentCameraPosition: THREE.Vector3,
  target: FocusTarget,
  idealCamera: IdealCameraPosition
): SoftFocusResult {
  const targetPos = new THREE.Vector3(target.targetX, target.targetY, target.targetZ);
  const currentDistance = currentCameraPosition.distanceTo(targetPos);
  const distanceRatio = currentDistance / idealCamera.distance;

  let interpolationFactor = 0;
  let wasTooClose = false;
  let wasTooFar = false;

  if (distanceRatio < COMFORT_MIN) {
    // Too close - need to zoom out aggressively
    wasTooClose = true;
    interpolationFactor = calculateZoomOutFactor(distanceRatio);
  } else if (distanceRatio > COMFORT_MAX) {
    // Too far - need to zoom in
    wasTooFar = true;
    interpolationFactor = calculateZoomInFactor(distanceRatio);
  }

  const shouldMoveCamera = interpolationFactor > MIN_INTERPOLATION_THRESHOLD;
  let newCameraPosition: THREE.Vector3 | undefined;

  if (shouldMoveCamera) {
    const idealPos = new THREE.Vector3(idealCamera.x, idealCamera.y, idealCamera.z);
    newCameraPosition = new THREE.Vector3().lerpVectors(
      currentCameraPosition,
      idealPos,
      interpolationFactor
    );
  }

  return {
    shouldMoveCamera,
    newCameraPosition,
    interpolationFactor,
    distanceRatio,
    wasTooClose,
    wasTooFar,
  };
}

/**
 * Calculate focus target for a primitive object (cube, sphere, etc.).
 * Uses default height offset for centering.
 *
 * @param parentX - Parent X in world coordinates
 * @param parentY - Parent Y in world coordinates (ground level)
 * @param parentZ - Parent Z in world coordinates
 * @param defaultHeight - Default height offset (typically 0.5 for 1-unit cubes)
 * @returns Focus target
 */
export function calculatePrimitiveFocusTarget(
  parentX: number,
  parentY: number,
  parentZ: number,
  defaultHeight: number = 0.5
): FocusTarget {
  return {
    targetX: parentX,
    targetY: parentY + defaultHeight,
    targetZ: parentZ,
    boundsSize: 1, // Default primitive size
  };
}

/**
 * Convert scene coordinates to Three.js world coordinates.
 *
 * @param sceneX - X in scene units (centimeters)
 * @param sceneY - Y in scene units (centimeters)
 * @param sceneZ - Z in scene units (centimeters)
 * @returns Object with x, y, z in Three.js world units (meters)
 */
export function sceneToWorldCoordinates(
  sceneX: number,
  sceneY: number,
  sceneZ: number
): { x: number; y: number; z: number } {
  return {
    x: sceneX / 100,
    y: sceneY / 100,
    z: -sceneZ / 100, // Z is negated for Three.js coordinate system
  };
}
