/**
 * Material Optimization Utility
 *
 * Optimizes materials for the scene's lighting setup to ensure models
 * are always visible and look good in the scene.
 *
 * KEY PRINCIPLES:
 * - Preserve valid textures - never overwrite working texture maps
 * - Apply smart fallbacks for materials without textures
 * - Fix common issues (black materials, invisible transparency, wrong colorSpace)
 * - Log diagnostics in development mode
 *
 * TEXTURE COLORSPACE (Three.js r152+):
 * - Color textures (map, emissiveMap) → SRGBColorSpace
 * - Data textures (normalMap, roughnessMap, etc.) → LinearSRGBColorSpace
 * - GLB files (via GLTFLoader) handle this automatically, but FBX/OBJ may not
 */

import * as THREE from 'three';
import { enhanceMaterial, guessMaterialCategory, MaterialCategory } from './smartMaterialFallback';

// =============================================================================
// Development Mode Detection
// =============================================================================

const IS_DEV = import.meta.env.DEV ?? process.env.NODE_ENV === 'development';

// =============================================================================
// Texture Detection
// =============================================================================

/** All texture map properties on MeshStandardMaterial */
const TEXTURE_PROPERTIES = [
  'map', // Diffuse/albedo
  'normalMap', // Normal mapping
  'roughnessMap', // Roughness
  'metalnessMap', // Metalness
  'aoMap', // Ambient occlusion
  'emissiveMap', // Emissive
  'lightMap', // Baked lighting
  'bumpMap', // Bump mapping
  'displacementMap', // Displacement
  'alphaMap', // Alpha/transparency
  'envMap', // Environment reflection
] as const;

/** Textures that should use SRGB colorSpace (color data) */
const SRGB_TEXTURE_PROPERTIES = ['map', 'emissiveMap'] as const;

/** Textures that should use Linear colorSpace (data, not color) */
const LINEAR_TEXTURE_PROPERTIES = [
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'lightMap',
  'bumpMap',
  'displacementMap',
  'alphaMap',
] as const;
type TextureProperty = (typeof TEXTURE_PROPERTIES)[number];
type TextureLookupMaterial = Partial<Record<TextureProperty, unknown>>;

function readTextureProperty(material: THREE.Material, prop: TextureProperty): unknown {
  return (material as TextureLookupMaterial)[prop];
}

/**
 * Check if a material has any valid textures.
 */
function hasValidTextures(material: THREE.Material): boolean {
  for (const prop of TEXTURE_PROPERTIES) {
    const texture = readTextureProperty(material, prop);
    if (texture instanceof THREE.Texture) {
      // Texture exists - check if it has image data
      if (texture.image) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a material has any texture objects (even if image not loaded yet).
 * More lenient than hasValidTextures - returns true if texture object exists.
 */
function hasAnyTextures(material: THREE.Material): boolean {
  for (const prop of TEXTURE_PROPERTIES) {
    const texture = readTextureProperty(material, prop);
    if (texture instanceof THREE.Texture) {
      return true;
    }
  }
  return false;
}

/**
 * Fix texture colorSpace settings for proper color rendering.
 * Three.js r152+ requires explicit colorSpace for correct gamma.
 *
 * - Color textures (map, emissiveMap) → SRGBColorSpace
 * - Data textures (normalMap, roughnessMap, etc.) → LinearSRGBColorSpace
 */
function fixTextureColorSpace(material: THREE.Material): void {
  // Fix SRGB textures (color data)
  for (const prop of SRGB_TEXTURE_PROPERTIES) {
    const texture = readTextureProperty(material, prop);
    if (texture instanceof THREE.Texture) {
      // Only set if not already correct (avoid unnecessary updates)
      if (texture.colorSpace !== THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
      }
    }
  }

  // Fix Linear textures (data, not color)
  for (const prop of LINEAR_TEXTURE_PROPERTIES) {
    const texture = readTextureProperty(material, prop);
    if (texture instanceof THREE.Texture) {
      // Only set if not already correct
      if (texture.colorSpace !== THREE.LinearSRGBColorSpace) {
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        texture.needsUpdate = true;
      }
    }
  }
}

/**
 * Get a list of texture types present on a material.
 */
function getTextureTypes(material: THREE.Material): string[] {
  const types: string[] = [];
  for (const prop of TEXTURE_PROPERTIES) {
    const texture = readTextureProperty(material, prop);
    if (texture instanceof THREE.Texture && texture.image) {
      types.push(prop);
    }
  }
  return types;
}

// =============================================================================
// Material Property Normalization
// =============================================================================

/**
 * Normalize material properties for consistent appearance.
 * Preserves textures and only adjusts properties that need fixing.
 */
export function normalizeMaterialProperties(material: THREE.Material, meshName?: string): void {
  // Ensure visibility
  material.visible = true;

  // Use DoubleSide for imported models to handle incorrect normals
  // Many exported models have single-sided materials that face the wrong way
  material.side = THREE.DoubleSide;

  // Fix texture colorSpace for all materials
  fixTextureColorSpace(material);

  if (material instanceof THREE.MeshStandardMaterial) {
    // Check for textures (use lenient check - texture object exists even if image pending)
    const hasTextureObjects = hasAnyTextures(material);
    const hasLoadedTextures = hasValidTextures(material);
    const materialName = material.name || meshName || '';

    // Log texture status in dev mode
    if (IS_DEV) {
      const textureTypes = getTextureTypes(material);
      if (textureTypes.length > 0) {
        console.log(
          `[materialOptimization] "${materialName}" has textures: ${textureTypes.join(', ')}`
        );
      } else if (hasTextureObjects && !hasLoadedTextures) {
        console.log(`[materialOptimization] "${materialName}" has texture objects (image pending)`);
      }
    }

    // If material has texture objects (even if images pending), preserve them
    if (hasTextureObjects) {
      // Only fix critical issues - don't overwrite colors/textures
      fixCriticalIssues(material);
    } else {
      // No textures at all - apply smart fallbacks
      const category = guessMaterialCategory(materialName);
      applySmartFallback(material, category, materialName);
    }
  } else if (material instanceof THREE.MeshBasicMaterial) {
    // Basic materials - just ensure visibility
    fixBasicMaterialIssues(material);
  } else if (material instanceof THREE.MeshPhongMaterial) {
    fixPhongMaterialIssues(material);
  } else if (material instanceof THREE.MeshLambertMaterial) {
    fixLambertMaterialIssues(material);
  }
}

/**
 * Fix critical issues that would make a textured material invisible.
 * Very conservative - doesn't change appearance, just ensures visibility.
 */
function fixCriticalIssues(material: THREE.MeshStandardMaterial): void {
  // Fix invisible transparency (transparent + near-zero opacity + no alpha map)
  if (material.transparent && material.opacity < 0.05 && !material.alphaMap) {
    material.opacity = 1;
    material.transparent = false;
    if (IS_DEV) {
      console.log(`[materialOptimization] Fixed invisible transparency on "${material.name}"`);
    }
  }

  // Clamp extreme emissive that would blow out the material
  if (material.emissive) {
    const maxEmissive = Math.max(material.emissive.r, material.emissive.g, material.emissive.b);
    if (maxEmissive > 1) {
      material.emissive.multiplyScalar(1 / maxEmissive);
    }
  }
}

/**
 * Apply smart fallback settings for materials without textures.
 */
function applySmartFallback(
  material: THREE.MeshStandardMaterial,
  category: MaterialCategory,
  materialName: string
): void {
  // Use the smart fallback system
  enhanceMaterial(material, materialName);

  if (IS_DEV && category !== 'default') {
    console.log(`[materialOptimization] Applied "${category}" fallback to "${materialName}"`);
  }
}

/**
 * Fix issues with MeshBasicMaterial.
 */
function fixBasicMaterialIssues(material: THREE.MeshBasicMaterial): void {
  // Fix black color without texture
  if (material.color.getHex() === 0x000000 && !material.map) {
    material.color.setHex(0x808080);
  }

  // Fix invisible transparency
  if (material.transparent && material.opacity < 0.05 && !material.alphaMap) {
    material.opacity = 1;
    material.transparent = false;
  }
}

/**
 * Fix issues with MeshPhongMaterial.
 */
function fixPhongMaterialIssues(material: THREE.MeshPhongMaterial): void {
  // Ensure reasonable shininess
  if (material.shininess === undefined || material.shininess < 0) {
    material.shininess = 30;
  }

  // Fix black color without texture
  if (material.color.getHex() === 0x000000 && !material.map) {
    material.color.setHex(0x808080);
  }

  // Fix invisible transparency
  if (material.transparent && material.opacity < 0.05 && !material.alphaMap) {
    material.opacity = 1;
    material.transparent = false;
  }
}

/**
 * Fix issues with MeshLambertMaterial.
 */
function fixLambertMaterialIssues(material: THREE.MeshLambertMaterial): void {
  // Fix black color without texture
  if (material.color.getHex() === 0x000000 && !material.map) {
    material.color.setHex(0x808080);
  }

  // Fix invisible transparency
  if (material.transparent && material.opacity < 0.05 && !material.alphaMap) {
    material.opacity = 1;
    material.transparent = false;
  }
}

// =============================================================================
// Default Material Creation
// =============================================================================

/**
 * Create a default material for meshes that have none.
 * Uses smart fallbacks based on mesh name.
 */
function createDefaultMaterial(meshName?: string): THREE.MeshStandardMaterial {
  // Start with a neutral material
  const material = new THREE.MeshStandardMaterial({
    color: 0x6699bb, // Pleasant blue-gray
    roughness: 0.5,
    metalness: 0.1,
    name: meshName ?? 'Default',
  });

  // Apply category-specific defaults
  enhanceMaterial(material, meshName);

  return material;
}

/**
 * Add default material to meshes that have no material.
 */
function ensureMeshHasMaterial(mesh: THREE.Mesh): void {
  if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
    mesh.material = createDefaultMaterial(mesh.name);

    if (IS_DEV) {
      console.log(`[materialOptimization] Added default material to mesh "${mesh.name}"`);
    }
  }
}

// =============================================================================
// Main Optimization Function
// =============================================================================

export interface OptimizationResult {
  totalMeshes: number;
  texturedMaterials: number;
  fallbackMaterials: number;
  fixedIssues: number;
}

/**
 * Optimize all materials in a model for the scene.
 * This is the main entry point for material optimization.
 *
 * @param model - The Three.js object to optimize
 * @returns Statistics about the optimization
 */
export function optimizeMaterialsForScene(model: THREE.Group): OptimizationResult {
  const result: OptimizationResult = {
    totalMeshes: 0,
    texturedMaterials: 0,
    fallbackMaterials: 0,
    fixedIssues: 0,
  };

  const processedMaterials = new Set<THREE.Material>();

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    result.totalMeshes++;

    // Ensure mesh has a material
    ensureMeshHasMaterial(child);

    // Process each material
    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (!material || processedMaterials.has(material)) continue;
      processedMaterials.add(material);

      // Track texture status before optimization
      const hadTextures = hasValidTextures(material);

      // Optimize the material
      normalizeMaterialProperties(material, child.name);

      // Update statistics
      if (hadTextures) {
        result.texturedMaterials++;
      } else {
        result.fallbackMaterials++;
      }
    }
  });

  // Log summary in dev mode
  if (IS_DEV) {
    console.log('[materialOptimization] Summary:', {
      meshes: result.totalMeshes,
      textured: result.texturedMaterials,
      fallback: result.fallbackMaterials,
    });
  }

  return result;
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Check if a model has any textured materials.
 */
export function modelHasTextures(model: THREE.Group): boolean {
  let hasTextures = false;

  model.traverse((child) => {
    if (hasTextures) return; // Early exit

    if (child instanceof THREE.Mesh && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material && hasValidTextures(material)) {
          hasTextures = true;
          return;
        }
      }
    }
  });

  return hasTextures;
}

/**
 * Get texture statistics for a model.
 */
export function getTextureStats(model: THREE.Group): {
  totalMaterials: number;
  texturedMaterials: number;
  textureTypes: Set<string>;
} {
  const stats = {
    totalMaterials: 0,
    texturedMaterials: 0,
    textureTypes: new Set<string>(),
  };

  const seenMaterials = new Set<THREE.Material>();

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (!material || seenMaterials.has(material)) continue;
      seenMaterials.add(material);

      stats.totalMaterials++;

      const textureTypes = getTextureTypes(material);
      if (textureTypes.length > 0) {
        stats.texturedMaterials++;
        textureTypes.forEach((t) => stats.textureTypes.add(t));
      }
    }
  });

  return stats;
}
