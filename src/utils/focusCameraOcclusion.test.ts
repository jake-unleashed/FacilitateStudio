import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CAMERA_VIEWING_ANGLE, calculateIdealCameraPosition, type FocusTarget } from './focusUtils';
import {
  MIN_FOCUS_CAMERA_Y,
  calculateOcclusionAwareFocusCamera,
  calculateQuickFocusCamera,
} from './focusCameraOcclusion';
import { generatePreviewCameraCandidates } from './previewCameraCalculator';

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

describe('calculateOcclusionAwareFocusCamera', () => {
  it('returns the default candidate when nothing occludes the target', () => {
    const scene = new THREE.Scene();

    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };
    const ideal = calculateIdealCameraPosition(target);

    // Add a visible target mesh so raycasts can “hit” it.
    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
      })
    );
    scene.updateMatrixWorld(true);

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      sampleCount: 12,
    });

    const candidates = generatePreviewCameraCandidates({
      target: [target.targetX, target.targetY, target.targetZ],
      distance: ideal.distance,
      defaultAzimuth: CAMERA_VIEWING_ANGLE,
      sampleCount: 12,
    });

    expect(result.wasOccluded).toBe(false);
    expect(result.azimuth).toBeCloseTo(candidates[0].azimuth, 6);
    expect(result.position.x).toBeCloseTo(candidates[0].position[0], 6);
    expect(result.position.y).toBeCloseTo(candidates[0].position[1], 6);
    expect(result.position.z).toBeCloseTo(candidates[0].position[2], 6);
  });

  it('never returns a focus camera position below the ground plane', () => {
    const scene = new THREE.Scene();

    // Place the target below the ground plane so the naive ideal position would be below y=0.
    const target: FocusTarget = { targetX: 0, targetY: -10, targetZ: 0, boundsSize: 1 };

    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, -10, 0),
        sceneObjectId: 'target',
      })
    );
    scene.updateMatrixWorld(true);

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      sampleCount: 12,
    });

    expect(result.position.y).toBeGreaterThanOrEqual(MIN_FOCUS_CAMERA_Y);
  });

  it('chooses a non-default azimuth when the default view is occluded', () => {
    const scene = new THREE.Scene();

    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };
    const ideal = calculateIdealCameraPosition(target);

    // Add target mesh
    const targetMesh = buildTaggedMesh({
      geometry: new THREE.SphereGeometry(0.3, 12, 12),
      position: new THREE.Vector3(0, 0, 0),
      sceneObjectId: 'target',
    });
    scene.add(targetMesh);

    // Compute the default candidate camera position and place an occluder on that ray.
    const candidates = generatePreviewCameraCandidates({
      target: [target.targetX, target.targetY, target.targetZ],
      distance: ideal.distance,
      defaultAzimuth: CAMERA_VIEWING_ANGLE,
      sampleCount: 12,
    });
    const defaultPos = new THREE.Vector3(
      candidates[0].position[0],
      candidates[0].position[1],
      candidates[0].position[2]
    );

    // Place the occluder between camera and target along the default ray.
    const mid = defaultPos.clone().multiplyScalar(0.5);
    const occluder = buildTaggedMesh({
      geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
      position: mid,
      sceneObjectId: 'occluder',
    });
    scene.add(occluder);
    scene.updateMatrixWorld(true);

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      sampleCount: 12,
    });

    expect(result.wasOccluded).toBe(true);
    expect(result.azimuth).not.toBeCloseTo(candidates[0].azimuth, 6);
  });

  it('prefers the closest unobstructed angle to the current camera direction', () => {
    const scene = new THREE.Scene();

    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };
    const ideal = calculateIdealCameraPosition(target);

    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
      })
    );

    // Put the current camera at azimuth ~0 (positive X), at the ideal distance.
    const currentCameraPosition = new THREE.Vector3(ideal.distance, ideal.y, 0);

    // Build candidates around the CURRENT azimuth (0) so we can place occluders deterministically.
    const candidates = generatePreviewCameraCandidates({
      target: [0, 0, 0],
      distance: ideal.distance,
      defaultAzimuth: 0,
      sampleCount: 4, // 0, 90, 180, 270
    });

    // Occlude the default (0 deg) and also occlude 270 deg.
    const occludeAlong = (pos: [number, number, number]) => {
      const p = new THREE.Vector3(pos[0], pos[1], pos[2]);
      const mid = p.clone().multiplyScalar(0.5);
      scene.add(
        buildTaggedMesh({
          geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
          position: mid,
          sceneObjectId: 'occluder',
        })
      );
    };

    occludeAlong(candidates[0].position); // 0 deg
    occludeAlong(candidates[3].position); // 270 deg (closest tie, but we'll block it)
    scene.updateMatrixWorld(true);

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      currentCameraPosition,
      sampleCount: 4,
      azimuthBiasStrength: 0.5,
    });

    // With 0 and 270 blocked, the closest clear viewpoint to current (0) is 90deg, not 180deg.
    expect(result.azimuth).toBeCloseTo(candidates[1].azimuth, 6);
  });
});

describe('calculateQuickFocusCamera', () => {
  it('uses the current view direction when the obvious view is clear', () => {
    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };
    const ideal = calculateIdealCameraPosition(target);

    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
      })
    );
    scene.updateMatrixWorld(true);

    const currentCameraPosition = new THREE.Vector3(2, 1, -3);
    const expectedDir = currentCameraPosition.clone().normalize();
    const expectedPos = expectedDir.clone().multiplyScalar(ideal.distance);

    const result = calculateQuickFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      currentCameraPosition,
    });

    expect(result.shouldUseFastPath).toBe(true);
    expect(result.position).toBeDefined();
    expect(result.position!.distanceTo(new THREE.Vector3(0, 0, 0))).toBeCloseTo(ideal.distance, 6);
    expect(result.position!.x).toBeCloseTo(expectedPos.x, 6);
    expect(result.position!.y).toBeCloseTo(expectedPos.y, 6);
    expect(result.position!.z).toBeCloseTo(expectedPos.z, 6);
  });

  it('falls back when the obvious view is occluded', () => {
    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };
    const ideal = calculateIdealCameraPosition(target);

    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
      })
    );

    const currentCameraPosition = new THREE.Vector3(2, 1, -3);
    const expectedDir = currentCameraPosition.clone().normalize();
    const quickPos = expectedDir.clone().multiplyScalar(ideal.distance);

    // Block the center ray from the quick camera position to the target.
    scene.add(
      buildTaggedMesh({
        geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
        position: quickPos.clone().multiplyScalar(0.5),
        sceneObjectId: 'occluder',
      })
    );
    scene.updateMatrixWorld(true);

    const result = calculateQuickFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      currentCameraPosition,
    });

    expect(result.shouldUseFastPath).toBe(false);
    expect(result.position).toBeUndefined();
  });

  it('respects targetChildPath tagging for child focus', () => {
    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };

    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
        childPath: 'a.b.c',
      })
    );
    scene.updateMatrixWorld(true);

    const result = calculateQuickFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      targetChildPath: 'a.b.c',
      currentCameraPosition: new THREE.Vector3(1, 1, 1),
    });

    expect(result.shouldUseFastPath).toBe(true);
    expect(result.position).toBeDefined();
  });

  it('never returns a focus camera position below the ground plane', () => {
    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };

    scene.add(
      buildTaggedMesh({
        geometry: new THREE.SphereGeometry(0.3, 12, 12),
        position: new THREE.Vector3(0, 0, 0),
        sceneObjectId: 'target',
      })
    );
    scene.updateMatrixWorld(true);

    const result = calculateQuickFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      currentCameraPosition: new THREE.Vector3(2, -5, 0),
    });

    expect(result.shouldUseFastPath).toBe(true);
    expect(result.position).toBeDefined();
    expect(result.position!.y).toBeGreaterThanOrEqual(MIN_FOCUS_CAMERA_Y);
  });
});

