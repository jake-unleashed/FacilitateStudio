/**
 * Material Optimization Utility
 * 
 * Optimizes materials for the scene's lighting setup to ensure models
 * are always visible and look good in the scene.
 */

import * as THREE from 'three';

/**
 * Normalize material properties for consistent appearance
 */
export function normalizeMaterialProperties(material: THREE.Material): void {
  if (material instanceof THREE.MeshStandardMaterial) {
    // Ensure material is visible
    material.visible = true;
    
    // Set reasonable defaults if properties are missing
    if (material.roughness === undefined || material.roughness < 0) {
      material.roughness = 0.5;
    }
    if (material.metalness === undefined || material.metalness < 0) {
      material.metalness = 0.0;
    }
    
    // Ensure emissive is not too bright (subtle glow is okay)
    if (material.emissive) {
      const maxEmissive = 0.2; // Maximum emissive intensity
      material.emissive.multiplyScalar(Math.min(1, maxEmissive / material.emissive.getMaxComponent()));
    }
    
    // Ensure material has some color if it's completely black
    if (material.color.getHex() === 0x000000) {
      material.color.setHex(0x808080); // Default to gray
    }
  } else if (material instanceof THREE.MeshBasicMaterial) {
    // Basic materials are fine as-is, just ensure visibility
    material.visible = true;
  } else if (material instanceof THREE.MeshPhongMaterial) {
    // Phong materials - similar to Standard
    material.visible = true;
    if (material.shininess === undefined || material.shininess < 0) {
      material.shininess = 30;
    }
  } else if (material instanceof THREE.MeshLambertMaterial) {
    // Lambert materials - simple diffuse
    material.visible = true;
  }
  
  // Ensure transparency is reasonable
  if (material.transparent && material.opacity !== undefined) {
    if (material.opacity < 0.1) {
      // Very transparent materials might be invisible, make them more visible
      material.opacity = Math.max(0.5, material.opacity);
    }
  }
}

/**
 * Add default material to meshes that have no material
 */
function addDefaultMaterial(mesh: THREE.Mesh): void {
  if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0x808080, // Neutral gray
      roughness: 0.5,
      metalness: 0.0,
    });
  }
}

/**
 * Optimize all materials in a model for the scene
 */
export function optimizeMaterialsForScene(model: THREE.Object3D): void {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Add default material if missing
      addDefaultMaterial(child);
      
      // Handle material arrays
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => {
          if (mat instanceof THREE.Material) {
            normalizeMaterialProperties(mat);
          }
        });
      } else if (child.material instanceof THREE.Material) {
        normalizeMaterialProperties(child.material);
      }
    }
  });
}









