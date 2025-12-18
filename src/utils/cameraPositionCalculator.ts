import * as THREE from 'three';
import { SceneObject } from '../types';

/**
 * Calculates optimal camera position and target for move-item steps.
 * Ensures both start and end positions are visible with breathing room.
 */
export interface CameraPosition {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Calculate optimal camera position for a move-item step.
 *
 * @param startPos - Start position in world space (centimeters, converted to meters)
 * @param endPos - End position in world space (centimeters, converted to meters)
 * @param targetObject - The object being moved (for size considerations)
 * @param allObjects - All objects in scene (for occlusion checking)
 * @param camera - Current camera (for FOV considerations and current position/angle)
 * @param currentCameraPosition - Optional current camera position to maintain angle if possible
 * @param currentCameraTarget - Optional current camera target
 * @returns Camera position and target
 */
export function calculateCameraPosition(
  startPos: { x: number; y: number; z: number },
  endPos: { x: number; y: number; z: number },
  targetObject?: SceneObject,
  allObjects: SceneObject[] = [],
  camera?: THREE.PerspectiveCamera,
  currentCameraPosition?: THREE.Vector3,
  currentCameraTarget?: THREE.Vector3
): CameraPosition {
  // Convert from centimeters to meters (as used in Three.js scene)
  const start = new THREE.Vector3(startPos.x / 100, startPos.y / 100, -startPos.z / 100);
  const end = new THREE.Vector3(endPos.x / 100, endPos.y / 100, -endPos.z / 100);

  // Calculate center point between start and end
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Calculate bounding box that includes both positions
  const objectSize = targetObject
    ? Math.max(
        targetObject.transform.scaleX,
        targetObject.transform.scaleY,
        targetObject.transform.scaleZ
      ) / 100
    : 1;

  // More conservative padding - enough to see clearly but not excessive
  const padding = Math.max(objectSize * 0.5, 0.4); // 50% of object size or 0.4m minimum

  const boundingBox = new THREE.Box3();
  boundingBox.expandByPoint(start);
  boundingBox.expandByPoint(end);
  boundingBox.expandByScalar(padding);

  // Calculate the size of the bounding box
  const size = boundingBox.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  // Calculate distance needed to view the entire bounding box
  // Use a comfortable viewing angle that's not too close, not too far
  const fov = camera?.fov ?? 35;
  const fovRad = THREE.MathUtils.degToRad(fov);
  // Use a more moderate multiplier (1.2x instead of 1.5x) for better framing
  const baseDistance = (maxDimension * 1.2) / (2 * Math.tan(fovRad / 2));

  // Apply distance constraints (more conservative - min 2.5m, max 30m for closer feel)
  const MIN_DISTANCE = 2.5;
  const MAX_DISTANCE = 30;
  const distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, baseDistance));
  const movementDistance = start.distanceTo(end);

  // Try to maintain current camera angle if possible (for less jarring experience)
  let cameraPos: THREE.Vector3;
  let target: THREE.Vector3 = center;

  // If we have current camera position/target, try to maintain similar angle
  if (currentCameraPosition && currentCameraTarget) {
    // Calculate current camera direction (from target to position)
    const currentDirection = new THREE.Vector3()
      .subVectors(currentCameraPosition, currentCameraTarget)
      .normalize();

    // Calculate current distance
    const currentDistance = currentCameraPosition.distanceTo(currentCameraTarget);

    // Use a similar distance (or calculated distance, whichever is more appropriate)
    const useDistance = Math.max(distance, currentDistance * 0.7); // Use at least 70% of current distance

    // Try to use current camera direction, scaled to new distance
    const proposedCameraPos = new THREE.Vector3()
      .copy(center)
      .add(currentDirection.multiplyScalar(useDistance));

    // Check if this position provides good visibility (no obstructions)
    const isObstructed = checkOcclusion(proposedCameraPos, start, end, allObjects, targetObject);

    if (!isObstructed) {
      // Current angle works! Use it
      cameraPos = proposedCameraPos;
      target = center;
    } else {
      // Need to adjust angle due to obstruction
      cameraPos = calculateOptimalPosition(center, start, end, distance, movementDistance);
      target = center;
    }
  } else {
    // No current camera info, calculate optimal position
    cameraPos = calculateOptimalPosition(center, start, end, distance, movementDistance);
    target = center;
  }

  // Helper function to calculate optimal camera position
  function calculateOptimalPosition(
    center: THREE.Vector3,
    start: THREE.Vector3,
    end: THREE.Vector3,
    distance: number,
    movementDistance: number
  ): THREE.Vector3 {
    // Use moderate elevation angle (30-35°) for comfortable viewing
    // Less variation based on movement distance for consistency
    const normalizedMovementDistance = Math.min(movementDistance / 10, 1);
    const elevationAngleDegrees = 30 + normalizedMovementDistance * 5; // Range: 30° to 35°
    const elevationAngle = THREE.MathUtils.degToRad(elevationAngleDegrees);

    const horizontalDistance = distance * Math.cos(elevationAngle);
    const verticalOffset = distance * Math.sin(elevationAngle);

    // Calculate movement direction (from start to end)
    const movementDirection = new THREE.Vector3().subVectors(end, start).normalize();

    // Calculate camera direction perpendicular to movement direction
    let cameraDirection: THREE.Vector3;

    if (Math.abs(movementDirection.y) > 0.9) {
      // Vertical movement - position camera to the side
      cameraDirection = new THREE.Vector3(1, 0, 0).normalize();
    } else {
      // Horizontal movement - get perpendicular direction in XZ plane
      const horizontalMovement = new THREE.Vector3(
        movementDirection.x,
        0,
        movementDirection.z
      ).normalize();
      cameraDirection = new THREE.Vector3(
        -horizontalMovement.z,
        0,
        horizontalMovement.x
      ).normalize();
    }

    if (cameraDirection.length() < 0.1 || !isFinite(cameraDirection.x)) {
      cameraDirection.set(1, 0, 1).normalize();
    }

    return new THREE.Vector3()
      .copy(center)
      .add(cameraDirection.multiplyScalar(horizontalDistance))
      .add(new THREE.Vector3(0, verticalOffset, 0));
  }

  // Helper function to check if camera position has obstructions
  function checkOcclusion(
    cameraPos: THREE.Vector3,
    start: THREE.Vector3,
    end: THREE.Vector3,
    allObjects: SceneObject[],
    targetObject?: SceneObject
  ): boolean {
    for (const point of [start, end]) {
      const distanceToPoint = cameraPos.distanceTo(point);

      for (const obj of allObjects) {
        if (obj.id === targetObject?.id) continue;
        if (!obj.properties.visible) continue;

        const objPos = new THREE.Vector3(
          obj.transform.x / 100,
          obj.transform.y / 100,
          -obj.transform.z / 100
        );
        const objSize =
          Math.max(obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ) / 100;

        const distToObj = cameraPos.distanceTo(objPos);

        // If object is between camera and point
        if (distToObj < distanceToPoint) {
          const toPoint = new THREE.Vector3().subVectors(point, cameraPos).normalize();
          const toObj = new THREE.Vector3().subVectors(objPos, cameraPos).normalize();
          const dot = toPoint.dot(toObj);

          // If object is significantly blocking the view
          if (dot > 0.85) {
            const closestDist = cameraPos.distanceTo(objPos) - objSize;
            if (closestDist < distanceToPoint * 0.7) {
              return true; // Obstructed
            }
          }
        }
      }
    }
    return false; // Not obstructed
  }

  // Final occlusion check - if current position is obstructed, recalculate
  const isObstructed = checkOcclusion(cameraPos, start, end, allObjects, targetObject);
  if (isObstructed) {
    // Recalculate with adjusted angle (move back and up)
    const movementDistance = start.distanceTo(end);
    const adjustedDistance = distance * 1.3; // Move back 30%
    cameraPos = calculateOptimalPosition(center, start, end, adjustedDistance, movementDistance);
    cameraPos.y += distance * 0.15; // Move up a bit more
  }

  return {
    position: [cameraPos.x, cameraPos.y, cameraPos.z],
    target: [target.x, target.y, target.z],
  };
}
