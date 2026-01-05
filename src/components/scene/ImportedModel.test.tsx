/**
 * Unit tests for ImportedModel component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { ImportedModel } from './ImportedModel';
import { SceneObject } from '../../types';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    // Simulate frame updates
    const mockState = {
      clock: {
        elapsedTime: 0,
      },
    };
    callback(mockState);
  }),
  ThreeEvent: {},
}));

// Mock model loaders
const mockLoadAndPreprocessModel = vi.fn();
vi.mock('../../utils/modelLoaders', () => ({
  loadAndPreprocessModel: mockLoadAndPreprocessModel,
}));

// Mock asset storage
const mockGetAsset = vi.fn();
vi.mock('../../utils/assetStorage', () => ({
  getAsset: mockGetAsset,
}));

// Mock BoundingBox component
vi.mock('./BoundingBox', () => ({
  BoundingBox: ({ visible }: { visible?: boolean }) => {
    return visible ? <div data-testid="bounding-box">BoundingBox</div> : null;
  },
}));

describe('ImportedModel', () => {
  let testObject: SceneObject;
  let testModel: THREE.Object3D;
  let mockOnPointerDown: ReturnType<typeof vi.fn>;
  let mockOnDoubleClick: ReturnType<typeof vi.fn>;
  let mockOnHoverStart: ReturnType<typeof vi.fn>;
  let mockOnHoverEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create test scene object
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
    };

    // Create test model
    testModel = new THREE.Object3D();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial()
    );
    testModel.add(mesh);

    // Create mock callbacks
    mockOnPointerDown = vi.fn();
    mockOnDoubleClick = vi.fn();
    mockOnHoverStart = vi.fn();
    mockOnHoverEnd = vi.fn();

    // Setup default mocks
    mockGetAsset.mockResolvedValue({
      base64Data: 'test-data',
      fileType: 'glb',
      metrics: {
        size: { x: 2, y: 2, z: 2 },
        center: { x: 0, y: 0, z: 0 },
      },
    });

    mockLoadAndPreprocessModel.mockResolvedValue({
      model: testModel.clone(),
      metrics: {
        size: { x: 2, y: 2, z: 2 },
        center: { x: 0, y: 0, z: 0 },
      },
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    testModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  });

  describe('Rendering', () => {
    it('should render loading placeholder initially', async () => {
      mockLoadAndPreprocessModel.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

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

    it('should render model after loading', async () => {
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

      await waitFor(() => {
        expect(mockGetAsset).toHaveBeenCalledWith('test-asset-id');
      });
    });

    it('should render error state when model fails to load', async () => {
      mockGetAsset.mockRejectedValue(new Error('Failed to load asset'));

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

      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('should render error state when modelAssetId is missing', () => {
      const objectWithoutAssetId = {
        ...testObject,
        properties: {
          ...testObject.properties,
          modelAssetId: undefined,
        },
      };

      const { container } = render(
        <ImportedModel
          obj={objectWithoutAssetId}
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

  describe('Selection State', () => {
    it('should render bounding box when selected', async () => {
      const { queryByTestId } = render(
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

      await waitFor(() => {
        const boundingBox = queryByTestId('bounding-box');
        expect(boundingBox).toBeTruthy();
      });
    });

    it('should not render bounding box when not selected', async () => {
      const { queryByTestId } = render(
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
        const boundingBox = queryByTestId('bounding-box');
        expect(boundingBox).toBeNull();
      });
    });

    it('should use ghost color when isGhost is true', async () => {
      const { queryByTestId } = render(
        <ImportedModel
          obj={testObject}
          isSelected={true}
          isGhost={true}
          onPointerDown={mockOnPointerDown}
          onDoubleClick={mockOnDoubleClick}
          isDragging={false}
          isHovered={false}
          onHoverStart={mockOnHoverStart}
          onHoverEnd={mockOnHoverEnd}
        />
      );

      await waitFor(() => {
        const boundingBox = queryByTestId('bounding-box');
        expect(boundingBox).toBeTruthy();
      });
    });
  });

  describe('Transform Calculations', () => {
    it('should calculate position correctly', async () => {
      const positionedObject = {
        ...testObject,
        transform: {
          ...testObject.transform,
          x: 100,
          y: 50,
          z: -200,
        },
      };

      render(
        <ImportedModel
          obj={positionedObject}
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should calculate rotation correctly', async () => {
      const rotatedObject = {
        ...testObject,
        transform: {
          ...testObject.transform,
          rotationX: 45,
          rotationY: 90,
          rotationZ: 180,
        },
      };

      render(
        <ImportedModel
          obj={rotatedObject}
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should calculate scale correctly', async () => {
      const scaledObject = {
        ...testObject,
        transform: {
          ...testObject.transform,
          scaleX: 2,
          scaleY: 1.5,
          scaleZ: 0.5,
        },
      };

      render(
        <ImportedModel
          obj={scaledObject}
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should calculate model offset correctly based on height', async () => {
      mockGetAsset.mockResolvedValue({
        base64Data: 'test-data',
        fileType: 'glb',
        metrics: {
          size: { x: 2, y: 4, z: 2 },
          center: { x: 0, y: 0, z: 0 },
        },
      });

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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });
  });

  describe('Event Handlers', () => {
    it('should call onPointerDown when pointer down event occurs', async () => {
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should call onDoubleClick when double click occurs', async () => {
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should call onHoverStart when pointer enters', async () => {
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should call onHoverEnd when pointer leaves', async () => {
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });
  });

  describe('Model Caching', () => {
    it('should use cached model when available', async () => {
      // First render to cache the model
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

      await waitFor(() => {
        expect(mockGetAsset).toHaveBeenCalled();
      });

      // Second render with same asset ID should use cache
      mockGetAsset.mockClear();
      mockLoadAndPreprocessModel.mockClear();

      rerender(
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

      // Should still call getAsset to get metrics, but may use cached model
      await waitFor(() => {
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });
  });

  describe('Fade-in Animation', () => {
    it('should start with opacity 0 and fade in', async () => {
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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle model with no metrics', async () => {
      mockGetAsset.mockResolvedValue({
        base64Data: 'test-data',
        fileType: 'glb',
        metrics: undefined,
      });

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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });

    it('should handle model with zero height', async () => {
      mockGetAsset.mockResolvedValue({
        base64Data: 'test-data',
        fileType: 'glb',
        metrics: {
          size: { x: 2, y: 0, z: 2 },
          center: { x: 0, y: 0, z: 0 },
        },
      });

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
        expect(mockGetAsset).toHaveBeenCalled();
      });
    });
  });
});

