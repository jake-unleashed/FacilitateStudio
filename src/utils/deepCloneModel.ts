/**
 * Deep Clone Model Utility
 *
 * Provides proper deep cloning for Three.js models, including materials and textures.
 *
 * PROBLEM SOLVED:
 * THREE.Object3D.clone() only shallow-clones materials (shared references).
 * THREE.Material.clone() also shares textures by reference.
 * This means modifying one clone's material (opacity, emissive) affects all clones.
 *
 * SOLUTION:
 * Deep clone materials for each model instance. Textures are intentionally shared
 * since they're immutable GPU resources - cloning them would waste VRAM.
 *
 * USAGE:
 * - Use deepCloneModel() when you need independent material properties per instance
 * - This is essential for the model cache to return independent clones
 */

import * as THREE from 'three';

/**
 * Deep clone a Three.js model with independent materials.
 *
 * Materials are cloned so each instance can have independent properties
 * (opacity, emissive, color, etc.) without affecting other instances.
 *
 * Textures are intentionally NOT cloned - they're shared GPU resources
 * and are immutable in practice.
 *
 * @param source - The model to clone
 * @returns A new model with cloned materials
 */
export function deepCloneModel(source: THREE.Object3D): THREE.Object3D {
  // Clone the object hierarchy (type assertion needed for Three.js generics)
  const cloned = source.clone(true);

  // Deep-clone all materials to prevent shared state issues
  cloned.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.material) {
      child.material = cloneMaterial(child.material);
    }
  });

  return cloned;
}

/**
 * Clone a material or array of materials.
 * Handles both single materials and multi-material meshes.
 */
function cloneMaterial(
  material: THREE.Material | THREE.Material[]
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((mat) => cloneSingleMaterial(mat));
  }
  return cloneSingleMaterial(material);
}

/**
 * Clone a single material.
 * Uses Three.js's built-in clone which copies properties but shares textures.
 * Textures are intentionally shared since they're immutable GPU resources.
 */
function cloneSingleMaterial(material: THREE.Material): THREE.Material {
  const cloned = material.clone();

  // Reset any instance-specific state that shouldn't carry over
  // This ensures fresh materials for animation/selection effects
  if (cloned instanceof THREE.MeshStandardMaterial) {
    // Reset emissive to default (selection effects shouldn't persist)
    cloned.emissive.set(0x000000);
    cloned.emissiveIntensity = 1;

    // Reset opacity state (fade-in effects shouldn't persist)
    // Only reset if the original wasn't intentionally transparent
    if (material instanceof THREE.MeshStandardMaterial) {
      if (!material.transparent || material.opacity >= 0.99) {
        cloned.transparent = false;
        cloned.opacity = 1;
      }
    }
  }

  return cloned;
}

/**
 * Deep clone specifically for THREE.Group (most common case).
 * Returns a THREE.Group type for better type inference.
 */
export function deepCloneGroup(source: THREE.Group): THREE.Group {
  return deepCloneModel(source) as THREE.Group;
}
