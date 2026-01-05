/**
 * Unit tests for deepCloneModel utility
 *
 * Tests the deep cloning functionality that ensures materials are independent
 * between model instances while textures remain shared.
 */

import * as THREE from 'three';
import { describe, it, expect, beforeEach } from 'vitest';
import { deepCloneModel, deepCloneGroup } from './deepCloneModel';

describe('deepCloneModel', () => {
  let testMesh: THREE.Mesh;
  let testGroup: THREE.Group;
  let testMaterial: THREE.MeshStandardMaterial;
  let testTexture: THREE.Texture;

  beforeEach(() => {
    // Create a test texture
    testTexture = new THREE.Texture();
    testTexture.name = 'testTexture';

    // Create a test material with texture
    testMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.5,
      metalness: 0.3,
      map: testTexture,
      transparent: false,
      opacity: 1,
    });
    testMaterial.name = 'testMaterial';

    // Create a test mesh
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    testMesh = new THREE.Mesh(geometry, testMaterial);
    testMesh.name = 'testMesh';

    // Create a test group containing the mesh
    testGroup = new THREE.Group();
    testGroup.name = 'testGroup';
    testGroup.add(testMesh);
  });

  describe('deepCloneModel', () => {
    it('should clone the object hierarchy', () => {
      const cloned = deepCloneModel(testGroup);

      expect(cloned).toBeInstanceOf(THREE.Group);
      expect(cloned).not.toBe(testGroup);
      expect(cloned.name).toBe('testGroup');
    });

    it('should clone child objects', () => {
      const cloned = deepCloneModel(testGroup) as THREE.Group;

      expect(cloned.children.length).toBe(1);
      expect(cloned.children[0]).toBeInstanceOf(THREE.Mesh);
      expect(cloned.children[0]).not.toBe(testMesh);
      expect(cloned.children[0].name).toBe('testMesh');
    });

    it('should clone materials to be independent', () => {
      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterial = clonedMesh.material as THREE.MeshStandardMaterial;

      // Materials should be different instances
      expect(clonedMaterial).not.toBe(testMaterial);

      // But should have the same properties
      expect(clonedMaterial.color.getHex()).toBe(testMaterial.color.getHex());
      expect(clonedMaterial.roughness).toBe(testMaterial.roughness);
      expect(clonedMaterial.metalness).toBe(testMaterial.metalness);
    });

    it('should share textures between original and clone', () => {
      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterial = clonedMesh.material as THREE.MeshStandardMaterial;

      // Textures should be the same instance (shared GPU resources)
      expect(clonedMaterial.map).toBe(testTexture);
    });

    it('should allow independent material modifications', () => {
      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterial = clonedMesh.material as THREE.MeshStandardMaterial;

      // Modify the cloned material
      clonedMaterial.color.set(0x00ff00);
      clonedMaterial.opacity = 0.5;

      // Original should be unchanged
      expect(testMaterial.color.getHex()).toBe(0xff0000);
      expect(testMaterial.opacity).toBe(1);
    });

    it('should reset emissive to black', () => {
      // Set emissive on original (simulating selection effect)
      testMaterial.emissive.set(0x0000ff);
      testMaterial.emissiveIntensity = 2;

      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterial = clonedMesh.material as THREE.MeshStandardMaterial;

      // Emissive should be reset
      expect(clonedMaterial.emissive.getHex()).toBe(0x000000);
      expect(clonedMaterial.emissiveIntensity).toBe(1);
    });

    it('should reset opacity to 1 for non-transparent materials', () => {
      // Set opacity on original (simulating fade effect)
      testMaterial.transparent = true;
      testMaterial.opacity = 0.5;

      // But material was originally non-transparent (opacity should reset if >= 0.99)
      // Since we set it to 0.5, it should NOT reset (preserves intentional transparency)
      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterial = clonedMesh.material as THREE.MeshStandardMaterial;

      // Should preserve transparency settings when opacity < 0.99
      expect(clonedMaterial.transparent).toBe(true);
      expect(clonedMaterial.opacity).toBe(0.5);
    });

    it('should reset opacity when original was fully opaque', () => {
      // Original is fully opaque
      testMaterial.transparent = false;
      testMaterial.opacity = 1;

      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterial = clonedMesh.material as THREE.MeshStandardMaterial;

      // Should reset to non-transparent
      expect(clonedMaterial.transparent).toBe(false);
      expect(clonedMaterial.opacity).toBe(1);
    });

    it('should handle multi-material meshes', () => {
      const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const material2 = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      testMesh.material = [material1, material2];

      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;
      const clonedMaterials = clonedMesh.material as THREE.MeshStandardMaterial[];

      expect(Array.isArray(clonedMaterials)).toBe(true);
      expect(clonedMaterials.length).toBe(2);
      expect(clonedMaterials[0]).not.toBe(material1);
      expect(clonedMaterials[1]).not.toBe(material2);
      expect((clonedMaterials[0] as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
      expect((clonedMaterials[1] as THREE.MeshStandardMaterial).color.getHex()).toBe(0x00ff00);
    });

    it('should handle nested groups', () => {
      const innerGroup = new THREE.Group();
      innerGroup.name = 'innerGroup';

      const innerMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x0000ff })
      );
      innerGroup.add(innerMesh);
      testGroup.add(innerGroup);

      const cloned = deepCloneModel(testGroup) as THREE.Group;

      expect(cloned.children.length).toBe(2);

      const clonedInnerGroup = cloned.children[1] as THREE.Group;
      expect(clonedInnerGroup).not.toBe(innerGroup);
      expect(clonedInnerGroup.name).toBe('innerGroup');

      const clonedInnerMesh = clonedInnerGroup.children[0] as THREE.Mesh;
      expect(clonedInnerMesh).not.toBe(innerMesh);
      expect(clonedInnerMesh.material).not.toBe(innerMesh.material);
    });

    it('should handle meshes without materials', () => {
      const noMaterialMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      noMaterialMesh.material = undefined as unknown as THREE.Material;
      const group = new THREE.Group();
      group.add(noMaterialMesh);

      // Should not throw
      expect(() => deepCloneModel(group)).not.toThrow();
    });

    it('should handle non-standard materials', () => {
      const basicMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      testMesh.material = basicMaterial;

      const cloned = deepCloneModel(testGroup) as THREE.Group;
      const clonedMesh = cloned.children[0] as THREE.Mesh;

      // Should still clone, just won't reset emissive/opacity
      expect(clonedMesh.material).not.toBe(basicMaterial);
      expect(clonedMesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    });
  });

  describe('deepCloneGroup', () => {
    it('should return a THREE.Group', () => {
      const cloned = deepCloneGroup(testGroup);

      expect(cloned).toBeInstanceOf(THREE.Group);
    });

    it('should work the same as deepCloneModel', () => {
      const clonedViaModel = deepCloneModel(testGroup) as THREE.Group;
      const clonedViaGroup = deepCloneGroup(testGroup);

      expect(clonedViaGroup.children.length).toBe(clonedViaModel.children.length);
      expect(clonedViaGroup.name).toBe(clonedViaModel.name);
    });
  });
});

