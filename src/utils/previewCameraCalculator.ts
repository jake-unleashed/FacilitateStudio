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
  /** Pitch angle in radians (0 = horizontal plane, + = above, - = below) */
  pitch?: number;
  /** Absolute delta from the default azimuth (smaller is more consistent) */
  azimuthDelta: number;
  /** Absolute delta from the default pitch (smaller is more consistent) */
  pitchDelta?: number;
  /** Candidate tier index (0 = preferred/base, higher = more “fallback”) */
  tierIndex?: number;
}

export interface CameraPitchTier {
  /** Pitch angle in radians (0 = horizontal plane, + = above, - = below) */
  pitch: number;
  /**
   * Tier ordering. 0 should be the “normal” view; higher values are more fallback.
   * Used to keep “above/below” as last-resort angles.
   */
  tierIndex: number;
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
  // Legacy API: generate candidates for the single “base” pitch (edit-like view).
  const { target, distance, defaultAzimuth = CAMERA_VIEWING_ANGLE, sampleCount = 12 } = params;
  return generatePreviewCameraCandidatesWithPitchTiers({
    target,
    distance,
    defaultAzimuth,
    sampleCount,
    pitchTiers: [{ pitch: Math.atan(CAMERA_HEIGHT_FACTOR), tierIndex: 0 }],
    defaultPitch: Math.atan(CAMERA_HEIGHT_FACTOR),
  });
}

/**
 * Generate camera candidates around a target with optional pitch tiers.
 * This enables “above/below” fallback angles (e.g. top-down, bottom-up) while keeping
 * the standard ring as the primary tier.
 */
export function generatePreviewCameraCandidatesWithPitchTiers(params: {
  target: [number, number, number];
  /** Ideal distance from focus utilities (not the actual 3D distance; see notes below) */
  distance: number;
  defaultAzimuth: number;
  sampleCount: number;
  pitchTiers: CameraPitchTier[];
  /** Default pitch used for tie-breaking and ordering (typically current camera pitch). */
  defaultPitch: number;
}): PreviewCameraCandidate[] {
  const { target, distance, defaultAzimuth, sampleCount, pitchTiers, defaultPitch } = params;

  const targetFocus: FocusTarget = {
    targetX: target[0],
    targetY: target[1],
    targetZ: target[2],
    boundsSize: 1,
  };

  // NOTE: In our existing framing style, `distance` represents the “ideal” distance from
  // focusUtils, but the actual camera distance is larger due to CAMERA_HEIGHT_FACTOR.
  // We preserve that behavior by converting to an equivalent 3D radius for pitch-based placement.
  const radius3d = distance * Math.sqrt(1 + CAMERA_HEIGHT_FACTOR * CAMERA_HEIGHT_FACTOR);

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

  const clampPitch = (p: number) => {
    // Avoid exact +/-90° which can create degeneracies.
    const eps = THREE.MathUtils.degToRad(1.5);
    return Math.max(-Math.PI / 2 + eps, Math.min(Math.PI / 2 - eps, p));
  };

  const candidates: PreviewCameraCandidate[] = [];

  for (const tier of pitchTiers) {
    const pitch = clampPitch(tier.pitch);
    for (const azimuth of azimuths) {
      const azDelta = Math.abs(normalizeAngle(azimuth - defaultAzimuth));
      const pitchDelta = Math.abs(pitch - defaultPitch);
      const pos = positionFromTargetWithAzimuthPitch(targetFocus, radius3d, azimuth, pitch);
      candidates.push({
        position: [pos.x, pos.y, pos.z],
        azimuth,
        pitch,
        azimuthDelta: azDelta,
        pitchDelta,
        tierIndex: tier.tierIndex,
      });
    }
  }

  // Primary ordering:
  // - tierIndex first (base tier stays first; above/below are fallbacks)
  // - azimuth delta second (stay near current/default view direction)
  // - pitch delta third (avoid big pitch flips unless needed)
  candidates.sort((a, b) => {
    const ta = a.tierIndex ?? 0;
    const tb = b.tierIndex ?? 0;
    if (ta !== tb) return ta - tb;
    if (a.azimuthDelta !== b.azimuthDelta) return a.azimuthDelta - b.azimuthDelta;
    return (a.pitchDelta ?? 0) - (b.pitchDelta ?? 0);
  });

  return candidates;
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

function positionFromTargetWithAzimuthPitch(
  target: FocusTarget,
  radius3d: number,
  azimuth: number,
  pitch: number
): THREE.Vector3 {
  const c = Math.cos(pitch);
  return new THREE.Vector3(
    target.targetX + Math.cos(azimuth) * c * radius3d,
    target.targetY + Math.sin(pitch) * radius3d,
    target.targetZ + Math.sin(azimuth) * c * radius3d
  );
}
