/**
 * Unit tests for smartMaterialFallback utility
 *
 * Tests the material category detection and smart fallback application.
 */

import * as THREE from 'three';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  guessMaterialCategory,
  enhanceMaterial,
  ensureVisibleMaterial,
  applySmartDefaults,
  enhanceModelMaterials,
  analyzeMaterials,
} from './smartMaterialFallback';

describe('smartMaterialFallback', () => {
  describe('guessMaterialCategory', () => {
    it('should return "metal" for metal-related names', () => {
      expect(guessMaterialCategory('Steel_Frame')).toBe('metal');
      expect(guessMaterialCategory('chrome_handle')).toBe('metal');
      expect(guessMaterialCategory('Aluminum_Panel')).toBe('metal');
      expect(guessMaterialCategory('copper_wire')).toBe('metal');
      expect(guessMaterialCategory('brass_fixture')).toBe('metal');
      expect(guessMaterialCategory('titanium_part')).toBe('metal');
    });

    it('should return "wood" for wood-related names', () => {
      expect(guessMaterialCategory('Oak_Table')).toBe('wood');
      expect(guessMaterialCategory('pine_board')).toBe('wood');
      expect(guessMaterialCategory('mahogany_desk')).toBe('wood');
      expect(guessMaterialCategory('plywood_panel')).toBe('wood');
      expect(guessMaterialCategory('wooden_chair')).toBe('wood');
    });

    it('should return "plastic" for plastic-related names', () => {
      expect(guessMaterialCategory('Plastic_Cover')).toBe('plastic');
      expect(guessMaterialCategory('pvc_pipe')).toBe('plastic');
      expect(guessMaterialCategory('acrylic_sheet')).toBe('plastic');
      expect(guessMaterialCategory('nylon_part')).toBe('plastic');
    });

    it('should return "glass" for glass-related names', () => {
      expect(guessMaterialCategory('Glass_Window')).toBe('glass');
      expect(guessMaterialCategory('transparent_panel')).toBe('glass');
      expect(guessMaterialCategory('crystal_vase')).toBe('glass');
      expect(guessMaterialCategory('mirror_surface')).toBe('glass');
    });

    it('should return "fabric" for fabric-related names', () => {
      expect(guessMaterialCategory('Fabric_Seat')).toBe('fabric');
      expect(guessMaterialCategory('cotton_cover')).toBe('fabric');
      expect(guessMaterialCategory('leather_cushion')).toBe('fabric');
      expect(guessMaterialCategory('velvet_chair')).toBe('fabric');
    });

    it('should return "concrete" for concrete-related names', () => {
      expect(guessMaterialCategory('Concrete_Floor')).toBe('concrete');
      expect(guessMaterialCategory('stone_wall')).toBe('concrete');
      expect(guessMaterialCategory('marble_counter')).toBe('concrete');
      expect(guessMaterialCategory('brick_facade')).toBe('concrete');
    });

    it('should return "rubber" for rubber-related names', () => {
      expect(guessMaterialCategory('Rubber_Tire')).toBe('rubber');
      expect(guessMaterialCategory('silicone_gasket')).toBe('rubber');
      expect(guessMaterialCategory('foam_padding')).toBe('rubber');
    });

    it('should return "default" for unrecognized names', () => {
      expect(guessMaterialCategory('generic_part')).toBe('default');
      expect(guessMaterialCategory('unknown_material')).toBe('default');
      expect(guessMaterialCategory('')).toBe('default');
    });

    it('should be case-insensitive', () => {
      expect(guessMaterialCategory('STEEL')).toBe('metal');
      expect(guessMaterialCategory('steel')).toBe('metal');
      expect(guessMaterialCategory('Steel')).toBe('metal');
    });
  });

  describe('ensureVisibleMaterial', () => {
    let material: THREE.MeshStandardMaterial;

    beforeEach(() => {
      material = new THREE.MeshStandardMaterial();
    });

    it('should fix black materials without texture', () => {
      material.color.set(0x000000);
      material.map = null;

      ensureVisibleMaterial(material);

      expect(material.color.getHex()).not.toBe(0x000000);
    });

    it('should not change black materials with texture', () => {
      material.color.set(0x000000);
      material.map = new THREE.Texture();

      ensureVisibleMaterial(material);

      // Should remain black since texture provides color
      expect(material.color.getHex()).toBe(0x000000);
    });

    it('should fix invisible transparency', () => {
      material.transparent = true;
      material.opacity = 0.05;
      material.alphaMap = null;

      ensureVisibleMaterial(material);

      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
    });

    it('should not fix transparency with alpha map', () => {
      material.transparent = true;
      material.opacity = 0.05;
      material.alphaMap = new THREE.Texture();

      ensureVisibleMaterial(material);

      // Should preserve settings when alpha map is present
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.05);
    });

    it('should fix extreme roughness values', () => {
      material.roughness = 0.001;
      material.roughnessMap = null;

      ensureVisibleMaterial(material);

      expect(material.roughness).toBeGreaterThanOrEqual(0.1);
    });

    it('should clamp excessive emissive', () => {
      material.emissive.set(1, 1, 1); // Very bright

      ensureVisibleMaterial(material);

      const maxEmissive = Math.max(material.emissive.r, material.emissive.g, material.emissive.b);
      expect(maxEmissive).toBeLessThanOrEqual(0.5);
    });
  });

  describe('applySmartDefaults', () => {
    let material: THREE.MeshStandardMaterial;

    beforeEach(() => {
      material = new THREE.MeshStandardMaterial();
      material.color.set(0x000000); // Problematic black color
    });

    it('should apply metal defaults', () => {
      applySmartDefaults(material, 'metal');

      expect(material.metalness).toBeGreaterThan(0);
      expect(material.roughness).toBeLessThan(1);
    });

    it('should apply wood defaults', () => {
      applySmartDefaults(material, 'wood');

      expect(material.metalness).toBe(0);
      expect(material.roughness).toBeGreaterThan(0.5);
    });

    it('should apply glass defaults', () => {
      applySmartDefaults(material, 'glass');

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeLessThan(1);
      expect(material.roughness).toBeLessThan(0.1);
    });

    it('should apply default category settings', () => {
      applySmartDefaults(material, 'default');

      // Should apply some reasonable defaults
      expect(material.color.getHex()).not.toBe(0x000000);
    });
  });

  describe('enhanceMaterial', () => {
    let material: THREE.MeshStandardMaterial;

    beforeEach(() => {
      material = new THREE.MeshStandardMaterial();
    });

    it('should not modify materials with diffuse texture', () => {
      const originalColor = 0xff0000;
      material.color.set(originalColor);
      material.map = new THREE.Texture();

      enhanceMaterial(material, 'steel_part');

      // Color should be unchanged (not applying metal defaults)
      expect(material.color.getHex()).toBe(originalColor);
    });

    it('should not modify materials with other textures', () => {
      const originalColor = 0xff0000;
      material.color.set(originalColor);
      material.normalMap = new THREE.Texture();

      enhanceMaterial(material, 'steel_part');

      // Color should be unchanged
      expect(material.color.getHex()).toBe(originalColor);
    });

    it('should apply smart defaults for untextured materials', () => {
      material.color.set(0x000000);

      enhanceMaterial(material, 'steel_part');

      // Should have metal-like properties
      expect(material.metalness).toBeGreaterThan(0);
    });

    it('should ignore non-MeshStandardMaterial', () => {
      const basicMaterial = new THREE.MeshBasicMaterial();

      // Should not throw
      expect(() => enhanceMaterial(basicMaterial, 'test')).not.toThrow();
    });
  });

  describe('enhanceModelMaterials', () => {
    it('should process all meshes in a group', () => {
      const group = new THREE.Group();

      const mesh1 = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      );
      mesh1.name = 'metal_part';

      const mesh2 = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      );
      mesh2.name = 'wood_panel';

      group.add(mesh1);
      group.add(mesh2);

      enhanceModelMaterials(group);

      // Both materials should be enhanced
      const mat1 = mesh1.material as THREE.MeshStandardMaterial;
      const mat2 = mesh2.material as THREE.MeshStandardMaterial;

      expect(mat1.color.getHex()).not.toBe(0x000000);
      expect(mat2.color.getHex()).not.toBe(0x000000);
    });

    it('should handle multi-material meshes', () => {
      const group = new THREE.Group();

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [
        new THREE.MeshStandardMaterial({ color: 0x000000 }),
        new THREE.MeshStandardMaterial({ color: 0x000000 }),
      ]);

      group.add(mesh);

      enhanceModelMaterials(group);

      const materials = mesh.material as THREE.MeshStandardMaterial[];
      materials.forEach((mat) => {
        expect(mat.color.getHex()).not.toBe(0x000000);
      });
    });
  });

  describe('analyzeMaterials', () => {
    it('should return material statistics', () => {
      const group = new THREE.Group();

      const texturedMaterial = new THREE.MeshStandardMaterial();
      texturedMaterial.map = new THREE.Texture();
      const texturedMesh = new THREE.Mesh(new THREE.BoxGeometry(), texturedMaterial);

      const untexturedMaterial = new THREE.MeshStandardMaterial();
      untexturedMaterial.name = 'metal_part';
      const untexturedMesh = new THREE.Mesh(new THREE.BoxGeometry(), untexturedMaterial);

      group.add(texturedMesh);
      group.add(untexturedMesh);

      const stats = analyzeMaterials(group);

      expect(stats.totalMaterials).toBe(2);
      expect(stats.texturedMaterials).toBe(1);
      expect(stats.fallbackMaterials).toBe(1);
      expect(stats.categories.get('metal')).toBe(1);
    });

    it('should not double-count shared materials', () => {
      const group = new THREE.Group();

      const sharedMaterial = new THREE.MeshStandardMaterial();
      const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(), sharedMaterial);
      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(), sharedMaterial);

      group.add(mesh1);
      group.add(mesh2);

      const stats = analyzeMaterials(group);

      expect(stats.totalMaterials).toBe(1);
    });
  });
});



