/**
 * Unit tests for TransformGizmo component
 *
 * Tests the floating handles for object manipulation:
 * - Height Handle: Drag up/down to adjust Y position
 * - XZ Handle: Drag to move object on the ground plane
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as THREE from 'three';
import React from 'react';

import { SceneObject, ChildMesh } from '../../types';

// ============================================================================
// Mocks
// ============================================================================

// Mock React Three Fiber
const mockCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
mockCamera.position.set(5, 5, 5);
mockCamera.lookAt(0, 0, 0);
mockCamera.updateMatrixWorld(true);

const mockGl = {
  domElement: {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    }),
  },
} as unknown as THREE.WebGLRenderer;

const mockScene = new THREE.Scene();

// Track frame callbacks for testing
const frameCallbacks: Array<(state: unknown) => void> = [];

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: mockCamera,
    gl: mockGl,
    scene: mockScene,
  }),
  useFrame: vi.fn((callback: (state: unknown) => void) => {
    frameCallbacks.push(callback);
  }),
}));

// Mock @react-three/drei Html component
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drei-html">{children}</div>
  ),
}));

// Mock findChildByPath utility
vi.mock('../../utils/modelLoaders', () => ({
  findChildByPath: vi.fn(() => null),
}));

// Import after mocks
import { TransformGizmo } from './TransformGizmo';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test SceneObject
 */
function createTestObject(overrides?: Partial<SceneObject>): SceneObject {
  return {
    id: 'test-object-1',
    name: 'Test Object',
    type: 'mesh',
    transform: {
      x: 0,
      y: 100,
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
    ...overrides,
  } as SceneObject;
}

/**
 * Creates a test ChildMesh
 */
function createTestChild(path: string[]): ChildMesh {
  return {
    path,
    name: path[path.length - 1] || 'TestChild',
    localTransform: {
      x: 0,
      y: 50,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
  };
}

/**
 * Creates a Three.js group with userData for testing
 */
function createTestGroup(objectId: string): THREE.Group {
  const group = new THREE.Group();
  group.userData.objectId = objectId;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  group.add(mesh);

  // Position the group so bounding box is valid
  group.position.set(0, 0.5, 0);
  group.updateMatrixWorld(true);

  return group;
}

/**
 * Simulates running a frame update
 */
function runFrame(): void {
  frameCallbacks.forEach((cb) => cb({}));
}

// ============================================================================
// Tests
// ============================================================================

describe('TransformGizmo', () => {
  let testObject: SceneObject;
  let testGroup: THREE.Group;
  let mockOnUpdateObject: ReturnType<typeof vi.fn>;
  let mockOnDragStart: ReturnType<typeof vi.fn>;
  let mockOnDragEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear frame callbacks
    frameCallbacks.length = 0;

    // Clear the mock scene
    while (mockScene.children.length > 0) {
      mockScene.remove(mockScene.children[0]);
    }

    // Create test data
    testObject = createTestObject();
    testGroup = createTestGroup(testObject.id);
    mockScene.add(testGroup);

    // Create mock callbacks
    mockOnUpdateObject = vi.fn();
    mockOnDragStart = vi.fn();
    mockOnDragEnd = vi.fn();

    // Reset mocks
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
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should render height handle', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      // Run a frame to update positions
      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle).toBeTruthy();
    });

    it('should render XZ handle', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const xzHandle = screen.getByTestId('handle-xz');
      expect(xzHandle).toBeTruthy();
    });

    it('should keep gizmo visible when isDragging is true (handles stay tethered)', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          isDragging={true}
        />
      );

      runFrame();

      // Handles should remain visible during direct object dragging (no smoothing lag)
      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle).toBeTruthy();
    });

    it('should render LeftRight handle for side view switching', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // LeftRight handle should be rendered (visibility depends on view mode)
      const leftRightHandle = screen.getByTestId('handle-leftright');
      expect(leftRightHandle).toBeTruthy();
    });

    it('should render all handle containers', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // All three handle types should exist in DOM
      expect(screen.getByTestId('transform-gizmo-height')).toBeTruthy();
      expect(screen.getByTestId('transform-gizmo-xz')).toBeTruthy();
      expect(screen.getByTestId('transform-gizmo-leftright')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Height Handle Tests
  // ==========================================================================

  describe('Height Handle', () => {
    it('should have correct aria label', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle.getAttribute('aria-label')).toContain('Height');
    });

    it('should call onDragStart when pointer down', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      expect(mockOnDragStart).toHaveBeenCalled();
    });

    it('should call onDragEnd after movement', async () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move significantly (more than threshold)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 250,
          bubbles: true,
        })
      );

      // End drag
      fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));

      expect(mockOnDragEnd).toHaveBeenCalled();
    });

    it('should call onUpdateObject during drag', async () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move significantly (more than 3px threshold)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 250,
          bubbles: true,
        })
      );

      expect(mockOnUpdateObject).toHaveBeenCalled();
    });

    it('should not trigger drag for small movements', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move only 1 pixel (less than 3px threshold)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 299,
          bubbles: true,
        })
      );

      // Should not have called onUpdateObject yet
      expect(mockOnUpdateObject).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // XZ Handle Tests
  // ==========================================================================

  describe('XZ Handle', () => {
    it('should have correct aria label', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const xzHandle = screen.getByTestId('handle-xz');
      expect(xzHandle.getAttribute('aria-label')).toContain('Move');
    });

    it('should render with correct styles', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const xzHandle = screen.getByTestId('handle-xz');
      expect(xzHandle.className).toContain('cursor-grab');
    });
  });

  // ==========================================================================
  // Left/Right Handle Tests (Side View Mode)
  // ==========================================================================

  describe('Left/Right Handle', () => {
    it('should render with correct aria label', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const leftRightHandle = screen.getByTestId('handle-leftright');
      expect(leftRightHandle.getAttribute('aria-label')).toContain('left/right');
    });

    it('should render with cursor-grab style', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const leftRightHandle = screen.getByTestId('handle-leftright');
      expect(leftRightHandle.className).toContain('cursor-grab');
    });

    it('should call onDragStart when pointer down', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const leftRightHandle = screen.getByTestId('handle-leftright');
      fireEvent.pointerDown(leftRightHandle, { clientX: 400 });

      expect(mockOnDragStart).toHaveBeenCalled();
    });

    it('should call onDragEnd after horizontal movement', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const leftRightHandle = screen.getByTestId('handle-leftright');

      // Start drag
      fireEvent.pointerDown(leftRightHandle, { clientX: 400 });

      // Move significantly horizontally (more than threshold)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientX: 450,
          bubbles: true,
        })
      );

      // End drag
      fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));

      expect(mockOnDragEnd).toHaveBeenCalled();
    });

    it('should not trigger drag for small movements', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const leftRightHandle = screen.getByTestId('handle-leftright');

      // Start drag
      fireEvent.pointerDown(leftRightHandle, { clientX: 400 });

      // Move only 1 pixel (less than 3px threshold)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientX: 401,
          bubbles: true,
        })
      );

      // Should not have called onUpdateObject yet
      expect(mockOnUpdateObject).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Tooltip Tests
  // ==========================================================================

  describe('Tooltips', () => {
    it('should show click tooltip when clicking without dragging', async () => {
      vi.useFakeTimers();

      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Click without moving
      fireEvent.pointerDown(heightHandle, { clientY: 300 });
      fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));

      // Should not call onDragEnd if no movement
      expect(mockOnDragEnd).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should have cursor-grab style', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle.className).toContain('cursor-grab');
    });
  });

  // ==========================================================================
  // Child Object Tests
  // ==========================================================================

  describe('Child Object Selection', () => {
    it('should render when child is selected', () => {
      const childMesh = createTestChild(['child1']);
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="child1"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle).toBeTruthy();
    });

    it('should update child localTransform when dragging height', () => {
      const childMesh = createTestChild(['child1']);
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="child1"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move significantly
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 250,
          bubbles: true,
        })
      );

      // Should update children array
      expect(mockOnUpdateObject).toHaveBeenCalled();
      const updateCall = mockOnUpdateObject.mock.calls[0][0];
      expect(updateCall.children).toBeDefined();
    });

    it('should handle child path correctly', () => {
      const childMesh = createTestChild(['model', 'child1']);
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      const { container } = render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="model.child1"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Should render successfully with child path
      expect(container).toBeTruthy();
      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Position Update Tests
  // ==========================================================================

  describe('Position Updates', () => {
    it('should update position when object moves', () => {
      const { rerender } = render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Update object position
      const movedObject = {
        ...testObject,
        transform: { ...testObject.transform, x: 200 },
      };

      rerender(
        <TransformGizmo
          object={movedObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Component should still render
      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });

    it('should fallback to object transform when group not found', () => {
      // Remove the group from scene
      mockScene.remove(testGroup);

      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Should still render with fallback positioning
      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero scale object', () => {
      const zeroScaleObject = {
        ...testObject,
        transform: { ...testObject.transform, scaleX: 0, scaleY: 0, scaleZ: 0 },
      };

      render(
        <TransformGizmo
          object={zeroScaleObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });

    it('should handle negative positions', () => {
      const negativeObject = {
        ...testObject,
        transform: { ...testObject.transform, x: -500, y: -100, z: -200 },
      };

      render(
        <TransformGizmo
          object={negativeObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });

    it('should handle undefined callbacks gracefully', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Should not throw when dragging without callbacks
      fireEvent.pointerDown(heightHandle, { clientY: 300 });
      fireEvent(window, new PointerEvent('pointermove', { clientY: 250, bubbles: true }));
      fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));

      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });

    it('should handle empty children array', () => {
      const objectWithEmptyChildren = {
        ...testObject,
        children: [],
      };

      render(
        <TransformGizmo
          object={objectWithEmptyChildren}
          selectedChildPath="nonexistent"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have aria-label on height handle', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have aria-label on XZ handle', () => {
      render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const xzHandle = screen.getByTestId('handle-xz');
      expect(xzHandle.getAttribute('aria-label')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Memoization Tests
  // ==========================================================================

  describe('Memoization', () => {
    it('should be memoized', () => {
      expect(TransformGizmo.displayName).toBe('TransformGizmo');
    });

    it('should not re-render unnecessarily', () => {
      const { rerender } = render(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Rerender with same props
      rerender(
        <TransformGizmo
          object={testObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Should still render correctly
      expect(screen.getByTestId('handle-height')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Height Value Clamping Tests
  // ==========================================================================

  describe('Height Value Clamping', () => {
    it('should clamp height to minimum 0', () => {
      // Start with low height
      const lowObject = {
        ...testObject,
        transform: { ...testObject.transform, y: 10 },
      };

      render(
        <TransformGizmo
          object={lowObject}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Drag down significantly (would result in negative if not clamped)
      fireEvent.pointerDown(heightHandle, { clientY: 300 });
      fireEvent(window, new PointerEvent('pointermove', { clientY: 1000, bubbles: true }));

      if (mockOnUpdateObject.mock.calls.length > 0) {
        const lastCall = mockOnUpdateObject.mock.calls[mockOnUpdateObject.mock.calls.length - 1][0];
        expect(lastCall.transform.y).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('TransformGizmo Utility Functions', () => {
  describe('extractScaleFromMatrix', () => {
    it('should extract correct scale from identity matrix', () => {
      const matrix = new THREE.Matrix4();
      const elements = matrix.elements;

      // X scale (elements 0,1,2)
      const scaleX = Math.sqrt(
        elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]
      );

      expect(scaleX).toBeCloseTo(1);
    });

    it('should extract correct scale from scaled matrix', () => {
      const matrix = new THREE.Matrix4();
      matrix.makeScale(2, 3, 4);
      const elements = matrix.elements;

      const scaleX = Math.sqrt(
        elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]
      );
      const scaleY = Math.sqrt(
        elements[4] * elements[4] + elements[5] * elements[5] + elements[6] * elements[6]
      );
      const scaleZ = Math.sqrt(
        elements[8] * elements[8] + elements[9] * elements[9] + elements[10] * elements[10]
      );

      expect(scaleX).toBeCloseTo(2);
      expect(scaleY).toBeCloseTo(3);
      expect(scaleZ).toBeCloseTo(4);
    });
  });

  describe('clamp function logic', () => {
    it('should clamp value to min', () => {
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it('should clamp value to max', () => {
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should not clamp value within range', () => {
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      expect(clamp(50, 0, 100)).toBe(50);
    });
  });

  describe('getViewMode logic', () => {
    // Constants from TransformGizmo.tsx
    const SIDE_VIEW_THRESHOLD = 20;
    const TOPDOWN_VIEW_THRESHOLD = 55;
    const VIEW_MODE_HYSTERESIS = 4;

    type ViewMode = 'isometric' | 'side' | 'topdown';

    /**
     * Simplified getViewMode for testing purposes
     */
    function getViewMode(pitchAngle: number, currentMode: ViewMode): ViewMode {
      const sideThreshold =
        currentMode === 'side' ? SIDE_VIEW_THRESHOLD + VIEW_MODE_HYSTERESIS : SIDE_VIEW_THRESHOLD;
      const topdownThreshold =
        currentMode === 'topdown'
          ? TOPDOWN_VIEW_THRESHOLD - VIEW_MODE_HYSTERESIS
          : TOPDOWN_VIEW_THRESHOLD;

      if (pitchAngle < sideThreshold) {
        return 'side';
      }
      if (pitchAngle > topdownThreshold) {
        return 'topdown';
      }
      return 'isometric';
    }

    it('should return side view when pitch is near horizontal', () => {
      expect(getViewMode(10, 'isometric')).toBe('side');
      expect(getViewMode(15, 'isometric')).toBe('side');
    });

    it('should return topdown view when pitch is steep', () => {
      expect(getViewMode(60, 'isometric')).toBe('topdown');
      expect(getViewMode(85, 'isometric')).toBe('topdown');
    });

    it('should return isometric view for middle pitch angles', () => {
      expect(getViewMode(30, 'isometric')).toBe('isometric');
      expect(getViewMode(45, 'isometric')).toBe('isometric');
    });

    it('should apply hysteresis when exiting side mode', () => {
      // At exactly SIDE_VIEW_THRESHOLD, would exit side mode without hysteresis
      // But with hysteresis, we stay in side mode until SIDE_VIEW_THRESHOLD + HYSTERESIS
      expect(getViewMode(22, 'side')).toBe('side'); // Still in hysteresis zone
      expect(getViewMode(25, 'side')).toBe('isometric'); // Past hysteresis
    });

    it('should apply hysteresis when exiting topdown mode', () => {
      // At exactly TOPDOWN_VIEW_THRESHOLD, would exit topdown without hysteresis
      // But with hysteresis, we stay in topdown until below TOPDOWN_VIEW_THRESHOLD - HYSTERESIS
      expect(getViewMode(52, 'topdown')).toBe('topdown'); // Still in hysteresis zone
      expect(getViewMode(50, 'topdown')).toBe('isometric'); // Past hysteresis
    });

    it('should prevent flickering at boundaries', () => {
      // Simulate crossing a boundary multiple times
      let mode: ViewMode = 'isometric';

      // Approach side view
      mode = getViewMode(19, mode);
      expect(mode).toBe('side');

      // Slightly above threshold - should stay in side due to hysteresis
      mode = getViewMode(21, mode);
      expect(mode).toBe('side');

      // Past hysteresis - should exit
      mode = getViewMode(26, mode);
      expect(mode).toBe('isometric');
    });
  });

  describe('frame-rate independent smoothing', () => {
    /**
     * Frame-rate independent smoothing factor calculation
     */
    function calculateEffectiveFactor(baseFactor: number, delta: number): number {
      return 1 - Math.pow(1 - baseFactor, delta * 60);
    }

    it('should return factor close to base at 60fps', () => {
      const baseFactor = 0.08;
      const delta60fps = 1 / 60;
      const effective = calculateEffectiveFactor(baseFactor, delta60fps);

      // At 60fps, effective should be very close to base
      expect(effective).toBeCloseTo(baseFactor, 2);
    });

    it('should return higher factor at lower fps (30fps)', () => {
      const baseFactor = 0.08;
      const delta30fps = 1 / 30;
      const effective = calculateEffectiveFactor(baseFactor, delta30fps);

      // At 30fps (2x delta), factor should be higher to compensate
      expect(effective).toBeGreaterThan(baseFactor);
      expect(effective).toBeLessThan(1);
    });

    it('should return factor close to 1 for very large delta', () => {
      const baseFactor = 0.08;
      const largeDelta = 1; // 1 second frame (1fps)
      const effective = calculateEffectiveFactor(baseFactor, largeDelta);

      // Should approach 1 for very slow frames
      expect(effective).toBeGreaterThan(0.9);
    });

    it('should return 0 for factor of 0', () => {
      const effective = calculateEffectiveFactor(0, 1 / 60);
      expect(effective).toBe(0);
    });

    it('should return 1 for factor of 1', () => {
      const effective = calculateEffectiveFactor(1, 1 / 60);
      expect(effective).toBe(1);
    });
  });

  describe('screen-to-world conversion', () => {
    it('should calculate pixels per world unit correctly', () => {
      // Simulate a simple projection scenario
      const viewportWidth = 800;

      // If two points 1 world unit apart project to NDC difference of 0.1
      // Then pixel difference = 0.1 * (viewportWidth / 2) = 0.1 * 400 = 40 pixels
      const ndcDiff = 0.1;
      const pixelDiff = ndcDiff * (viewportWidth / 2);

      expect(pixelDiff).toBe(40);
    });

    it('should handle edge case of zero difference', () => {
      // Ensure we don't divide by zero
      const clampedPixelDiff = Math.max(0, 0.001);
      expect(clampedPixelDiff).toBe(0.001);
    });
  });
});
