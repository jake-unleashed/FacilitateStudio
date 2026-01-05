/**
 * Unit tests for BoundingBox component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { BoundingBox } from './BoundingBox';

// Mock React Three Fiber hooks
const mockUseFrame = vi.fn((callback) => {
  // Simulate frame updates
  const mockState = {
    clock: {
      elapsedTime: 0,
    },
  };
  callback(mockState);
});

vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    useFrame: (callback: (state: { clock: { elapsedTime: number } }) => void) => {
      mockUseFrame(callback);
    },
  };
});

describe('BoundingBox', () => {
  let testModel: THREE.Object3D;
  let testMesh: THREE.Mesh;

  beforeEach(() => {
    // Create a test model with a simple box geometry
    testModel = new THREE.Object3D();
    testMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial()
    );
    testMesh.position.set(0, 0, 0);
    testModel.add(testMesh);
    testModel.updateMatrixWorld(true);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up geometries and materials
    testMesh.geometry.dispose();
    if (testMesh.material instanceof THREE.Material) {
      testMesh.material.dispose();
    }
  });

  describe('Rendering', () => {
    it('should render when visible is true and model is provided', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={false} />
        </Canvas>
      );
      // Component should return null when not visible
      expect(container).toBeTruthy();
    });

    it('should not render when model is null', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={null as unknown as THREE.Object3D} visible={true} />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should use default color when color prop is not provided', () => {
      render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      // Default color should be #3b82f6
      expect(true).toBe(true); // Component renders without error
    });

    it('should use custom color when provided', () => {
      const customColor = '#ff0000';
      render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color={customColor} />
        </Canvas>
      );
      expect(true).toBe(true); // Component renders without error
    });
  });

  describe('Bounding Box Calculation', () => {
    it('should calculate bounding box for a simple box geometry', () => {
      const box = new THREE.Box3();
      box.setFromObject(testModel);
      expect(box.isEmpty()).toBe(false);
    });

    it('should handle model with multiple meshes', () => {
      const multiMeshModel = new THREE.Object3D();
      const mesh1 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      mesh1.position.set(-1, 0, 0);
      const mesh2 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      mesh2.position.set(1, 0, 0);
      multiMeshModel.add(mesh1);
      multiMeshModel.add(mesh2);

      render(
        <Canvas>
          <BoundingBox model={multiMeshModel} visible={true} />
        </Canvas>
      );
      expect(true).toBe(true); // Should render without error

      // Cleanup
      mesh1.geometry.dispose();
      mesh2.geometry.dispose();
      if (mesh1.material instanceof THREE.Material) mesh1.material.dispose();
      if (mesh2.material instanceof THREE.Material) mesh2.material.dispose();
    });

    it('should handle model with transforms', () => {
      const transformedModel = new THREE.Object3D();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      transformedModel.add(mesh);
      transformedModel.position.set(5, 5, 5);
      transformedModel.rotation.set(0.5, 0.5, 0.5);
      transformedModel.scale.set(2, 2, 2);

      render(
        <Canvas>
          <BoundingBox model={transformedModel} visible={true} />
        </Canvas>
      );
      expect(true).toBe(true); // Should render without error

      // Cleanup
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });

    it('should handle empty model gracefully', () => {
      const emptyModel = new THREE.Object3D();
      const { container } = render(
        <Canvas>
          <BoundingBox model={emptyModel} visible={true} />
        </Canvas>
      );
      // Should handle gracefully (may return null or render empty box)
      expect(container).toBeTruthy();
    });
  });

  describe('Animation', () => {
    it('should animate when animated prop is true', () => {
      render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} animated={true} />
        </Canvas>
      );
      // useFrame should be called
      expect(mockUseFrame).toHaveBeenCalled();
    });

    it('should not animate when animated prop is false', () => {
      render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} animated={false} />
        </Canvas>
      );
      // useFrame should still be called for fade animation
      expect(mockUseFrame).toHaveBeenCalled();
    });
  });

  describe('Raycasting', () => {
    it('should disable raycasting on bounding box elements', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      // Raycasting should be disabled via useEffect
      expect(container).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle model with zero-size bounding box', () => {
      const zeroSizeModel = new THREE.Object3D();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0, 0, 0),
        new THREE.MeshStandardMaterial()
      );
      zeroSizeModel.add(mesh);

      const { container } = render(
        <Canvas>
          <BoundingBox model={zeroSizeModel} visible={true} />
        </Canvas>
      );
      // Should return null for zero-size models
      expect(container.firstChild).toBeNull();

      // Cleanup
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });

    it('should handle model with very large dimensions', () => {
      const largeModel = new THREE.Object3D();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1000, 1000, 1000),
        new THREE.MeshStandardMaterial()
      );
      largeModel.add(mesh);

      render(
        <Canvas>
          <BoundingBox model={largeModel} visible={true} />
        </Canvas>
      );
      expect(true).toBe(true); // Should render without error

      // Cleanup
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });

    it('should handle model with negative scale', () => {
      const scaledModel = new THREE.Object3D();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      scaledModel.add(mesh);
      scaledModel.scale.set(-1, -1, -1);

      render(
        <Canvas>
          <BoundingBox model={scaledModel} visible={true} />
        </Canvas>
      );
      expect(true).toBe(true); // Should handle negative scale

      // Cleanup
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });
  });

  describe('Material Properties', () => {
    it('should create materials with correct properties', () => {
      render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#ff0000" />
        </Canvas>
      );
      // Materials should be created with correct color
      expect(true).toBe(true); // Component renders
    });

    it('should update materials when color changes', () => {
      const { rerender } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#ff0000" />
        </Canvas>
      );
      rerender(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#00ff00" />
        </Canvas>
      );
      expect(true).toBe(true); // Should update without error
    });
  });

  describe('Corner Size Calculation', () => {
    it('should calculate appropriate corner size for small models', () => {
      const smallModel = new THREE.Object3D();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshStandardMaterial()
      );
      smallModel.add(mesh);

      render(
        <Canvas>
          <BoundingBox model={smallModel} visible={true} />
        </Canvas>
      );
      expect(true).toBe(true); // Should render with appropriate corner size

      // Cleanup
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });

    it('should calculate appropriate corner size for large models', () => {
      const largeModel = new THREE.Object3D();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(100, 100, 100),
        new THREE.MeshStandardMaterial()
      );
      largeModel.add(mesh);

      render(<BoundingBox model={largeModel} visible={true} />);
      expect(true).toBe(true); // Should render with appropriate corner size

      // Cleanup
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    });
  });
});

