import * as THREE from 'three';
import type { ImportDiagnostics } from '../../types/model';
import { addImportWarning } from '../importDiagnostics';

const NORMAL_LENGTH_EPSILON = 1e-5;

function hasInvalidNormals(attribute: THREE.BufferAttribute): boolean {
  let hasFiniteNonZeroNormal = false;

  for (let index = 0; index < attribute.count; index++) {
    const x = attribute.getX(index);
    const y = attribute.getY(index);
    const z = attribute.getZ(index);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return true;
    }

    const lengthSq = x * x + y * y + z * z;
    if (lengthSq > NORMAL_LENGTH_EPSILON) {
      hasFiniteNonZeroNormal = true;
    }
  }

  return !hasFiniteNonZeroNormal;
}

/**
 * Regenerate missing or degenerate normals after geometry mutations are complete.
 * This helps imported FBX/OBJ/CAD-style meshes shade correctly under scene lights.
 */
export function repairModelNormals(model: THREE.Group, diagnostics: ImportDiagnostics): void {
  let repairedMissingNormals = 0;
  let repairedInvalidNormals = 0;

  model.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;

    const geometry = child.geometry;
    const normalAttribute = geometry.getAttribute('normal');

    if (!normalAttribute) {
      geometry.computeVertexNormals();
      geometry.normalizeNormals();
      repairedMissingNormals += 1;
      diagnostics.repairedNormalsMeshCount += 1;
      return;
    }

    if (!hasInvalidNormals(normalAttribute)) {
      return;
    }

    geometry.deleteAttribute('normal');
    geometry.computeVertexNormals();
    geometry.normalizeNormals();
    repairedInvalidNormals += 1;
    diagnostics.repairedNormalsMeshCount += 1;
  });

  if (repairedMissingNormals > 0) {
    addImportWarning(diagnostics, {
      code: 'missing-normals-repaired',
      severity: 'warning',
      message:
        repairedMissingNormals === 1
          ? 'One mesh was missing normals, so shading was repaired during import.'
          : `${repairedMissingNormals} meshes were missing normals, so shading was repaired during import.`,
    });
  }

  if (repairedInvalidNormals > 0) {
    addImportWarning(diagnostics, {
      code: 'invalid-normals-repaired',
      severity: 'warning',
      message:
        repairedInvalidNormals === 1
          ? 'One mesh had invalid normals, so shading was repaired during import.'
          : `${repairedInvalidNormals} meshes had invalid normals, so shading was repaired during import.`,
    });
  }
}
