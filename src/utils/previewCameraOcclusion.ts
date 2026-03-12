import * as THREE from 'three';
import type { PreviewCameraCandidate } from './previewCameraCalculator';

export interface RaycastCameraCandidateScore {
  candidate: PreviewCameraCandidate;
  /**
   * Composite score used for selection (higher is better).
   * Meaning depends on scoring mode, but is always comparable within a call.
   */
  score: number;
  /** Minimum per-sample visibility ratio \([0..1]\) */
  minVisibility: number;
  /** Average per-sample visibility ratio \([0..1]\) */
  avgVisibility: number;
  /** Number of fully-clear sample rays */
  clearCount: number;
  /** clearCount / sampleCount */
  clearFraction: number;
  /** Number of sample rays evaluated */
  sampleCount: number;
}

export type RaycastBreathingRoomMode = 'legacy' | 'strict';

function isChildPathWithinTargetSubtree(
  targetChildPath: string | undefined,
  hitChildPath: string | null
): boolean {
  if (!targetChildPath) return true;
  if (!hitChildPath) return false;
  return hitChildPath === targetChildPath || hitChildPath.startsWith(targetChildPath + '.');
}

export interface RaycastProgressiveOptions {
  /** Yield after this many candidates are evaluated (best-effort). */
  yieldEveryCandidates?: number;
  /** Yield after spending at least this many ms of CPU time (best-effort). */
  yieldAfterMs?: number;
  /** Required clear fraction for early-exit in progressive mode. */
  earlyExitClearFraction?: number;
}

/**
 * Choose the best preview camera candidate using raycasts against the real scene.
 *
 * Goals:
 * - Prefer viewpoints where the target is clearly visible (not just barely visible)
 * - Prefer some “breathing room” around the target by sampling multiple nearby points
 * - If nothing is fully clear, choose the least-occluded candidate (best-effort)
 * - Keep results intentional: candidates are assumed to be pre-sorted by desirability
 *   (e.g. closeness to default azimuth). The first perfect candidate is returned immediately.
 */
export function pickBestPreviewCameraCandidateByRaycast(params: {
  candidates: PreviewCameraCandidate[];
  scene: THREE.Scene;
  /** SceneObject ID of the interactive target */
  targetObjectId: string;
  /** Optional: child path to target within the object (when the step targets a child mesh) */
  targetChildPath?: string;
  /** Look-at target (meters) */
  baseTarget: [number, number, number];
  /** Start focus target (meters) */
  startTarget: [number, number, number];
  /** End focus target (meters) */
  endTarget: [number, number, number];
  /** Effective bounds size of the framed region (meters) */
  boundsSize: number;
  /**
   * Optional strength for the azimuth delta penalty.
   * Larger values prefer candidates closer to the default azimuth more aggressively.
   * Defaults to the legacy preview behavior.
   */
  azimuthBiasStrength?: number;
  /** How far from the target to sample for “breathing room” checks */
  sampleRadiusScale?: number;
  /** Minimum sample radius in meters (prevents tiny targets from being too lenient) */
  sampleMinRadius?: number;
  /** Include diagonal sample points for tighter corner clearance */
  includeDiagonalSamples?: boolean;
  /** Scoring mode; strict enforces stronger “breathing room” */
  breathingRoomMode?: RaycastBreathingRoomMode;
  /** In strict mode, how strongly to reward the worst-case visibility */
  minVisibilityWeight?: number;
}): PreviewCameraCandidate | null {
  return pickBestPreviewCameraCandidateByRaycastWithMetrics(params)?.candidate ?? null;
}

/**
 * Same as `pickBestPreviewCameraCandidateByRaycast`, but also returns per-candidate visibility metrics.
 * This is useful when callers want to “back off” the camera distance to get more clearance.
 */
export function pickBestPreviewCameraCandidateByRaycastWithMetrics(params: {
  candidates: PreviewCameraCandidate[];
  scene: THREE.Scene;
  targetObjectId: string;
  targetChildPath?: string;
  baseTarget: [number, number, number];
  startTarget: [number, number, number];
  endTarget: [number, number, number];
  boundsSize: number;
  azimuthBiasStrength?: number;
  sampleRadiusScale?: number;
  sampleMinRadius?: number;
  includeDiagonalSamples?: boolean;
  breathingRoomMode?: RaycastBreathingRoomMode;
  minVisibilityWeight?: number;
}): RaycastCameraCandidateScore | null {
  const {
    candidates,
    scene,
    targetObjectId,
    targetChildPath,
    baseTarget,
    startTarget,
    endTarget,
    boundsSize,
    azimuthBiasStrength = 0.05,
    sampleRadiusScale = 0.25,
    sampleMinRadius = 0.08,
    includeDiagonalSamples = false,
    breathingRoomMode = 'legacy',
    minVisibilityWeight = 1.5,
  } = params;

  const occluders = collectOccluderMeshes(scene);
  if (occluders.length === 0) {
    const first = candidates[0] ?? null;
    return first
      ? {
          candidate: first,
          score: 0,
          minVisibility: 1,
          avgVisibility: 1,
          clearCount: 1,
          clearFraction: 1,
          sampleCount: 1,
        }
      : null;
  }

  const raycaster = new THREE.Raycaster();
  const camPos = new THREE.Vector3();
  const point = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const center = new THREE.Vector3(baseTarget[0], baseTarget[1], baseTarget[2]);
  const start = new THREE.Vector3(startTarget[0], startTarget[1], startTarget[2]);
  const end = new THREE.Vector3(endTarget[0], endTarget[1], endTarget[2]);

  // Sample around the target to enforce “breathing room” instead of barely-visible.
  const r = Math.max(sampleMinRadius, boundsSize * sampleRadiusScale);
  const samplePoints: THREE.Vector3[] = [
    center,
    start,
    end,
    center.clone().add(new THREE.Vector3(r, 0, 0)),
    center.clone().add(new THREE.Vector3(-r, 0, 0)),
    center.clone().add(new THREE.Vector3(0, r, 0)),
    center.clone().add(new THREE.Vector3(0, -r, 0)),
    center.clone().add(new THREE.Vector3(0, 0, r)),
    center.clone().add(new THREE.Vector3(0, 0, -r)),
  ];

  if (includeDiagonalSamples) {
    samplePoints.push(
      center.clone().add(new THREE.Vector3(r, r, 0)),
      center.clone().add(new THREE.Vector3(r, -r, 0)),
      center.clone().add(new THREE.Vector3(-r, r, 0)),
      center.clone().add(new THREE.Vector3(-r, -r, 0)),
      center.clone().add(new THREE.Vector3(r, 0, r)),
      center.clone().add(new THREE.Vector3(r, 0, -r)),
      center.clone().add(new THREE.Vector3(-r, 0, r)),
      center.clone().add(new THREE.Vector3(-r, 0, -r)),
      center.clone().add(new THREE.Vector3(0, r, r)),
      center.clone().add(new THREE.Vector3(0, r, -r)),
      center.clone().add(new THREE.Vector3(0, -r, r)),
      center.clone().add(new THREE.Vector3(0, -r, -r))
    );
  }
  const perfectScore = samplePoints.length;

  const isTargetHit = (hit: THREE.Intersection): boolean => {
    const hitObjectId = getSceneObjectId(hit.object);
    if (hitObjectId !== targetObjectId) return false;
    const hitChildPath = getChildPathTag(hit.object);
    return isChildPathWithinTargetSubtree(targetChildPath, hitChildPath);
  };

  const scoreCandidate = (candidate: PreviewCameraCandidate): RaycastCameraCandidateScore => {
    camPos.set(candidate.position[0], candidate.position[1], candidate.position[2]);

    let legacyScore = 0;
    let minVisibility = 1;
    let sumVisibility = 0;
    let clearCount = 0;

    for (const p of samplePoints) {
      point.copy(p);
      dir.subVectors(point, camPos);
      const dist = dir.length();
      if (dist < 1e-6) {
        legacyScore += 1;
        minVisibility = Math.min(minVisibility, 1);
        sumVisibility += 1;
        clearCount += 1;
        continue;
      }
      dir.normalize();

      raycaster.set(camPos, dir);
      raycaster.far = dist;

      // occluders is a flat mesh list, so recursive traversal is unnecessary.
      const hits = raycaster.intersectObjects(occluders, false);
      if (hits.length === 0) {
        legacyScore += 1;
        minVisibility = Math.min(minVisibility, 1);
        sumVisibility += 1;
        clearCount += 1;
        continue;
      }

      const first = hits[0];
      if (isTargetHit(first)) {
        legacyScore += 1;
        minVisibility = Math.min(minVisibility, 1);
        sumVisibility += 1;
        clearCount += 1;
      } else {
        const visibilityRatio = clamp01(first.distance / dist);
        minVisibility = Math.min(minVisibility, visibilityRatio);
        sumVisibility += visibilityRatio;
        // Best-effort partial score:
        // Prefer candidates where the occluder occurs closer to the target than to the camera,
        // meaning more of the ray segment is unobstructed.
        legacyScore += visibilityRatio * 0.3;
      }
    }

    const avgVisibility = sumVisibility / Math.max(1, samplePoints.length);
    const clearFraction = clearCount / Math.max(1, samplePoints.length);

    // Small bias toward candidates closer to the default azimuth.
    // Candidates are already sorted by azimuthDelta, so this is mostly a tie-breaker.
    const azimuthPenalty = clamp01(candidate.azimuthDelta / Math.PI) * azimuthBiasStrength;

    const score =
      breathingRoomMode === 'strict'
        ? // Strict scoring: strongly prefer candidates whose *worst* sample ray is good,
          // which avoids “peeking around a corner” where 1-2 sample points are still blocked.
          avgVisibility + minVisibility * minVisibilityWeight - azimuthPenalty
        : // Legacy scoring (preview/publish compatibility)
          legacyScore - azimuthPenalty;

    // Small bias toward candidates closer to the default azimuth.
    // Candidates are already sorted by azimuthDelta, so this is mostly a tie-breaker.
    return {
      candidate,
      score,
      minVisibility,
      avgVisibility,
      clearCount,
      clearFraction,
      sampleCount: samplePoints.length,
    };
  };

  let best: RaycastCameraCandidateScore | null = null;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const s = scoreCandidate(candidate);
    // Early exit: candidates are pre-sorted toward the default azimuth,
    // so the first perfect-scoring candidate is both clear and intentional.
    if (s.clearCount >= perfectScore) return s;
    if (s.score > bestScore) {
      bestScore = s.score;
      best = s;
    }
  }

  return best;
}

/**
 * Progressive async version of `pickBestPreviewCameraCandidateByRaycastWithMetrics`.
 *
 * Motivation: large scenes can make raycasting expensive enough to stall the UI.
 * This function yields back to the browser regularly so camera motion and UI remain responsive.
 */
export async function pickBestPreviewCameraCandidateByRaycastWithMetricsAsync(params: {
  candidates: PreviewCameraCandidate[];
  scene: THREE.Scene;
  targetObjectId: string;
  targetChildPath?: string;
  baseTarget: [number, number, number];
  startTarget: [number, number, number];
  endTarget: [number, number, number];
  boundsSize: number;
  azimuthBiasStrength?: number;
  sampleRadiusScale?: number;
  sampleMinRadius?: number;
  includeDiagonalSamples?: boolean;
  breathingRoomMode?: RaycastBreathingRoomMode;
  minVisibilityWeight?: number;
  progressive?: RaycastProgressiveOptions;
}): Promise<RaycastCameraCandidateScore | null> {
  const {
    candidates,
    scene,
    targetObjectId,
    targetChildPath,
    baseTarget,
    startTarget,
    endTarget,
    boundsSize,
    azimuthBiasStrength = 0.05,
    sampleRadiusScale = 0.25,
    sampleMinRadius = 0.08,
    includeDiagonalSamples = false,
    breathingRoomMode = 'legacy',
    minVisibilityWeight = 1.5,
    progressive,
  } = params;

  const yieldEveryCandidates = progressive?.yieldEveryCandidates ?? 2;
  const yieldAfterMs = progressive?.yieldAfterMs ?? 10;
  const earlyExitClearFraction = progressive?.earlyExitClearFraction ?? 1;

  const occluders = collectOccluderMeshes(scene);
  if (occluders.length === 0) {
    const first = candidates[0] ?? null;
    return first
      ? {
          candidate: first,
          score: 0,
          minVisibility: 1,
          avgVisibility: 1,
          clearCount: 1,
          clearFraction: 1,
          sampleCount: 1,
        }
      : null;
  }

  const raycaster = new THREE.Raycaster();
  const camPos = new THREE.Vector3();
  const point = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const center = new THREE.Vector3(baseTarget[0], baseTarget[1], baseTarget[2]);
  const start = new THREE.Vector3(startTarget[0], startTarget[1], startTarget[2]);
  const end = new THREE.Vector3(endTarget[0], endTarget[1], endTarget[2]);

  const r = Math.max(sampleMinRadius, boundsSize * sampleRadiusScale);
  const samplePoints: THREE.Vector3[] = [
    center,
    start,
    end,
    center.clone().add(new THREE.Vector3(r, 0, 0)),
    center.clone().add(new THREE.Vector3(-r, 0, 0)),
    center.clone().add(new THREE.Vector3(0, r, 0)),
    center.clone().add(new THREE.Vector3(0, -r, 0)),
    center.clone().add(new THREE.Vector3(0, 0, r)),
    center.clone().add(new THREE.Vector3(0, 0, -r)),
  ];

  if (includeDiagonalSamples) {
    samplePoints.push(
      center.clone().add(new THREE.Vector3(r, r, 0)),
      center.clone().add(new THREE.Vector3(r, -r, 0)),
      center.clone().add(new THREE.Vector3(-r, r, 0)),
      center.clone().add(new THREE.Vector3(-r, -r, 0)),
      center.clone().add(new THREE.Vector3(r, 0, r)),
      center.clone().add(new THREE.Vector3(r, 0, -r)),
      center.clone().add(new THREE.Vector3(-r, 0, r)),
      center.clone().add(new THREE.Vector3(-r, 0, -r)),
      center.clone().add(new THREE.Vector3(0, r, r)),
      center.clone().add(new THREE.Vector3(0, r, -r)),
      center.clone().add(new THREE.Vector3(0, -r, r)),
      center.clone().add(new THREE.Vector3(0, -r, -r))
    );
  }

  const isTargetHit = (hit: THREE.Intersection): boolean => {
    const hitObjectId = getSceneObjectId(hit.object);
    if (hitObjectId !== targetObjectId) return false;
    const hitChildPath = getChildPathTag(hit.object);
    return isChildPathWithinTargetSubtree(targetChildPath, hitChildPath);
  };

  /**
   * Get current timestamp in milliseconds (browser-safe).
   */
  const nowMs = (): number => {
    const perf = (globalThis as { performance?: Performance }).performance;
    return typeof perf?.now === 'function' ? perf.now() : Date.now();
  };

  /**
   * Yield control back to the browser to keep UI responsive.
   */
  const yieldToBrowser = (): Promise<void> =>
    new Promise<void>((resolve) => {
      const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
      if (typeof raf === 'function') {
        raf(() => resolve());
      } else {
        setTimeout(() => resolve(), 0);
      }
    });

  const scoreCandidate = (candidate: PreviewCameraCandidate): RaycastCameraCandidateScore => {
    camPos.set(candidate.position[0], candidate.position[1], candidate.position[2]);

    let legacyScore = 0;
    let minVisibility = 1;
    let sumVisibility = 0;
    let clearCount = 0;

    for (const p of samplePoints) {
      point.copy(p);
      dir.subVectors(point, camPos);
      const dist = dir.length();
      if (dist < 1e-6) {
        legacyScore += 1;
        sumVisibility += 1;
        clearCount += 1;
        continue;
      }
      dir.normalize();

      raycaster.set(camPos, dir);
      raycaster.far = dist;

      const hits = raycaster.intersectObjects(occluders, false);
      if (hits.length === 0) {
        legacyScore += 1;
        sumVisibility += 1;
        clearCount += 1;
        continue;
      }

      const first = hits[0];
      if (isTargetHit(first)) {
        legacyScore += 1;
        sumVisibility += 1;
        clearCount += 1;
      } else {
        const visibilityRatio = clamp01(first.distance / dist);
        minVisibility = Math.min(minVisibility, visibilityRatio);
        sumVisibility += visibilityRatio;
        legacyScore += visibilityRatio * 0.3;
      }
    }

    const avgVisibility = sumVisibility / Math.max(1, samplePoints.length);
    const clearFraction = clearCount / Math.max(1, samplePoints.length);
    const azimuthPenalty = clamp01(candidate.azimuthDelta / Math.PI) * azimuthBiasStrength;

    const score =
      breathingRoomMode === 'strict'
        ? avgVisibility + minVisibility * minVisibilityWeight - azimuthPenalty
        : legacyScore - azimuthPenalty;

    return {
      candidate,
      score,
      minVisibility,
      avgVisibility,
      clearCount,
      clearFraction,
      sampleCount: samplePoints.length,
    };
  };

  let best: RaycastCameraCandidateScore | null = null;
  let bestScore = -Infinity;
  const startTime = nowMs();
  let lastYieldTime = startTime;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const s = scoreCandidate(candidate);
    if (s.score > bestScore) {
      bestScore = s.score;
      best = s;
    }

    // Early-exit when we find a view that's clear enough (by fraction), respecting candidate ordering.
    if (s.clearFraction >= earlyExitClearFraction) {
      return s;
    }

    const shouldYieldByCount = yieldEveryCandidates > 0 && (i + 1) % yieldEveryCandidates === 0;
    const t = nowMs();
    const shouldYieldByTime = t - lastYieldTime >= yieldAfterMs;
    if (shouldYieldByCount || shouldYieldByTime) {
      lastYieldTime = t;
      await yieldToBrowser();
    }
  }

  return best;
}

/**
 * User data interface for Three.js objects involved in raycasting.
 * Used to identify which SceneObject and child path a mesh belongs to.
 */
interface SceneRaycastUserData {
  sceneObjectId?: string;
  childPath?: string | null;
}

const occluderCache = new WeakMap<THREE.Scene, { meshes: THREE.Mesh[]; timestamp: number }>();
const OCCLUDER_CACHE_TTL_MS = 500;

/**
 * Traverse up the object hierarchy to find the SceneObject ID.
 * @param obj - The Three.js object to search from
 * @returns The SceneObject ID, or null if not found
 */
function getSceneObjectId(obj: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    const ud = current.userData as SceneRaycastUserData | undefined;
    if (ud && typeof ud.sceneObjectId === 'string') return ud.sceneObjectId;
    current = current.parent;
  }
  return null;
}

/**
 * Traverse up the object hierarchy to find the child path tag.
 * @param obj - The Three.js object to search from
 * @returns The child path string, or null if this is a parent object
 */
function getChildPathTag(obj: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    const ud = current.userData as SceneRaycastUserData | undefined;
    if (!ud) {
      current = current.parent;
      continue;
    }
    if (typeof ud.childPath === 'string') return ud.childPath;
    if (ud.childPath === null) return null;
    current = current.parent;
  }
  return null;
}

/**
 * Collect all mesh objects in the scene that can act as occluders.
 * Results are cached for 500ms to avoid redundant scene traversals.
 * @param scene - The Three.js scene to search
 * @returns Array of meshes with sceneObjectId tags
 */
function collectOccluderMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const cached = occluderCache.get(scene);
  const now = Date.now();
  if (cached && now - cached.timestamp < OCCLUDER_CACHE_TTL_MS) {
    return cached.meshes;
  }

  const meshes: THREE.Mesh[] = [];
  scene.traverse((node) => {
    const ud = node.userData as SceneRaycastUserData | undefined;
    if (node instanceof THREE.Mesh && ud && typeof ud.sceneObjectId === 'string') {
      meshes.push(node);
    }
  });
  occluderCache.set(scene, { meshes, timestamp: now });
  return meshes;
}

/**
 * Clamp a number to the range [0, 1].
 * @param v - The value to clamp
 * @returns The clamped value
 */
function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export interface CameraVisibilityResult {
  /** Number of sample rays that were fully clear (hit target first or hit nothing). */
  clearCount: number;
  /** clearCount / sampleCount */
  clearFraction: number;
  /** Number of sample rays evaluated */
  sampleCount: number;
}

/**
 * Lightweight visibility evaluation for a single camera position.
 *
 * Intended for fast-path checks (e.g. editor selection) where we want to avoid scoring a whole ring
 * of candidates if the “obvious” view is already clear.
 *
 * Notes:
 * - Uses the same occluder collection cache as full candidate scoring.
 * - Treats a ray as clear when its first hit is the target (object + optional childPath) or when
 *   there are no hits.
 */
export function evaluateCameraVisibility(params: {
  scene: THREE.Scene;
  cameraPosition: THREE.Vector3;
  targetObjectId: string;
  targetChildPath?: string;
  samplePoints: THREE.Vector3[];
}): CameraVisibilityResult {
  const { scene, cameraPosition, targetObjectId, targetChildPath, samplePoints } = params;

  const occluders = collectOccluderMeshes(scene);
  const sampleCount = samplePoints.length;

  if (sampleCount === 0) {
    return { clearCount: 0, clearFraction: 0, sampleCount: 0 };
  }

  if (occluders.length === 0) {
    return { clearCount: sampleCount, clearFraction: 1, sampleCount };
  }

  const raycaster = new THREE.Raycaster();
  const camPos = new THREE.Vector3().copy(cameraPosition);
  const point = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const isTargetHit = (hit: THREE.Intersection): boolean => {
    const hitObjectId = getSceneObjectId(hit.object);
    if (hitObjectId !== targetObjectId) return false;
    const hitChildPath = getChildPathTag(hit.object);
    return isChildPathWithinTargetSubtree(targetChildPath, hitChildPath);
  };

  let clearCount = 0;

  for (const p of samplePoints) {
    point.copy(p);
    dir.subVectors(point, camPos);
    const dist = dir.length();
    if (dist < 1e-6) {
      clearCount += 1;
      continue;
    }
    dir.normalize();

    raycaster.set(camPos, dir);
    raycaster.far = dist;

    const hits = raycaster.intersectObjects(occluders, false);
    if (hits.length === 0) {
      clearCount += 1;
      continue;
    }

    const first = hits[0];
    if (isTargetHit(first)) {
      clearCount += 1;
    }
  }

  return {
    clearCount,
    clearFraction: clearCount / sampleCount,
    sampleCount,
  };
}
