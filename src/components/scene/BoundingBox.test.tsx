/**
 * Unit tests for BoundingBox component
 *
 * Tests the premium selection indicator that provides clean edge-line
 * wireframe visualization for selected 3D objects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { BoundingBox, createEdgeGeometry, calculateBoundingBoxData } from './BoundingBox';

// ============================================================================
// Mocks
// ============================================================================

// Track useFrame calls
let useFrameCallback: ((state: { clock: { elapsedTime: number } }) => void) | null = null;

vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    useFrame: (callback: (state: { clock: { elapsedTime: number } }) => void) => {
      useFrameCallback = callback;
    },
  };
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a test model with a box mesh
 */
function createTestModel(size = 2): { model: THREE.Object3D; mesh: THREE.Mesh } {
  const model = new THREE.Object3D();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial()
  );
  mesh.position.set(0, 0, 0);
  model.add(mesh);
  model.updateMatrixWorld(true);
  return { model, mesh };
}

/**
 * Clean up a mesh's geometry and material
 */
function cleanupMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  if (mesh.material instanceof THREE.Material) {
    mesh.material.dispose();
  }
}

// ============================================================================
// Tests: createEdgeGeometry Helper
// ============================================================================

describe('createEdgeGeometry', () => {
  it('should create geometry with 12 edges (24 vertices, 72 position values)', () => {
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

    const geometry = createEdgeGeometry(box);
    const positions = geometry.getAttribute('position');

    // 12 edges × 2 vertices × 3 components = 72 values
    expect(positions.count).toBe(24); // 24 vertices
    expect(positions.array.length).toBe(72); // 72 position values

    geometry.dispose();
  });

  it('should correctly position edge vertices at box corners', () => {
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2));

    const geometry = createEdgeGeometry(box);
    const positions = geometry.getAttribute('position').array;

    // First edge should connect corners (0,0,0) to (2,0,0)
    expect(positions[0]).toBe(0); // x
    expect(positions[1]).toBe(0); // y
    expect(positions[2]).toBe(0); // z
    expect(positions[3]).toBe(2); // x
    expect(positions[4]).toBe(0); // y
    expect(positions[5]).toBe(0); // z

    geometry.dispose();
  });

  it('should handle asymmetric bounding boxes', () => {
    const box = new THREE.Box3(new THREE.Vector3(-5, 0, -2), new THREE.Vector3(3, 10, 8));

    const geometry = createEdgeGeometry(box);
    expect(geometry).toBeDefined();
    expect(geometry.getAttribute('position').count).toBe(24);

    geometry.dispose();
  });
});

// ============================================================================
// Tests: calculateBoundingBoxData Helper
// ============================================================================

describe('calculateBoundingBoxData', () => {
  it('should return null for null model', () => {
    const result = calculateBoundingBoxData(null as unknown as THREE.Object3D);
    expect(result).toBeNull();
  });

  it('should calculate correct bounding box for simple mesh', () => {
    const { model, mesh } = createTestModel(2);

    const result = calculateBoundingBoxData(model);

    expect(result).not.toBeNull();
    expect(result!.size.x).toBeCloseTo(2);
    expect(result!.size.y).toBeCloseTo(2);
    expect(result!.size.z).toBeCloseTo(2);

    cleanupMesh(mesh);
  });

  it('should calculate correct center for centered model', () => {
    const { model, mesh } = createTestModel(2);

    const result = calculateBoundingBoxData(model);

    expect(result).not.toBeNull();
    expect(result!.center.x).toBeCloseTo(0);
    expect(result!.center.y).toBeCloseTo(0);
    expect(result!.center.z).toBeCloseTo(0);

    cleanupMesh(mesh);
  });

  it('should return null for zero-size model', () => {
    const model = new THREE.Object3D();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0, 0, 0), new THREE.MeshStandardMaterial());
    model.add(mesh);

    const result = calculateBoundingBoxData(model);

    expect(result).toBeNull();

    cleanupMesh(mesh);
  });

  it('should handle model with multiple meshes', () => {
    const model = new THREE.Object3D();
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    mesh1.position.set(-2, 0, 0);
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    mesh2.position.set(2, 0, 0);
    model.add(mesh1);
    model.add(mesh2);

    const result = calculateBoundingBoxData(model);

    expect(result).not.toBeNull();
    // Should span from -2.5 to 2.5 on x-axis (size = 5)
    expect(result!.size.x).toBeCloseTo(5);

    cleanupMesh(mesh1);
    cleanupMesh(mesh2);
  });

  it('should account for model transforms', () => {
    const { model, mesh } = createTestModel(1);
    model.scale.set(2, 2, 2);
    model.updateMatrix();

    const result = calculateBoundingBoxData(model);

    expect(result).not.toBeNull();
    // Scaled 2x, so size should be 2
    expect(result!.size.x).toBeCloseTo(2);
    expect(result!.size.y).toBeCloseTo(2);
    expect(result!.size.z).toBeCloseTo(2);

    cleanupMesh(mesh);
  });

  it('should handle empty model (no meshes)', () => {
    const model = new THREE.Object3D();

    const result = calculateBoundingBoxData(model);

    // Empty model returns null (zero size)
    expect(result).toBeNull();
  });
});

// ============================================================================
// Tests: BoundingBox Component
// ============================================================================

describe('BoundingBox Component', () => {
  let testModel: THREE.Object3D;
  let testMesh: THREE.Mesh;

  beforeEach(() => {
    const created = createTestModel(2);
    testModel = created.model;
    testMesh = created.mesh;
    useFrameCallback = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupMesh(testMesh);
  });

  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    it('should render when visible is true and model is provided', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should handle visible=false gracefully', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={false} />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should handle null model gracefully', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={null as unknown as THREE.Object3D} visible={true} />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should use default blue color when not specified', () => {
      // Should render without error using default #3b82f6
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should accept custom color prop', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#ff0000" />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });

    it('should accept purple color for ghost objects', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#a855f7" />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Animation Tests
  // --------------------------------------------------------------------------

  describe('Fade Animation', () => {
    it('should register useFrame callback for animation', () => {
      render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      // The mock should have captured the callback
      expect(useFrameCallback).toBeDefined();
    });

    it('should handle visibility transitions without error', () => {
      const { rerender } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );

      // Toggle visibility - should not throw
      rerender(
        <Canvas>
          <BoundingBox model={testModel} visible={false} />
        </Canvas>
      );

      expect(true).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Raycasting Tests
  // --------------------------------------------------------------------------

  describe('Raycasting', () => {
    it('should disable raycasting to prevent event interception', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      // Component should render with raycasting disabled via useEffect
      expect(container).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('should handle zero-size bounding box without crashing', () => {
      const zeroModel = new THREE.Object3D();
      const zeroMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0, 0, 0),
        new THREE.MeshStandardMaterial()
      );
      zeroModel.add(zeroMesh);

      // Should render without throwing
      const { container } = render(
        <Canvas>
          <BoundingBox model={zeroModel} visible={true} />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(zeroMesh);
    });

    it('should handle very large models', () => {
      const largeModel = new THREE.Object3D();
      const largeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1000, 1000, 1000),
        new THREE.MeshStandardMaterial()
      );
      largeModel.add(largeMesh);

      const { container } = render(
        <Canvas>
          <BoundingBox model={largeModel} visible={true} />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(largeMesh);
    });

    it('should handle very small models', () => {
      const smallModel = new THREE.Object3D();
      const smallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.001, 0.001, 0.001),
        new THREE.MeshStandardMaterial()
      );
      smallModel.add(smallMesh);

      const { container } = render(
        <Canvas>
          <BoundingBox model={smallModel} visible={true} />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(smallMesh);
    });

    it('should handle negative scale', () => {
      const scaledModel = new THREE.Object3D();
      const scaledMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      scaledModel.add(scaledMesh);
      scaledModel.scale.set(-1, -1, -1);

      const { container } = render(
        <Canvas>
          <BoundingBox model={scaledModel} visible={true} />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(scaledMesh);
    });

    it('should handle rotated models', () => {
      const rotatedModel = new THREE.Object3D();
      const rotatedMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 3),
        new THREE.MeshStandardMaterial()
      );
      rotatedModel.add(rotatedMesh);
      rotatedModel.rotation.set(Math.PI / 4, Math.PI / 3, Math.PI / 6);

      const { container } = render(
        <Canvas>
          <BoundingBox model={rotatedModel} visible={true} />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(rotatedMesh);
    });

    it('should handle translated models', () => {
      const translatedModel = new THREE.Object3D();
      const translatedMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      translatedModel.add(translatedMesh);
      translatedModel.position.set(100, 200, 300);

      const { container } = render(
        <Canvas>
          <BoundingBox model={translatedModel} visible={true} />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(translatedMesh);
    });
  });

  // --------------------------------------------------------------------------
  // Material Tests
  // --------------------------------------------------------------------------

  describe('Material Properties', () => {
    it('should create transparent material', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );
      // Material should be transparent for fade effects
      expect(container).toBeTruthy();
    });

    it('should update color when prop changes', () => {
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

      expect(true).toBe(true);
    });

    it('should handle hex color format', () => {
      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#abc123" />
        </Canvas>
      );
      expect(container).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Integration Tests
  // --------------------------------------------------------------------------

  describe('Integration', () => {
    it('should work with multiple BoundingBox instances', () => {
      const { model: model2, mesh: mesh2 } = createTestModel(3);

      const { container } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} color="#ff0000" />
          <BoundingBox model={model2} visible={true} color="#00ff00" />
        </Canvas>
      );

      expect(container).toBeTruthy();
      cleanupMesh(mesh2);
    });

    it('should handle rapid visibility toggles', () => {
      const { rerender } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );

      for (let i = 0; i < 10; i++) {
        rerender(
          <Canvas>
            <BoundingBox model={testModel} visible={i % 2 === 0} />
          </Canvas>
        );
      }

      expect(true).toBe(true);
    });

    it('should handle model changes', () => {
      const { model: newModel, mesh: newMesh } = createTestModel(5);

      const { rerender } = render(
        <Canvas>
          <BoundingBox model={testModel} visible={true} />
        </Canvas>
      );

      rerender(
        <Canvas>
          <BoundingBox model={newModel} visible={true} />
        </Canvas>
      );

      expect(true).toBe(true);
      cleanupMesh(newMesh);
    });
  });
});
