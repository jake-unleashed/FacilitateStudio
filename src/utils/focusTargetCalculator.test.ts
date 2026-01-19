import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { calculateFocusTargetForObject } from './focusTargetCalculator';
import type { SceneObject } from '../types';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

type ModelMetrics = { size: THREE.Vector3; maxDimension: number };
type ModelCacheResult = { model: THREE.Object3D; metrics: ModelMetrics };

const getOrLoadModelMock = vi.fn<(assetId: string) => Promise<ModelCacheResult>>();

vi.mock('./modelCache', () => ({
  getOrLoadModel: (assetId: string) => getOrLoadModelMock(assetId),
}));

vi.mock('./modelLoaders', () => ({
  findChildByPath: (root: THREE.Object3D, path: string[]) => {
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

/**
 * Build a model whose geometry is aligned to ground (minY=0),
 * matching our preprocessing pipeline (`alignModelToGround`).
 */
function buildGroundAlignedBox(params: { height: number; width?: number; depth?: number }) {
  const { height, width = 1, depth = 1 } = params;
  const root = new THREE.Group();
  root.name = 'Root';

  const geom = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
  mesh.name = 'Body';

  // BoxGeometry is centered at origin; move it up so minY=0.
  mesh.position.y = height / 2;
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

function buildGroundAlignedOffsetBox(params: {
  height: number;
  offsetX?: number;
  offsetZ?: number;
  width?: number;
  depth?: number;
}) {
  const { height, offsetX = 0, offsetZ = 0, width = 1, depth = 1 } = params;
  const root = new THREE.Group();
  root.name = 'Root';

  const geom = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
  mesh.name = 'Body';

  // Ground align (minY=0) and offset in X/Z so parent rotations affect focus target.
  mesh.position.set(offsetX, height / 2, offsetZ);
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('calculateFocusTargetForObject', () => {
  beforeEach(() => {
    getOrLoadModelMock.mockReset();
  });

  it('keeps focus height stable across object scale (root focus)', async () => {
    const modelHeight = 2;
    const model = buildGroundAlignedBox({ height: modelHeight });

    getOrLoadModelMock.mockResolvedValue({
      model,
      metrics: {
        size: new THREE.Vector3(1, modelHeight, 1),
        maxDimension: modelHeight,
      },
    });

    const base = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'asset-1' },
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
      },
    });

    const small = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, scaleY: 0.2 } },
    });
    const one = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, scaleY: 1 } },
    });
    const large = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, scaleY: 5 } },
    });

    // Focus height should remain ~modelHeight/2 in world space when scaling around the model center plane.
    expect(small.targetY).toBeCloseTo(modelHeight / 2, 6);
    expect(one.targetY).toBeCloseTo(modelHeight / 2, 6);
    expect(large.targetY).toBeCloseTo(modelHeight / 2, 6);
  });

  it('keeps focus height stable across object scale (child focus)', async () => {
    const modelHeight = 2;
    const root = new THREE.Group();
    root.name = 'Root';

    const child = buildGroundAlignedBox({ height: modelHeight });
    child.name = 'Child';
    root.add(child);
    root.updateMatrixWorld(true);

    getOrLoadModelMock.mockResolvedValue({
      model: root,
      metrics: {
        size: new THREE.Vector3(1, modelHeight, 1),
        maxDimension: modelHeight,
      },
    });

    const base = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'asset-1' },
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
      },
    });

    const small = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, scaleY: 0.2 } },
      childPath: 'Child',
    });
    const large = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, scaleY: 5 } },
      childPath: 'Child',
    });

    expect(small.targetY).toBeCloseTo(modelHeight / 2, 6);
    expect(large.targetY).toBeCloseTo(modelHeight / 2, 6);
  });

  it('accounts for parent rotation when computing focus target (root focus)', async () => {
    const modelHeight = 2;
    const model = buildGroundAlignedOffsetBox({ height: modelHeight, offsetX: 1, offsetZ: 0 });

    getOrLoadModelMock.mockResolvedValue({
      model,
      metrics: {
        size: new THREE.Vector3(2, modelHeight, 1),
        maxDimension: modelHeight,
      },
    });

    const base = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'asset-1' },
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
      },
    });

    const unrotated = await calculateFocusTargetForObject({ object: base });
    const rotated = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, rotationY: 90 } },
    });

    // Expected: local weighted center is ~ (1, 1, 0). With two-group structure, innerOffset cancels Y,
    // so delta is (1, 0, 0). Rotating +90° around Y maps X toward Z in Three.js.
    const expectedDelta = new THREE.Vector3(1, 0, 0).applyEuler(
      new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0, 'XYZ')
    );

    expect(unrotated.targetX).toBeCloseTo(1, 6);
    expect(unrotated.targetZ).toBeCloseTo(0, 6);
    expect(rotated.targetX).toBeCloseTo(expectedDelta.x, 6);
    expect(rotated.targetZ).toBeCloseTo(expectedDelta.z, 6);
    // Height should remain at pivot plane.
    expect(rotated.targetY).toBeCloseTo(modelHeight / 2, 6);
  });

  it('accounts for parent rotation when computing focus target (child focus)', async () => {
    const modelHeight = 2;

    const root = new THREE.Group();
    root.name = 'Root';

    const child = buildGroundAlignedOffsetBox({ height: modelHeight, offsetX: 1, offsetZ: 0 });
    child.name = 'Child';
    root.add(child);
    root.updateMatrixWorld(true);

    getOrLoadModelMock.mockResolvedValue({
      model: root,
      metrics: {
        size: new THREE.Vector3(2, modelHeight, 1),
        maxDimension: modelHeight,
      },
    });

    const base = createBaseSceneObject({
      properties: { visible: true, modelAssetId: 'asset-1' },
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
      },
    });

    const unrotated = await calculateFocusTargetForObject({ object: base, childPath: 'Child' });
    const rotated = await calculateFocusTargetForObject({
      object: { ...base, transform: { ...base.transform, rotationY: 90 } },
      childPath: 'Child',
    });

    const expectedDelta = new THREE.Vector3(1, 0, 0).applyEuler(
      new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0, 'XYZ')
    );

    expect(unrotated.targetX).toBeCloseTo(1, 6);
    expect(unrotated.targetZ).toBeCloseTo(0, 6);
    expect(rotated.targetX).toBeCloseTo(expectedDelta.x, 6);
    expect(rotated.targetZ).toBeCloseTo(expectedDelta.z, 6);
    expect(rotated.targetY).toBeCloseTo(modelHeight / 2, 6);
  });
});

