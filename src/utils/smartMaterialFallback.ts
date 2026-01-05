/**
 * Smart Material Fallback System
 *
 * Generates visually appealing materials when textures are missing or fail to load.
 * Uses material name hints and heuristics to create appropriate fallback appearances.
 *
 * DESIGN PRINCIPLES:
 * - Models should always look polished, even without textures
 * - Material names often hint at intended appearance (e.g., "Metal_Chrome", "Wood_Oak")
 * - Environment reflections make metallic surfaces look good
 * - Subtle color variations prevent flat, lifeless appearances
 */

import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

/** Material type categories for smart defaults */
export type MaterialCategory =
  | 'metal'
  | 'wood'
  | 'plastic'
  | 'glass'
  | 'fabric'
  | 'concrete'
  | 'rubber'
  | 'default';

/** Configuration for a material category */
interface MaterialConfig {
  baseColor: number;
  roughness: number;
  metalness: number;
  colorVariance: number; // How much to randomly vary the color
}

// =============================================================================
// Material Category Detection
// =============================================================================

/** Keywords that suggest specific material types */
const MATERIAL_KEYWORDS: Record<MaterialCategory, string[]> = {
  metal: [
    'metal',
    'steel',
    'iron',
    'chrome',
    'aluminum',
    'aluminium',
    'copper',
    'brass',
    'bronze',
    'gold',
    'silver',
    'titanium',
    'alloy',
    'metallic',
  ],
  wood: [
    'wood',
    'timber',
    'oak',
    'pine',
    'maple',
    'walnut',
    'birch',
    'mahogany',
    'plywood',
    'mdf',
    'lumber',
    'wooden',
    'bark',
    'tree',
  ],
  plastic: [
    'plastic',
    'pvc',
    'acrylic',
    'nylon',
    'polyethylene',
    'polypropylene',
    'abs',
    'hdpe',
    'polycarbonate',
    'vinyl',
    'synthetic',
  ],
  glass: ['glass', 'window', 'transparent', 'crystal', 'mirror', 'lens', 'translucent', 'clear'],
  fabric: [
    'fabric',
    'cloth',
    'textile',
    'cotton',
    'linen',
    'silk',
    'wool',
    'canvas',
    'leather',
    'denim',
    'velvet',
    'mesh',
    'woven',
  ],
  concrete: [
    'concrete',
    'cement',
    'stone',
    'rock',
    'marble',
    'granite',
    'brick',
    'masonry',
    'asphalt',
    'pavement',
    'gravel',
  ],
  rubber: [
    'rubber',
    'tire',
    'tyre',
    'silicone',
    'latex',
    'foam',
    'neoprene',
    'gasket',
    'seal',
    'grip',
  ],
  default: [],
};

/** Default configurations for each material category */
const MATERIAL_CONFIGS: Record<MaterialCategory, MaterialConfig> = {
  metal: {
    baseColor: 0x8899aa, // Steel-like gray-blue
    roughness: 0.3,
    metalness: 0.9,
    colorVariance: 0.1,
  },
  wood: {
    baseColor: 0x8b6914, // Warm brown
    roughness: 0.7,
    metalness: 0.0,
    colorVariance: 0.15,
  },
  plastic: {
    baseColor: 0x4488cc, // Pleasant blue
    roughness: 0.4,
    metalness: 0.0,
    colorVariance: 0.2,
  },
  glass: {
    baseColor: 0xaaccee, // Light blue tint
    roughness: 0.05,
    metalness: 0.0,
    colorVariance: 0.05,
  },
  fabric: {
    baseColor: 0x6688aa, // Muted blue-gray
    roughness: 0.9,
    metalness: 0.0,
    colorVariance: 0.15,
  },
  concrete: {
    baseColor: 0x888888, // Neutral gray
    roughness: 0.85,
    metalness: 0.0,
    colorVariance: 0.1,
  },
  rubber: {
    baseColor: 0x333333, // Dark gray
    roughness: 0.7,
    metalness: 0.0,
    colorVariance: 0.05,
  },
  default: {
    baseColor: 0x6699bb, // Pleasant blue-gray (looks good in most lighting)
    roughness: 0.5,
    metalness: 0.1,
    colorVariance: 0.15,
  },
};

/**
 * Guess the material category from a material name.
 * Returns 'default' if no specific category matches.
 */
export function guessMaterialCategory(name: string): MaterialCategory {
  if (!name) return 'default';

  const lowerName = name.toLowerCase();

  for (const [category, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    if (category === 'default') continue;

    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category as MaterialCategory;
      }
    }
  }

  return 'default';
}

// =============================================================================
// Color Utilities
// =============================================================================

/**
 * Vary a color slightly for visual interest.
 * Returns a new color that's subtly different from the input.
 */
function varyColor(baseColor: number, variance: number): THREE.Color {
  const color = new THREE.Color(baseColor);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  // Apply subtle random variation to hue, saturation, and lightness
  const hueShift = (Math.random() - 0.5) * variance * 0.1;
  const satShift = (Math.random() - 0.5) * variance;
  const lightShift = (Math.random() - 0.5) * variance * 0.5;

  hsl.h = (hsl.h + hueShift + 1) % 1;
  hsl.s = Math.max(0, Math.min(1, hsl.s + satShift));
  hsl.l = Math.max(0.1, Math.min(0.9, hsl.l + lightShift));

  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

/**
 * Check if a color is "problematic" (too dark, too bright, or invisible).
 */
function isProblematicColor(color: THREE.Color): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  // Too dark (near black)
  if (hsl.l < 0.05) return true;

  // Too bright (near white) - can wash out in bright lighting
  if (hsl.l > 0.95) return true;

  return false;
}

// =============================================================================
// Smart Material Application
// =============================================================================

/**
 * Apply smart defaults to a material based on its category.
 * Preserves existing properties that seem intentional.
 */
export function applySmartDefaults(
  material: THREE.MeshStandardMaterial,
  category: MaterialCategory
): void {
  const config = MATERIAL_CONFIGS[category];

  // Only set color if current color is problematic (black, white, or default magenta)
  const currentHex = material.color.getHex();
  const isDefaultMagenta = currentHex === 0xff00ff;
  const isProblem = isProblematicColor(material.color);

  if (isDefaultMagenta || isProblem || currentHex === 0x000000) {
    material.color = varyColor(config.baseColor, config.colorVariance);
  }

  // Set roughness and metalness if they seem like defaults
  if (material.roughness === 1 || material.roughness === 0) {
    material.roughness = config.roughness;
  }
  if (material.metalness === 0 && category === 'metal') {
    material.metalness = config.metalness;
  }

  // Handle glass-like materials
  if (category === 'glass') {
    material.transparent = true;
    material.opacity = 0.4;
    material.roughness = 0.05;
  }
}

/**
 * Ensure a material is visible in the scene.
 * Fixes common issues that make materials appear black or invisible.
 */
export function ensureVisibleMaterial(material: THREE.Material): void {
  if (material instanceof THREE.MeshStandardMaterial) {
    // Fix completely black materials (without diffuse textures)
    if (material.color.getHex() === 0x000000 && !material.map) {
      material.color.setHex(0x808080);
    }

    // Fix invisible materials
    if (material.transparent && material.opacity < 0.1 && !material.alphaMap) {
      material.opacity = 1;
      material.transparent = false;
    }

    // Ensure reasonable roughness (prevents pure mirror or pure matte)
    if (material.roughness < 0.01 && !material.roughnessMap) {
      material.roughness = 0.1;
    }
    if (material.roughness > 0.99 && !material.roughnessMap) {
      material.roughness = 0.9;
    }

    // Clamp emissive to prevent over-bright materials
    if (material.emissive) {
      const emissiveMax = Math.max(material.emissive.r, material.emissive.g, material.emissive.b);
      if (emissiveMax > 0.5) {
        material.emissive.multiplyScalar(0.5 / emissiveMax);
      }
    }
  }
}

/**
 * Enhance a material by applying smart fallbacks if needed.
 * This is the main entry point for the smart fallback system.
 *
 * IMPORTANT: This function should only be called for materials without ANY textures.
 * Materials with textures (even if images are still loading) should not be enhanced.
 */
export function enhanceMaterial(material: THREE.Material, materialName?: string): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) {
    return;
  }

  // If material has a diffuse texture (map), assume it's intentionally textured
  // The texture object exists even if the image data hasn't loaded yet
  if (material.map) {
    // Still ensure basic visibility (fix transparency/opacity issues)
    ensureVisibleMaterial(material);
    return;
  }

  // Check for other textures too - if ANY texture exists, be conservative
  const hasAnyTextureMap = [
    material.normalMap,
    material.roughnessMap,
    material.metalnessMap,
    material.aoMap,
    material.emissiveMap,
    material.bumpMap,
  ].some((tex) => tex instanceof THREE.Texture);

  if (hasAnyTextureMap) {
    // Has some textures but no diffuse map - might be intentional PBR setup
    // Just ensure visibility without changing appearance
    ensureVisibleMaterial(material);
    return;
  }

  // No textures at all - apply smart defaults based on material name
  const category = guessMaterialCategory(materialName ?? material.name ?? '');
  applySmartDefaults(material, category);
  ensureVisibleMaterial(material);
}

/**
 * Process all materials in a model, applying smart fallbacks where needed.
 */
export function enhanceModelMaterials(model: THREE.Group): void {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (material) {
        enhanceMaterial(material, material.name || child.name);
      }
    }
  });
}

// =============================================================================
// Material Statistics (for diagnostics)
// =============================================================================

export interface MaterialStats {
  totalMaterials: number;
  texturedMaterials: number;
  fallbackMaterials: number;
  categories: Map<MaterialCategory, number>;
}

/**
 * Analyze materials in a model and return statistics.
 */
export function analyzeMaterials(model: THREE.Group): MaterialStats {
  const stats: MaterialStats = {
    totalMaterials: 0,
    texturedMaterials: 0,
    fallbackMaterials: 0,
    categories: new Map(),
  };

  const seenMaterials = new Set<THREE.Material>();

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (!material || seenMaterials.has(material)) continue;
      seenMaterials.add(material);

      stats.totalMaterials++;

      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.map) {
          stats.texturedMaterials++;
        } else {
          stats.fallbackMaterials++;
          const category = guessMaterialCategory(material.name);
          stats.categories.set(category, (stats.categories.get(category) ?? 0) + 1);
        }
      }
    }
  });

  return stats;
}
