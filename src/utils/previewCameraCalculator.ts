import * as THREE from 'three';
import { SceneObject } from '../types';
import { applyChildWorldPosition } from './childTransformUtils';
import {
  CAMERA_HEIGHT_FACTOR,
  CAMERA_VIEWING_ANGLE,
  FocusTarget,
  MIN_CAMERA_DISTANCE,
  calculateIdealCameraPosition,
} from './focusUtils';
import { calculateFocusTargetForObject } from './focusTargetCalculator';

export interface PreviewMoveItemCameraResult {
  position: [number, number, number];
  target: [number, number, number];
}

export interface PreviewMoveItemBaseFraming {
  /** Look-at target in world space (meters, Three.js coordinates) */
  target: [number, number, number];
  /** Suggested camera distance from target (meters) */
  distance: number;
  /** Effective bounds size of the framed region (meters) */
  boundsSize: number;
  /** Default azimuth to preserve the “edit focus” feel */
  defaultAzimuth: number;
  /** Default camera position at the default azimuth */
  defaultPosition: [number, number, number];
  /** Convenience: start focus target (meters) */
  startFocusTarget: [number, number, number];
  /** Convenience: end focus target (meters) */
  endFocusTarget: [number, number, number];
}

export interface PreviewCameraCandidate {
  position: [number, number, number];
  azimuth: number;
  /** Absolute delta from the default azimuth (smaller is more consistent) */
  azimuthDelta: number;
}

export interface PreviewMoveItemCameraParams {
  /** Start position in scene units (centimeters) */
  startPos: { x: number; y: number; z: number };
  /** End position in scene units (centimeters) */
  endPos: { x: number; y: number; z: number };
  /** The object being moved (parent or child) */
  targetObject: SceneObject;
  /** If moving a child mesh, the target child path */
  targetChildPath?: string;
  /** Current camera, used for FOV */
  camera?: THREE.PerspectiveCamera;
}

const PREVIEW_MAX_DISTANCE = 60; // Matches CameraControls maxDistance in MainCanvas
const FOV_PADDING = 1.15; // Slight padding so path fits comfortably
const BOUNDS_PADDING = 1.05; // Expand per-target bounds slightly for breathing room

/**
 * Calculate the base framing for a preview move-item step.
 * This does NOT do any occlusion handling; it only determines a good target + distance.
 *
 * Design goals:
 * - Match edit-mode focus framing style (angle/height feel)
 * - Keep camera closer for small objects/moves
 * - Still guarantee both start and end are framed (by fitting a union of start/end focus spheres)
 */
export async function calculatePreviewMoveItemBaseFraming(
  params: PreviewMoveItemCameraParams
): Promise<PreviewMoveItemBaseFraming> {
  const { startPos, endPos, targetObject, targetChildPath, camera } = params;

  const startObject = createObjectAtPose({
    object: targetObject,
    childPath: targetChildPath,
    pos: startPos,
  });
  const endObject = createObjectAtPose({
    object: targetObject,
    childPath: targetChildPath,
    pos: endPos,
  });

  // IMPORTANT: do this sequentially to avoid racing mutations against the cached model instance.
  const startFocus = await calculateFocusTargetForObject({
    object: startObject,
    childPath: targetChildPath,
  });
  const endFocus = await calculateFocusTargetForObject({
    object: endObject,
    childPath: targetChildPath,
  });

  const startSphere = focusTargetToSphere(startFocus, BOUNDS_PADDING);
  const endSphere = focusTargetToSphere(endFocus, BOUNDS_PADDING);
  const union = unionBoundingSpheres(startSphere, endSphere);

  const unionTarget: FocusTarget = {
    targetX: union.center.x,
    targetY: union.center.y,
    targetZ: union.center.z,
    boundsSize: union.radius * 2,
  };

  // Match edit focus’s distance heuristics for “object comfort”, but ensure the entire
  // start/end union sphere fits in the camera’s FOV.
  const idealUnion = calculateIdealCameraPosition(unionTarget);
  const idealStart = calculateIdealCameraPosition(startFocus);
  const idealEnd = calculateIdealCameraPosition(endFocus);

  const fov = camera?.fov ?? 35;
  const fovRad = THREE.MathUtils.degToRad(fov);
  const requiredForFov = (union.radius * FOV_PADDING) / Math.tan(fovRad / 2);

  const distance = clamp(
    Math.max(
      requiredForFov,
      idealUnion.distance,
      idealStart.distance,
      idealEnd.distance,
      MIN_CAMERA_DISTANCE
    ),
    MIN_CAMERA_DISTANCE,
    PREVIEW_MAX_DISTANCE
  );

  const defaultAzimuth = CAMERA_VIEWING_ANGLE;
  const defaultPos = positionFromTarget(unionTarget, distance, defaultAzimuth);

  return {
    target: [unionTarget.targetX, unionTarget.targetY, unionTarget.targetZ],
    distance,
    boundsSize: unionTarget.boundsSize,
    defaultAzimuth,
    defaultPosition: [defaultPos.x, defaultPos.y, defaultPos.z],
    startFocusTarget: [startFocus.targetX, startFocus.targetY, startFocus.targetZ],
    endFocusTarget: [endFocus.targetX, endFocus.targetY, endFocus.targetZ],
  };
}

/**
 * Generate candidate camera positions around a target at a fixed distance.
 * Returned in a deterministic order biased toward the default azimuth so selection feels intentional.
 */
export function generatePreviewCameraCandidates(params: {
  target: [number, number, number];
  distance: number;
  defaultAzimuth?: number;
  sampleCount?: number;
}): PreviewCameraCandidate[] {
  const { target, distance, defaultAzimuth = CAMERA_VIEWING_ANGLE, sampleCount = 12 } = params;

  const targetFocus: FocusTarget = {
    targetX: target[0],
    targetY: target[1],
    targetZ: target[2],
    boundsSize: 1,
  };

  const azimuths: number[] = [];
  const step = (Math.PI * 2) / sampleCount;
  for (let i = 0; i < sampleCount; i++) {
    azimuths.push(defaultAzimuth + i * step);
  }

  const normalizeAngle = (a: number) => {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  };

  return azimuths
    .map((azimuth) => {
      const delta = Math.abs(normalizeAngle(azimuth - defaultAzimuth));
      const pos = positionFromTarget(targetFocus, distance, azimuth);
      return {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        azimuth,
        azimuthDelta: delta,
      };
    })
    .sort((a, b) => a.azimuthDelta - b.azimuthDelta);
}

/**
 * Backwards-compatible helper that returns the default base framing position.
 * Preview step code should prefer `calculatePreviewMoveItemBaseFraming` + occlusion selection.
 */
export async function calculatePreviewMoveItemCamera(
  params: PreviewMoveItemCameraParams
): Promise<PreviewMoveItemCameraResult> {
  const base = await calculatePreviewMoveItemBaseFraming(params);
  return {
    position: base.defaultPosition,
    target: base.target,
  };
}

function createObjectAtPose(params: {
  object: SceneObject;
  childPath?: string;
  pos: { x: number; y: number; z: number };
}): SceneObject {
  const { object, childPath, pos } = params;

  if (childPath) {
    // Child movement: parent stays fixed; update the child localTransform to place it at the desired world position.
    // applyChildWorldPosition expects scene units (cm).
    return applyChildWorldPosition(object, childPath, pos) ?? object;
  }

  // Parent movement: update the parent’s scene transform for this pose.
  return {
    ...object,
    transform: {
      ...object.transform,
      x: pos.x,
      y: pos.y,
      z: pos.z,
    },
  };
}

function focusTargetToSphere(
  target: FocusTarget,
  padding: number
): { center: THREE.Vector3; radius: number } {
  return {
    center: new THREE.Vector3(target.targetX, target.targetY, target.targetZ),
    radius: Math.max(0, target.boundsSize * 0.5 * padding),
  };
}

/**
 * Minimal enclosing sphere of two spheres.
 * If one contains the other, returns the larger. Otherwise returns the tight union.
 */
export function unionBoundingSpheres(
  a: { center: THREE.Vector3; radius: number },
  b: { center: THREE.Vector3; radius: number }
): { center: THREE.Vector3; radius: number } {
  const d = a.center.distanceTo(b.center);

  // Same center (or extremely close)
  if (d < 1e-8) {
    return a.radius >= b.radius
      ? { center: a.center.clone(), radius: a.radius }
      : { center: b.center.clone(), radius: b.radius };
  }

  // One sphere contains the other
  if (a.radius >= d + b.radius) {
    return { center: a.center.clone(), radius: a.radius };
  }
  if (b.radius >= d + a.radius) {
    return { center: b.center.clone(), radius: b.radius };
  }

  // Tight union
  const radius = (d + a.radius + b.radius) * 0.5;
  const t = (radius - a.radius) / d;
  const center = a.center.clone().lerp(b.center, t);
  return { center, radius };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positionFromTarget(target: FocusTarget, distance: number, azimuth: number): THREE.Vector3 {
  return new THREE.Vector3(
    target.targetX + Math.cos(azimuth) * distance,
    target.targetY + distance * CAMERA_HEIGHT_FACTOR,
    target.targetZ + Math.sin(azimuth) * distance
  );
}
