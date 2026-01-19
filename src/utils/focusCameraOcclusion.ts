import * as THREE from 'three';
import { CAMERA_HEIGHT_FACTOR, FocusTarget, calculateIdealCameraPosition } from './focusUtils';
import {
  CameraPitchTier,
  generatePreviewCameraCandidatesWithPitchTiers,
  type PreviewCameraCandidate,
} from './previewCameraCalculator';
import {
  pickBestPreviewCameraCandidateByRaycastWithMetrics,
  pickBestPreviewCameraCandidateByRaycastWithMetricsAsync,
  RaycastBreathingRoomMode,
  evaluateCameraVisibility,
  type RaycastCameraCandidateScore,
  type RaycastProgressiveOptions,
} from './previewCameraOcclusion';

/**
 * Minimum camera Y (world meters) for focus positioning.
 * Keeps the camera above the ground grid plane (y=0) to avoid disorienting under-ground viewpoints.
 */
export const MIN_FOCUS_CAMERA_Y = 0.05;

function clampFocusCameraAboveGround(pos: THREE.Vector3): THREE.Vector3 {
  if (pos.y < MIN_FOCUS_CAMERA_Y) {
    pos.y = MIN_FOCUS_CAMERA_Y;
  }
  return pos;
}

export interface FocusCameraParams {
  target: FocusTarget;
  scene: THREE.Scene;
  /** SceneObject ID of the interactive target */
  targetObjectId: string;
  /** Optional: child path to target within the object (when focusing a child mesh) */
  targetChildPath?: string;
  /**
   * Current camera position (world space). When provided, we bias candidate selection toward the
   * direction the user is already viewing from to avoid large 180° swings.
   */
  currentCameraPosition?: THREE.Vector3;
  /** Number of azimuth samples around the target */
  sampleCount?: number;
  /** How strongly to prefer staying near the current/default azimuth */
  azimuthBiasStrength?: number;

  /**
   * Optional stricter "breathing room" settings. When enabled, the scorer will:
   * - sample a wider region around the target (optionally including diagonals)
   * - prefer candidates whose worst-case sample ray is clear (avoids "peeking")
   * - optionally back off camera distance if nothing is clear enough
   */
  breathingRoom?: {
    enabled?: boolean;
    mode?: RaycastBreathingRoomMode;
    /** Minimum fraction of sample rays that must be fully clear before we accept a viewpoint. */
    minClearFraction?: number;
    /** Multipliers to try on the ideal distance to gain clearance. */
    distanceMultipliers?: number[];
    sampleRadiusScale?: number;
    sampleMinRadius?: number;
    includeDiagonalSamples?: boolean;
    minVisibilityWeight?: number;
  };

  /**
   * Vertical-angle fallbacks. When enabled, we try the normal "base" tier first (horizontal ring),
   * then expand to include above/below pitch tiers as last resorts.
   */
  verticalTiers?: {
    enabled?: boolean;
    /** Number of azimuth samples for each tier. Defaults to `sampleCount`. */
    sampleCountPerTier?: number;
  };

  /** Progressive evaluation settings to keep UI responsive on heavy scenes. */
  progressive?: RaycastProgressiveOptions;
}

export interface FocusCameraResult {
  position: THREE.Vector3;
  target: THREE.Vector3;
  azimuth: number;
  /**
   * True when we deviated from the default azimuth due to occlusion scoring.
   * This is a best-effort signal intended for debugging/telemetry.
   */
  wasOccluded: boolean;
}

export interface QuickFocusCameraResult {
  /** When true, `position` is a good-enough clear camera position and we can skip full analysis. */
  shouldUseFastPath: boolean;
  /** Suggested camera position for the fast path (present when shouldUseFastPath is true). */
  position?: THREE.Vector3;
  /** Look-at target for camera controls. */
  target: THREE.Vector3;
}

/**
 * Fast-path occlusion check for editor focus.
 *
 * We compute the “obvious” camera position: keep the current view direction but move to the
 * ideal focus distance, then run a small set of raycasts. If that position is already clear,
 * we can skip the expensive multi-candidate occlusion analysis.
 */
export function calculateQuickFocusCamera(params: {
  target: FocusTarget;
  scene: THREE.Scene;
  targetObjectId: string;
  targetChildPath?: string;
  currentCameraPosition: THREE.Vector3;
}): QuickFocusCameraResult {
  const { target, scene, targetObjectId, targetChildPath, currentCameraPosition } = params;

  const targetVec = new THREE.Vector3(target.targetX, target.targetY, target.targetZ);
  const ideal = calculateIdealCameraPosition(target);

  // Preserve current view direction (minimal rotation), but use ideal distance for consistent framing.
  const dir = new THREE.Vector3().subVectors(currentCameraPosition, targetVec);
  const dist = dir.length();

  const isValidDir = isFinite(dist) && dist > 1e-6;
  const cameraPos = isValidDir
    ? targetVec.clone().add(dir.normalize().multiplyScalar(ideal.distance))
    : new THREE.Vector3(ideal.x, ideal.y, ideal.z);

  // Never allow a focus position below the ground plane.
  clampFocusCameraAboveGround(cameraPos);

  // Small “breathing room” sample on the horizontal plane: center + 4 cardinals.
  const r = Math.max(0.08, target.boundsSize * 0.25);
  const samplePoints: THREE.Vector3[] = [
    targetVec,
    targetVec.clone().add(new THREE.Vector3(r, 0, 0)),
    targetVec.clone().add(new THREE.Vector3(-r, 0, 0)),
    targetVec.clone().add(new THREE.Vector3(0, 0, r)),
    targetVec.clone().add(new THREE.Vector3(0, 0, -r)),
  ];

  const visibility = evaluateCameraVisibility({
    scene,
    cameraPosition: cameraPos,
    targetObjectId,
    targetChildPath,
    samplePoints,
  });

  const shouldUseFastPath = visibility.clearFraction >= 0.85;

  return {
    shouldUseFastPath,
    position: shouldUseFastPath ? cameraPos : undefined,
    target: targetVec,
  };
}

/**
 * Calculate an occlusion-aware camera position for focusing on a target in edit mode.
 *
 * Reuses the same candidate generation + raycast scoring as preview/publish mode, but
 * simplifies inputs (single target instead of start/end path framing).
 */
export function calculateOcclusionAwareFocusCamera(
  params: FocusCameraParams
): FocusCameraResult {
  const {
    target,
    scene,
    targetObjectId,
    targetChildPath,
    currentCameraPosition,
    sampleCount = 12,
    azimuthBiasStrength = 0.25,
    breathingRoom,
    verticalTiers,
  } = params;

  const targetVec = new THREE.Vector3(target.targetX, target.targetY, target.targetZ);
  const ideal = calculateIdealCameraPosition(target);

  const breathingEnabled = breathingRoom?.enabled ?? false;
  const mode = breathingRoom?.mode ?? 'strict';
  const minClearFraction = breathingRoom?.minClearFraction ?? 0.9;
  const distanceMultipliers = breathingRoom?.distanceMultipliers ?? [1, 1.15, 1.3];
  const sampleRadiusScale = breathingRoom?.sampleRadiusScale ?? 0.35;
  const sampleMinRadius = breathingRoom?.sampleMinRadius ?? 0.12;
  const includeDiagonalSamples = breathingRoom?.includeDiagonalSamples ?? true;
  const minVisibilityWeight = breathingRoom?.minVisibilityWeight ?? 1.8;

  const verticalEnabled = verticalTiers?.enabled ?? false;
  const tierSampleCount = verticalTiers?.sampleCountPerTier ?? sampleCount;

  // Determine default azimuth and pitch from current camera position
  const getDefaultView = () => {
    if (!currentCameraPosition) {
      const basePitch = Math.atan(CAMERA_HEIGHT_FACTOR);
      return { azimuth: undefined as number | undefined, pitch: basePitch };
    }
    const dx = currentCameraPosition.x - target.targetX;
    const dy = currentCameraPosition.y - target.targetY;
    const dz = currentCameraPosition.z - target.targetZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!isFinite(dist) || dist < 1e-6) {
      const basePitch = Math.atan(CAMERA_HEIGHT_FACTOR);
      return { azimuth: undefined as number | undefined, pitch: basePitch };
    }
    const azimuth = Math.atan2(dz, dx);
    const pitch = Math.asin(THREE.MathUtils.clamp(dy / dist, -1, 1));
    return { azimuth, pitch };
  };

  const { azimuth: defaultAzimuth, pitch: defaultPitch } = getDefaultView();

  const basePitch = Math.atan(CAMERA_HEIGHT_FACTOR);
  const baseTiers: CameraPitchTier[] = [{ pitch: basePitch, tierIndex: 0 }];
  const fallbackTiers: CameraPitchTier[] = verticalEnabled
    ? [
        { pitch: basePitch, tierIndex: 0 },
        // Oblique tiers (prefer before extreme top/bottom)
        { pitch: THREE.MathUtils.degToRad(75), tierIndex: 1 },
        { pitch: THREE.MathUtils.degToRad(-15), tierIndex: 1 },
        // Extreme tiers as last resort
        { pitch: THREE.MathUtils.degToRad(88), tierIndex: 2 },
        { pitch: THREE.MathUtils.degToRad(-75), tierIndex: 2 },
      ]
    : baseTiers;

  interface ScoringCandidate extends PreviewCameraCandidate {
    tierIndex?: number;
  }

  let bestCandidate: ScoringCandidate | null = null;
  let bestWasOccluded = false;
  let bestScore = -Infinity;

  /**
   * Score all candidates at a given distance for the specified pitch tiers.
   * Returns the best scored candidate along with occlusion metadata.
   */
  const scoreAtDistance = (distance: number, tiers: CameraPitchTier[]): {
    scored: RaycastCameraCandidateScore | null;
    candidates: PreviewCameraCandidate[];
    wasOccluded: boolean;
  } => {
    const candidates = generatePreviewCameraCandidatesWithPitchTiers({
      target: [target.targetX, target.targetY, target.targetZ],
      distance,
      defaultAzimuth: defaultAzimuth ?? Math.PI / 4,
      sampleCount: tierSampleCount,
      pitchTiers: tiers,
      defaultPitch,
    });

    const scored =
      pickBestPreviewCameraCandidateByRaycastWithMetrics({
        candidates,
        scene,
        targetObjectId,
        targetChildPath,
        baseTarget: [target.targetX, target.targetY, target.targetZ],
        startTarget: [target.targetX, target.targetY, target.targetZ],
        endTarget: [target.targetX, target.targetY, target.targetZ],
        boundsSize: target.boundsSize,
        azimuthBiasStrength,
        breathingRoomMode: breathingEnabled ? mode : 'legacy',
        sampleRadiusScale,
        sampleMinRadius,
        includeDiagonalSamples,
        minVisibilityWeight,
      }) ?? null;

    const defaultCandidate = candidates[0];
    const wasOccluded =
      !!defaultCandidate && !!scored && scored.candidate.azimuth !== defaultCandidate.azimuth;

    return { scored, candidates, wasOccluded };
  };

  for (const mult of breathingEnabled ? distanceMultipliers : [1]) {
    const distance = ideal.distance * mult;

    // Phase 1: base tier only
    const baseResult = scoreAtDistance(distance, baseTiers);
    if (baseResult.scored) {
      if (baseResult.scored.clearFraction >= minClearFraction) {
        bestCandidate = baseResult.scored.candidate;
        bestWasOccluded = baseResult.wasOccluded;
        break;
      }
      // Keep as best-so-far (with small penalty for backing off)
      const distancePenalty = (mult - 1) * 0.25;
      const adjustedScore = baseResult.scored.score - distancePenalty;
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestCandidate = baseResult.scored.candidate;
        bestWasOccluded = baseResult.wasOccluded;
      }
    }

    // Phase 2: include vertical tiers (fallback) only if base didn't meet threshold
    if (verticalEnabled && (!baseResult.scored || baseResult.scored.clearFraction < minClearFraction)) {
      const fallbackResult = scoreAtDistance(distance, fallbackTiers);
      if (fallbackResult.scored) {
        if (fallbackResult.scored.clearFraction >= minClearFraction) {
          bestCandidate = fallbackResult.scored.candidate;
          bestWasOccluded = fallbackResult.wasOccluded;
          break;
        }
        const distancePenalty = (mult - 1) * 0.25;
        const adjustedScore = fallbackResult.scored.score - distancePenalty;
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestCandidate = fallbackResult.scored.candidate;
          bestWasOccluded = fallbackResult.wasOccluded;
        }
      }
    }
  }

  if (!bestCandidate) {
    // Should be extremely rare; fall back to the ideal camera position.
    return {
      position: clampFocusCameraAboveGround(new THREE.Vector3(ideal.x, ideal.y, ideal.z)),
      target: targetVec,
      azimuth: 0,
      wasOccluded: false,
    };
  }

  return {
    position: clampFocusCameraAboveGround(
      new THREE.Vector3(bestCandidate.position[0], bestCandidate.position[1], bestCandidate.position[2])
    ),
    target: targetVec,
    azimuth: bestCandidate.azimuth,
    wasOccluded: bestWasOccluded,
  };
}

/**
 * Async progressive version of occlusion-aware focus camera selection.
 * This avoids blocking the UI thread on heavy scenes by yielding between candidate batches.
 */
export async function calculateOcclusionAwareFocusCameraAsync(
  params: FocusCameraParams
): Promise<FocusCameraResult> {
  const {
    target,
    scene,
    targetObjectId,
    targetChildPath,
    currentCameraPosition,
    sampleCount = 12,
    azimuthBiasStrength = 0.25,
    breathingRoom,
    verticalTiers,
    progressive,
  } = params;

  const targetVec = new THREE.Vector3(target.targetX, target.targetY, target.targetZ);
  const ideal = calculateIdealCameraPosition(target);

  const breathingEnabled = breathingRoom?.enabled ?? false;
  const mode = breathingRoom?.mode ?? 'strict';
  const minClearFraction = breathingRoom?.minClearFraction ?? 0.9;
  const distanceMultipliers = breathingRoom?.distanceMultipliers ?? [1, 1.15, 1.3];
  const sampleRadiusScale = breathingRoom?.sampleRadiusScale ?? 0.35;
  const sampleMinRadius = breathingRoom?.sampleMinRadius ?? 0.12;
  const includeDiagonalSamples = breathingRoom?.includeDiagonalSamples ?? true;
  const minVisibilityWeight = breathingRoom?.minVisibilityWeight ?? 1.8;

  const verticalEnabled = verticalTiers?.enabled ?? true;
  const tierSampleCount = verticalTiers?.sampleCountPerTier ?? sampleCount;

  const getDefaultView = () => {
    if (!currentCameraPosition) {
      const basePitch = Math.atan(CAMERA_HEIGHT_FACTOR);
      return { azimuth: undefined as number | undefined, pitch: basePitch };
    }
    const dx = currentCameraPosition.x - target.targetX;
    const dy = currentCameraPosition.y - target.targetY;
    const dz = currentCameraPosition.z - target.targetZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!isFinite(dist) || dist < 1e-6) {
      const basePitch = Math.atan(CAMERA_HEIGHT_FACTOR);
      return { azimuth: undefined as number | undefined, pitch: basePitch };
    }
    const azimuth = Math.atan2(dz, dx);
    const pitch = Math.asin(THREE.MathUtils.clamp(dy / dist, -1, 1));
    return { azimuth, pitch };
  };

  const { azimuth: defaultAzimuth, pitch: defaultPitch } = getDefaultView();

  const basePitch = Math.atan(CAMERA_HEIGHT_FACTOR);
  const baseTiers: CameraPitchTier[] = [{ pitch: basePitch, tierIndex: 0 }];
  const fallbackTiers: CameraPitchTier[] = verticalEnabled
    ? [
        { pitch: basePitch, tierIndex: 0 },
        // Oblique tiers (prefer before extreme top/bottom)
        { pitch: THREE.MathUtils.degToRad(75), tierIndex: 1 },
        { pitch: THREE.MathUtils.degToRad(-15), tierIndex: 1 },
        // Extreme tiers as last resort
        { pitch: THREE.MathUtils.degToRad(88), tierIndex: 2 },
        { pitch: THREE.MathUtils.degToRad(-75), tierIndex: 2 },
      ]
    : baseTiers;

  interface ScoringCandidate extends PreviewCameraCandidate {
    tierIndex?: number;
  }

  let bestCandidate: ScoringCandidate | null = null;
  let bestWasOccluded = false;
  let bestScore = -Infinity;

  /**
   * Score all candidates at a given distance for the specified pitch tiers (async version).
   * Returns the best scored candidate along with occlusion metadata.
   */
  const scoreAtDistance = async (distance: number, tiers: CameraPitchTier[]): Promise<{
    scored: RaycastCameraCandidateScore | null;
    candidates: PreviewCameraCandidate[];
    wasOccluded: boolean;
  }> => {
    const candidates = generatePreviewCameraCandidatesWithPitchTiers({
      target: [target.targetX, target.targetY, target.targetZ],
      distance,
      defaultAzimuth: defaultAzimuth ?? Math.PI / 4,
      sampleCount: tierSampleCount,
      pitchTiers: tiers,
      defaultPitch,
    });

    const scoreWith = async (opts: { includeDiagonalSamples: boolean }) => {
      return (
        (await pickBestPreviewCameraCandidateByRaycastWithMetricsAsync({
          candidates,
          scene,
          targetObjectId,
          targetChildPath,
          baseTarget: [target.targetX, target.targetY, target.targetZ],
          startTarget: [target.targetX, target.targetY, target.targetZ],
          endTarget: [target.targetX, target.targetY, target.targetZ],
          boundsSize: target.boundsSize,
          azimuthBiasStrength,
          breathingRoomMode: breathingEnabled ? mode : 'legacy',
          sampleRadiusScale,
          sampleMinRadius,
          includeDiagonalSamples: opts.includeDiagonalSamples,
          minVisibilityWeight,
          progressive: {
            yieldEveryCandidates: progressive?.yieldEveryCandidates ?? 1,
            yieldAfterMs: progressive?.yieldAfterMs ?? 10,
            earlyExitClearFraction: progressive?.earlyExitClearFraction ?? minClearFraction,
          },
        })) ?? null
      );
    };

    // Performance safeguard: try a cheaper pass first (no diagonals), then only pay for diagonals
    // when we're borderline and "breathing room" is enabled.
    let scored = await scoreWith({ includeDiagonalSamples: false });
    if (
      breathingEnabled &&
      includeDiagonalSamples &&
      scored &&
      scored.clearFraction < minClearFraction &&
      scored.clearFraction >= Math.max(0, minClearFraction - 0.2)
    ) {
      scored = await scoreWith({ includeDiagonalSamples: true });
    }

    const defaultCandidate = candidates[0];
    const wasOccluded =
      !!defaultCandidate && !!scored && scored.candidate.azimuth !== defaultCandidate.azimuth;

    return { scored, candidates, wasOccluded };
  };

  for (const mult of breathingEnabled ? distanceMultipliers : [1]) {
    const distance = ideal.distance * mult;

    // Phase 1: base tier only
    const baseResult = await scoreAtDistance(distance, baseTiers);
    if (baseResult.scored) {
      if (baseResult.scored.clearFraction >= minClearFraction) {
        bestCandidate = baseResult.scored.candidate;
        bestWasOccluded = baseResult.wasOccluded;
        break;
      }
      // Keep as best-so-far (with small penalty for backing off)
      const distancePenalty = (mult - 1) * 0.25;
      const adjustedScore = baseResult.scored.score - distancePenalty;
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestCandidate = baseResult.scored.candidate;
        bestWasOccluded = baseResult.wasOccluded;
      }
    }

    // Phase 2: include vertical tiers (fallback) only if base didn't meet threshold
    if (verticalEnabled) {
      const fallbackResult = await scoreAtDistance(distance, fallbackTiers);
      if (fallbackResult.scored) {
        if (fallbackResult.scored.clearFraction >= minClearFraction) {
          bestCandidate = fallbackResult.scored.candidate;
          bestWasOccluded = fallbackResult.wasOccluded;
          break;
        }
        const distancePenalty = (mult - 1) * 0.25;
        const adjustedScore = fallbackResult.scored.score - distancePenalty;
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestCandidate = fallbackResult.scored.candidate;
          bestWasOccluded = fallbackResult.wasOccluded;
        }
      }
    }
  }

  if (!bestCandidate) {
    return {
      position: clampFocusCameraAboveGround(new THREE.Vector3(ideal.x, ideal.y, ideal.z)),
      target: targetVec,
      azimuth: 0,
      wasOccluded: false,
    };
  }

  return {
    position: clampFocusCameraAboveGround(
      new THREE.Vector3(bestCandidate.position[0], bestCandidate.position[1], bestCandidate.position[2])
    ),
    target: targetVec,
    azimuth: bestCandidate.azimuth,
    wasOccluded: bestWasOccluded,
  };
}
