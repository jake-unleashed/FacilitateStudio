import * as THREE from 'three';
import { IS_DEV } from './env';

export interface TextureReport {
  totalMeshes: number;
  meshesWithTextures: number;
  meshesWithoutTextures: number;
  textureTypes: Set<string>;
  issues: string[];
}

/**
 * Analyze a model's texture usage for diagnostics.
 * Only logs in development mode.
 */
export function analyzeModelTextures(model: THREE.Group, modelName?: string): TextureReport {
  const report: TextureReport = {
    totalMeshes: 0,
    meshesWithTextures: 0,
    meshesWithoutTextures: 0,
    textureTypes: new Set(),
    issues: [],
  };

  const textureProps = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'lightMap',
    'bumpMap',
    'displacementMap',
    'alphaMap',
    'envMap',
  ] as const;

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    report.totalMeshes++;
    let hasAnyTexture = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (!material) continue;

      for (const prop of textureProps) {
        const texture = (material as unknown as Record<string, unknown>)[prop];
        if (texture instanceof THREE.Texture) {
          hasAnyTexture = true;
          report.textureTypes.add(prop);

          if (!texture.image) {
            report.issues.push(`${prop} texture has no image data`);
          }
        }
      }

      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.color.getHex() === 0x000000 && !material.map) {
          report.issues.push('Material is black without diffuse texture - may be missing texture');
        }
        if (material.transparent && material.opacity < 0.1 && !material.alphaMap) {
          report.issues.push('Material is nearly invisible without alpha texture');
        }
      }
    }

    if (hasAnyTexture) {
      report.meshesWithTextures++;
    } else {
      report.meshesWithoutTextures++;
    }
  });

  if (IS_DEV) {
    const name = modelName ?? 'Unknown Model';
    console.log(`[TextureDiagnostics] ${name}:`);
    console.log(
      `  Meshes: ${report.totalMeshes} (${report.meshesWithTextures} textured, ${report.meshesWithoutTextures} untextured)`
    );
    if (report.textureTypes.size > 0) {
      console.log(`  Texture types: ${Array.from(report.textureTypes).join(', ')}`);
    }
    if (report.issues.length > 0) {
      console.warn(`  Issues:`, report.issues);
    }
  }

  return report;
}

