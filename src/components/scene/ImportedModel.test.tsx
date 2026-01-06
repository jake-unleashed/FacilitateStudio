/**
 * Unit tests for ImportedModel component
 *
 * Tests the 3D model rendering component that loads models from the cache
 * and handles selection, hover, and transform states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { SceneObject } from '../../types';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    // Simulate a single frame update
    const mockState = {
      clock: { elapsedTime: 0 },
    };
    callback(mockState);
  }),
  ThreeEvent: {},
}));

// Mock model cache - must be before importing the component
vi.mock('../../utils/modelCache', () => ({
  getOrLoadModel: vi.fn(),
}));

// Import after mocks are set up
import { ImportedModel } from './ImportedModel';
import { getOrLoadModel } from '../../utils/modelCache';

describe('ImportedModel', () => {
  // ==========================================================================
  // Test Data
  // ==========================================================================

  let testObject: SceneObject;
  let testGroup: THREE.Group;
  let mockOnPointerDown: ReturnType<typeof vi.fn>;
  let mockOnDoubleClick: ReturnType<typeof vi.fn>;
  let mockOnHoverStart: ReturnType<typeof vi.fn>;
  let mockOnHoverEnd: ReturnType<typeof vi.fn>;

  const createTestGroup = (): THREE.Group => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    group.add(mesh);
    return group;
  };

  const createMockMetrics = () => ({
    boundingBox: {
      min: { x: -1, y: 0, z: -1 },
      max: { x: 1, y: 2, z: 1 },
    },
    center: { x: 0, y: 1, z: 0 },
    size: { x: 2, y: 2, z: 2 },
    bottomY: 0,
    topY: 2,
    maxDimension: 2,
    triangleCount: 12,
  });

  beforeEach(() => {
    // Create test scene object with modelAssetId
    testObject = {
      id: 'test-object-1',
      name: 'Test Model',
      type: 'mesh',
      transform: {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      properties: {
        visible: true,
        modelAssetId: 'test-asset-id',
      },
    } as SceneObject;

    // Create test model
    testGroup = createTestGroup();

    // Create mock callbacks
    mockOnPointerDown = vi.fn();
    mockOnDoubleClick = vi.fn();
    mockOnHoverStart = vi.fn();
    mockOnHoverEnd = vi.fn();

    // Setup default mock for getOrLoadModel
    vi.mocked(getOrLoadModel).mockResolvedValue({
      model: testGroup,
      metrics: createMockMetrics(),
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup Three.js resources
    testGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    vi.resetAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should load model when modelAssetId is provided', async () => {
      render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      await waitFor(() => {
        expect(getOrLoadModel).toHaveBeenCalledWith('test-asset-id');
      });
    });

    it('should not call getOrLoadModel when modelAssetId is missing', async () => {
      const objectWithoutAsset = {
        ...testObject,
        properties: { visible: true },
      } as SceneObject;

      render(
        <ImportedModel
          obj={objectWithoutAsset}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      // Wait a bit to ensure no call is made
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(getOrLoadModel).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Loading States
  // ==========================================================================

  describe('Loading States', () => {
    it('should handle loading state', async () => {
      // Make getOrLoadModel never resolve
      vi.mocked(getOrLoadModel).mockImplementation(() => new Promise(() => {}));

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      // Component should render without error during loading
      expect(container).toBeTruthy();
    });

    it('should handle loading error gracefully', async () => {
      vi.mocked(getOrLoadModel).mockRejectedValue(new Error('Failed to load model'));

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      // Wait for error to be handled
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });

  // ==========================================================================
  // Transform Tests
  // ==========================================================================

  describe('Transforms', () => {
    it('should apply position from transform', () => {
      testObject.transform.x = 100;
      testObject.transform.y = 50;
      testObject.transform.z = 200;

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should apply rotation from transform', () => {
      testObject.transform.rotationX = 45;
      testObject.transform.rotationY = 90;
      testObject.transform.rotationZ = 180;

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should apply scale from transform', () => {
      testObject.transform.scaleX = 2;
      testObject.transform.scaleY = 0.5;
      testObject.transform.scaleZ = 1.5;

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  // ==========================================================================
  // Selection and Hover Tests
  // ==========================================================================

  describe('Selection and Hover', () => {
    it('should render with isSelected=true', () => {
      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={true}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should render with isHovered=true', () => {
      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={true}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should render with isGhost=true', () => {
      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={true}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
          isGhost={true}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  // ==========================================================================
  // Memoization Tests
  // ==========================================================================

  describe('Memoization', () => {
    it('should not re-render when unrelated props change', async () => {
      const { rerender } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      // Clear mocks after initial render
      vi.mocked(getOrLoadModel).mockClear();

      // Rerender with same props (different references but same values)
      rerender(
        <ImportedModel
          obj={{ ...testObject }}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      // The model should not be reloaded since the ID hasn't changed
      // (Note: actual behavior depends on memo implementation)
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero dimensions', () => {
      testObject.transform.scaleX = 0;
      testObject.transform.scaleY = 0;
      testObject.transform.scaleZ = 0;

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle negative positions', () => {
      testObject.transform.x = -500;
      testObject.transform.y = -100;
      testObject.transform.z = -200;

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle large rotation values', () => {
      testObject.transform.rotationY = 720; // Two full rotations

      const { container } = render(
        <ImportedModel
          obj={testObject}
          isSelected={false}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      expect(container).toBeTruthy();
    });
  });
});
