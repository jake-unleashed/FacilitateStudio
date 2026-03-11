import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { ImportDiagnostics } from '../../types/model';
import { repairModelNormals } from './normals';

function createDiagnostics(): ImportDiagnostics {
  return {
    fileType: 'fbx',
    warnings: [],
    repairedNormalsMeshCount: 0,
    suspiciousMaterialCount: 0,
    missingTextureDataCount: 0,
  };
}

describe('repairModelNormals', () => {
  it('repairs meshes that are missing normals', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
    );

    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    const model = new THREE.Group();
    model.add(mesh);

    const diagnostics = createDiagnostics();
    repairModelNormals(model, diagnostics);

    expect(mesh.geometry.getAttribute('normal')).toBeDefined();
    expect(diagnostics.repairedNormalsMeshCount).toBe(1);
    expect(diagnostics.warnings[0]?.code).toBe('missing-normals-repaired');
  });

  it('repairs meshes that have invalid zero-length normals', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)
    );

    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    const model = new THREE.Group();
    model.add(mesh);

    const diagnostics = createDiagnostics();
    repairModelNormals(model, diagnostics);

    const repairedNormals = mesh.geometry.getAttribute('normal');
    expect(repairedNormals).toBeDefined();
    expect(repairedNormals.getZ(0)).not.toBe(0);
    expect(diagnostics.repairedNormalsMeshCount).toBe(1);
    expect(diagnostics.warnings[0]?.code).toBe('invalid-normals-repaired');
  });
});
