import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { PreviewCameraCandidate } from './previewCameraCalculator';
import {
  pickBestPreviewCameraCandidateByRaycastWithMetrics,
  pickBestPreviewCameraCandidateByRaycastWithMetricsAsync,
} from './previewCameraOcclusion';

function buildTaggedMesh(params: {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  sceneObjectId: string;
  childPath?: string | null;
}): THREE.Mesh {
  const { geometry, position, sceneObjectId, childPath = null } = params;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mesh.position.copy(position);
  mesh.userData.sceneObjectId = sceneObjectId;
  mesh.userData.childPath = childPath;
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('previewCameraOcclusion (async)', () => {
  it('async selector matches sync selector on simple scene', async () => {
    const scene = new THREE.Scene();

    // Target at origin.
    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
      })
    );

    // Occluder blocks candidate A (positive X) but not candidate B (negative X).
    scene.add(
      buildTaggedMesh({
        geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
        position: new THREE.Vector3(2.5, 0, 0),
        sceneObjectId: 'occluder',
      })
    );
    scene.updateMatrixWorld(true);

    const candidates: PreviewCameraCandidate[] = [
      { position: [5, 0, 0], azimuth: 0, azimuthDelta: 0 },
      { position: [-5, 0, 0], azimuth: Math.PI, azimuthDelta: 1 },
    ];

    const params = {
      candidates,
      scene,
      targetObjectId: 'target',
      baseTarget: [0, 0, 0] as [number, number, number],
      startTarget: [0, 0, 0] as [number, number, number],
      endTarget: [0, 0, 0] as [number, number, number],
      boundsSize: 1,
      azimuthBiasStrength: 0,
      breathingRoomMode: 'legacy' as const,
    };

    const sync = pickBestPreviewCameraCandidateByRaycastWithMetrics(params);
    const asyncRes = await pickBestPreviewCameraCandidateByRaycastWithMetricsAsync({
      ...params,
      progressive: { yieldEveryCandidates: 1, yieldAfterMs: 0, earlyExitClearFraction: 1 },
    });

    expect(sync?.candidate.position).toEqual(asyncRes?.candidate.position);
  });
});

