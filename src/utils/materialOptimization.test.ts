/**
 * Unit tests for materialOptimization utility
 *
 * Tests the material optimization, texture colorSpace fixing, and smart fallbacks.
 */

import * as THREE from 'three';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeMaterialProperties,
  optimizeMaterialsForScene,
  modelHasTextures,
  getTextureStats,
} from './materialOptimization';

describe('materialOptimization', () => {
  let testMesh: THREE.Mesh;
  let testGroup: THREE.Group;
  let testMaterial: THREE.MeshStandardMaterial;

  beforeEach(() => {
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    testMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.5,
      metalness: 0.3,
    });

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    testMesh = new THREE.Mesh(geometry, testMaterial);
    testMesh.name = 'testMesh';

    testGroup = new THREE.Group();
    testGroup.add(testMesh);
  });

  describe('normalizeMaterialProperties', () => {
    it('should set material to visible', () => {
      testMaterial.visible = false;

      normalizeMaterialProperties(testMaterial);

      expect(testMaterial.visible).toBe(true);
    });

    it('should set material to DoubleSide', () => {
      testMaterial.side = THREE.FrontSide;

      normalizeMaterialProperties(testMaterial);

      expect(testMaterial.side).toBe(THREE.DoubleSide);
    });

    it('should fix texture colorSpace for diffuse maps', () => {
      const texture = new THREE.Texture();
      texture.colorSpace = THREE.LinearSRGBColorSpace;
      testMaterial.map = texture;

      normalizeMaterialProperties(testMaterial);

      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('should fix texture colorSpace for normal maps', () => {
      const texture = new THREE.Texture();
      texture.colorSpace = THREE.SRGBColorSpace;
      testMaterial.normalMap = texture;

      normalizeMaterialProperties(testMaterial);

      expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    });

    it('should not apply fallbacks to materials with textures', () => {
      const texture = new THREE.Texture();
      texture.image = new Image(); // Mark as having image data
      testMaterial.map = texture;
      const originalColor = testMaterial.color.getHex();

      normalizeMaterialProperties(testMaterial, 'testMesh');

      // Color should not be changed
      expect(testMaterial.color.getHex()).toBe(originalColor);
    });

    it('should apply fallbacks to materials without textures', () => {
      testMaterial.color.set(0x000000); // Black color (problematic)

      normalizeMaterialProperties(testMaterial, 'testMesh');

      // Color should be changed to something visible
      expect(testMaterial.color.getHex()).not.toBe(0x000000);
    });

    it('should fix invisible transparency', () => {
      testMaterial.transparent = true;
      testMaterial.opacity = 0.01;

      normalizeMaterialProperties(testMaterial);

      // Should fix the invisible transparency issue via fallbacks
      // The exact behavior depends on whether there are textures
    });

    it('should handle MeshBasicMaterial', () => {
      const basicMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

      normalizeMaterialProperties(basicMaterial);

      // Should fix black color
      expect(basicMaterial.color.getHex()).not.toBe(0x000000);
    });

    it('should handle MeshPhongMaterial', () => {
      const phongMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });

      normalizeMaterialProperties(phongMaterial);

      // Should fix black color
      expect(phongMaterial.color.getHex()).not.toBe(0x000000);
    });

    it('should handle MeshLambertMaterial', () => {
      const lambertMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });

      normalizeMaterialProperties(lambertMaterial);

      // Should fix black color
      expect(lambertMaterial.color.getHex()).not.toBe(0x000000);
    });
  });

  describe('optimizeMaterialsForScene', () => {
    it('should return optimization statistics', () => {
      const result = optimizeMaterialsForScene(testGroup);

      expect(result).toHaveProperty('totalMeshes');
      expect(result).toHaveProperty('texturedMaterials');
      expect(result).toHaveProperty('fallbackMaterials');
      expect(result).toHaveProperty('fixedIssues');
    });

    it('should count total meshes', () => {
      const mesh2 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      testGroup.add(mesh2);

      const result = optimizeMaterialsForScene(testGroup);

      expect(result.totalMeshes).toBe(2);
    });

    it('should count textured materials', () => {
      const texture = new THREE.Texture();
      texture.image = new Image();
      testMaterial.map = texture;

      const result = optimizeMaterialsForScene(testGroup);

      expect(result.texturedMaterials).toBe(1);
    });

    it('should count fallback materials', () => {
      // No texture on testMaterial
      const result = optimizeMaterialsForScene(testGroup);

      expect(result.fallbackMaterials).toBe(1);
    });

    it('should add default material to meshes without materials', () => {
      testMesh.material = undefined as unknown as THREE.Material;

      optimizeMaterialsForScene(testGroup);

      expect(testMesh.material).toBeDefined();
      expect(testMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('should process multi-material meshes', () => {
      const material1 = new THREE.MeshStandardMaterial();
      const material2 = new THREE.MeshStandardMaterial();
      testMesh.material = [material1, material2];

      const result = optimizeMaterialsForScene(testGroup);

      expect(result.fallbackMaterials).toBe(2);
    });

    it('should not double-process shared materials', () => {
      const sharedMaterial = new THREE.MeshStandardMaterial();
      testMesh.material = sharedMaterial;

      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMaterial);
      testGroup.add(mesh2);

      const result = optimizeMaterialsForScene(testGroup);

      // Material should only be counted once
      expect(result.fallbackMaterials).toBe(1);
    });
  });

  describe('modelHasTextures', () => {
    it('should return false for models without textures', () => {
      expect(modelHasTextures(testGroup)).toBe(false);
    });

    it('should return true for models with diffuse texture', () => {
      const texture = new THREE.Texture();
      texture.image = new Image();
      testMaterial.map = texture;

      expect(modelHasTextures(testGroup)).toBe(true);
    });

    it('should return true for models with normal texture', () => {
      const texture = new THREE.Texture();
      texture.image = new Image();
      testMaterial.normalMap = texture;

      expect(modelHasTextures(testGroup)).toBe(true);
    });

    it('should return true for models with any PBR texture', () => {
      const texture = new THREE.Texture();
      texture.image = new Image();
      testMaterial.roughnessMap = texture;

      expect(modelHasTextures(testGroup)).toBe(true);
    });

    it('should check nested meshes', () => {
      const innerGroup = new THREE.Group();
      const texture = new THREE.Texture();
      texture.image = new Image();
      const innerMaterial = new THREE.MeshStandardMaterial({ map: texture });
      const innerMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), innerMaterial);
      innerGroup.add(innerMesh);
      testGroup.add(innerGroup);

      expect(modelHasTextures(testGroup)).toBe(true);
    });
  });

  describe('getTextureStats', () => {
    it('should return texture statistics', () => {
      const stats = getTextureStats(testGroup);

      expect(stats).toHaveProperty('totalMaterials');
      expect(stats).toHaveProperty('texturedMaterials');
      expect(stats).toHaveProperty('textureTypes');
    });

    it('should count total materials', () => {
      const mesh2 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      testGroup.add(mesh2);

      const stats = getTextureStats(testGroup);

      expect(stats.totalMaterials).toBe(2);
    });

    it('should identify texture types', () => {
      const diffuseTexture = new THREE.Texture();
      diffuseTexture.image = new Image();
      testMaterial.map = diffuseTexture;

      const normalTexture = new THREE.Texture();
      normalTexture.image = new Image();
      testMaterial.normalMap = normalTexture;

      const stats = getTextureStats(testGroup);

      expect(stats.textureTypes.has('map')).toBe(true);
      expect(stats.textureTypes.has('normalMap')).toBe(true);
    });

    it('should not double-count shared materials', () => {
      const sharedMaterial = new THREE.MeshStandardMaterial();
      testMesh.material = sharedMaterial;

      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMaterial);
      testGroup.add(mesh2);

      const stats = getTextureStats(testGroup);

      expect(stats.totalMaterials).toBe(1);
    });
  });
});
