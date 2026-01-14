import * as THREE from 'three';
import type { PreviewCameraCandidate } from './previewCameraCalculator';

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
}): PreviewCameraCandidate | null {
  const {
    candidates,
    scene,
    targetObjectId,
    targetChildPath,
    baseTarget,
    startTarget,
    endTarget,
    boundsSize,
  } = params;

  const occluders = collectOccluderMeshes(scene);
  if (occluders.length === 0) return candidates[0] ?? null;

  const raycaster = new THREE.Raycaster();
  const camPos = new THREE.Vector3();
  const point = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const center = new THREE.Vector3(baseTarget[0], baseTarget[1], baseTarget[2]);
  const start = new THREE.Vector3(startTarget[0], startTarget[1], startTarget[2]);
  const end = new THREE.Vector3(endTarget[0], endTarget[1], endTarget[2]);

  // Sample around the target to enforce “breathing room” instead of barely-visible.
  const r = Math.max(0.08, boundsSize * 0.25);
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
  const perfectScore = samplePoints.length;

  const isTargetHit = (hit: THREE.Intersection): boolean => {
    const hitObjectId = getSceneObjectId(hit.object);
    if (hitObjectId !== targetObjectId) return false;
    if (!targetChildPath) return true;
    const hitChildPath = getChildPathTag(hit.object);
    return hitChildPath === targetChildPath;
  };

  const scoreCandidate = (candidate: PreviewCameraCandidate): number => {
    camPos.set(candidate.position[0], candidate.position[1], candidate.position[2]);

    let score = 0;
    for (const p of samplePoints) {
      point.copy(p);
      dir.subVectors(point, camPos);
      const dist = dir.length();
      if (dist < 1e-6) {
        score += 1;
        continue;
      }
      dir.normalize();

      raycaster.set(camPos, dir);
      raycaster.far = dist;

      // occluders is a flat mesh list, so recursive traversal is unnecessary.
      const hits = raycaster.intersectObjects(occluders, false);
      if (hits.length === 0) {
        score += 1;
        continue;
      }

      const first = hits[0];
      if (isTargetHit(first)) {
        score += 1;
      } else {
        // Best-effort partial score:
        // Prefer candidates where the occluder occurs closer to the target than to the camera,
        // meaning more of the ray segment is unobstructed.
        const visibilityRatio = clamp01(first.distance / dist);
        score += visibilityRatio * 0.3;
      }
    }

    // Small bias toward candidates closer to the default azimuth.
    // Candidates are already sorted by azimuthDelta, so this is mostly a tie-breaker.
    score -= clamp01(candidate.azimuthDelta / Math.PI) * 0.05;
    return score;
  };

  let best: PreviewCameraCandidate | null = null;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const s = scoreCandidate(candidate);
    // Early exit: candidates are pre-sorted toward the default azimuth,
    // so the first perfect-scoring candidate is both clear and intentional.
    if (s >= perfectScore - 1e-6) return candidate;
    if (s > bestScore) {
      bestScore = s;
      best = candidate;
    }
  }

  return best;
}

interface SceneRaycastUserData {
  sceneObjectId?: string;
  childPath?: string | null;
}

function getSceneObjectId(obj: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    const ud = current.userData as SceneRaycastUserData | undefined;
    if (ud && typeof ud.sceneObjectId === 'string') return ud.sceneObjectId;
    current = current.parent;
  }
  return null;
}

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

function collectOccluderMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((node) => {
    const ud = node.userData as SceneRaycastUserData | undefined;
    if (node instanceof THREE.Mesh && ud && typeof ud.sceneObjectId === 'string') {
      meshes.push(node);
    }
  });
  return meshes;
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
