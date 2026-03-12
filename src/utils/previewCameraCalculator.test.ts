import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { calculatePreviewMoveItemCamera } from './previewCameraCalculator';
import { generatePreviewCameraCandidates } from './previewCameraCalculator';
import { generatePreviewCameraCandidatesWithPitchTiers } from './previewCameraCalculator';
import { calculateFocusTargetForObject } from './focusTargetCalculator';
import { SceneObject } from '../types';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

type ModelMetrics = { size: THREE.Vector3; maxDimension: number };
type ModelCacheResult = { model: THREE.Object3D; metrics: ModelMetrics };

const getOrLoadModelMock = vi.fn<(assetId: string) => Promise<ModelCacheResult>>();

vi.mock('./modelCache', () => ({
  getOrLoadModel: (assetId: string) => getOrLoadModelMock(assetId),
  getOrLoadModelForComputation: (assetId: string) => getOrLoadModelMock(assetId),
}));

vi.mock('./modelLoaders', () => ({
  findChildByPath: (root: THREE.Object3D, path: string[]) => {
    // Simple path walker by name. If the path contains the root name, allow it.
    let current: THREE.Object3D = root;
    const normalized = path[0] === root.name ? path.slice(1) : path;
    for (const name of normalized) {
      const next: THREE.Object3D | undefined = current.children.find((c) => c.name === name);
      if (!next) return null;
      current = next;
    }
    return current;
  },
}));

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createBaseSceneObject(overrides?: Partial<SceneObject>): SceneObject {
  return {
    id: overrides?.id ?? 'obj-1',
    name: overrides?.name ?? 'Object',
    type: 'mesh',
    transform: {
      x: 0,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      ...(overrides?.transform ?? {}),
    },
    properties: {
      visible: true,
      ...(overrides?.properties ?? {}),
    },
    children: overrides?.children,
    originalTransform: overrides?.originalTransform,
    icon: overrides?.icon,
  };
}

function cameraWithFov(fov: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1000);
  cam.position.set(0, 5, 5);
  cam.updateProjectionMatrix();
  return cam;
}

function horizontalDistance(result: {
  position: [number, number, number];
  target: [number, number, number];
}) {
  const dx = result.position[0] - result.target[0];
  const dz = result.position[2] - result.target[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function buildSingleMeshModel(size: number): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Root';
  const geom = new THREE.BoxGeometry(size, size, size);
  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
  mesh.name = 'Body';
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

function buildOutlierModel(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Root';

  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  body.name = 'Body';
  body.position.set(0, 0, 0);
  root.add(body);

  // Tiny outlier far away to create extreme aspect ratio
  const outlier = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.05),
    new THREE.MeshBasicMaterial()
  );
  outlier.name = 'Outlier';
  outlier.position.set(0, 10, 0);
  root.add(outlier);

  root.updateMatrixWorld(true);
  return root;
}

function buildChildModel(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Root';
  const group = new THREE.Group();
  group.name = 'Group';
  const child = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.08),
    new THREE.MeshBasicMaterial()
  );
  child.name = 'Child';
  group.add(child);
  root.add(group);
  root.updateMatrixWorld(true);
  return root;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('previewCameraCalculator', () => {
  beforeEach(() => {
    getOrLoadModelMock.mockReset();
  });

  it('generates candidate positions biased toward default azimuth', () => {
    const candidates = generatePreviewCameraCandidates({
      target: [0, 0, 0],
      distance: 5,
      defaultAzimuth: Math.PI / 4,
      sampleCount: 12,
    });

    expect(candidates).toHaveLength(12);
    expect(candidates[0].azimuthDelta).toBeCloseTo(0, 6);

    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].azimuthDelta).toBeGreaterThanOrEqual(candidates[i - 1].azimuthDelta);
    }
  });

  it('generates pitch-tier candidates with base tier first', () => {
    const basePitch = Math.atan(0.6);
    const candidates = generatePreviewCameraCandidatesWithPitchTiers({
      target: [0, 0, 0],
      distance: 5,
      defaultAzimuth: 0,
      sampleCount: 4,
      defaultPitch: basePitch,
      pitchTiers: [
        { pitch: basePitch, tierIndex: 0 },
        { pitch: THREE.MathUtils.degToRad(88), tierIndex: 2 },
        { pitch: THREE.MathUtils.degToRad(-75), tierIndex: 2 },
      ],
    });

    expect(candidates.length).toBe(12); // 3 tiers * 4 azimuth samples

    const firstNonBase = candidates.findIndex((c) => (c.tierIndex ?? 0) !== 0);
    expect(firstNonBase).toBeGreaterThanOrEqual(4); // at least the 4 base candidates come first
    for (let i = 0; i < firstNonBase; i++) {
      expect(candidates[i].tierIndex ?? 0).toBe(0);
      expect(candidates[i].pitch).toBeCloseTo(basePitch, 6);
    }
  });

  it('frames small model moves closer than the old 2.5m clamp', async () => {
    const model = buildSingleMeshModel(0.1); // 10cm cube in meters-space
    getOrLoadModelMock.mockResolvedValue({
      model,
      metrics: { size: new THREE.Vector3(0.1, 0.1, 0.1), maxDimension: 0.1 },
    });

    const obj = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'small' },
    });

    const result = await calculatePreviewMoveItemCamera({
      startPos: { x: 0, y: 0, z: 0 },
      endPos: { x: 10, y: 0, z: 0 }, // 10cm move
      targetObject: obj,
      camera: cameraWithFov(35),
    });

    expect(horizontalDistance(result)).toBeLessThan(2.5);
    expect(horizontalDistance(result)).toBeGreaterThanOrEqual(0.5); // respects MIN_CAMERA_DISTANCE
  });

  it('zooms out for large moves to keep both start and end framed', async () => {
    const model = buildSingleMeshModel(0.1);
    getOrLoadModelMock.mockResolvedValue({
      model,
      metrics: { size: new THREE.Vector3(0.1, 0.1, 0.1), maxDimension: 0.1 },
    });

    const obj = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'small' },
    });

    const result = await calculatePreviewMoveItemCamera({
      startPos: { x: 0, y: 0, z: 0 },
      endPos: { x: 1000, y: 0, z: 0 }, // 10m move
      targetObject: obj,
      camera: cameraWithFov(35),
    });

    expect(horizontalDistance(result)).toBeGreaterThan(10);
  });

  it('handles child-target framing and stays close for small child moves', async () => {
    const model = buildChildModel();
    getOrLoadModelMock.mockResolvedValue({
      model,
      metrics: { size: new THREE.Vector3(1, 1, 1), maxDimension: 1 },
    });

    const obj = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'child-model' },
      children: [
        {
          name: 'Child',
          path: ['Root', 'Group', 'Child'],
          localTransform: {
            x: 0,
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
          },
        },
      ],
    });

    const result = await calculatePreviewMoveItemCamera({
      startPos: { x: 0, y: 0, z: 0 },
      endPos: { x: 20, y: 0, z: 0 }, // 20cm move of the child in world-space (scene units)
      targetObject: obj,
      targetChildPath: 'Root.Group.Child',
      camera: cameraWithFov(35),
    });

    expect(horizontalDistance(result)).toBeLessThan(2.5);
  });

  it('caps extreme outlier geometry so boundsSize does not explode', async () => {
    const model = buildOutlierModel();
    getOrLoadModelMock.mockResolvedValue({
      model,
      // Provide a fallback metric that would otherwise be large; the visible bounds should dominate anyway
      metrics: { size: new THREE.Vector3(1, 10, 1), maxDimension: 10 },
    });

    const obj = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'outlier' },
    });

    const focus = await calculateFocusTargetForObject({ object: obj });

    // Body is ~1m, outlier creates ~10m span; capping should reduce effective bounds to ~1.5m.
    expect(focus.boundsSize).toBeGreaterThan(1.0);
    expect(focus.boundsSize).toBeLessThan(3.0);
  });
});
