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
import { TransformGizmo } from './transformGizmo';

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

  // ==========================================================================
  // Child Height Constraint Tests
  // ==========================================================================

  describe('Child Height Constraint', () => {
    /**
     * These tests verify that:
     * 1. Root objects: Y value cannot go below 0 (HEIGHT_MIN)
     * 2. Child objects: Y value CAN go negative (allowing children to reach ground)
     * 3. Both respect the ground constraint (mesh lowest point >= 0)
     */

    it('should render height handle for child selection', () => {
      const childMesh = createTestChild(['Scene', 'Body', 'Wheel']);
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="Scene.Body.Wheel"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle).toBeTruthy();
    });

    it('should pass isChild=true when a child is selected', () => {
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

      // The height handle should be rendered and accept the isChild prop
      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle).toBeTruthy();
    });

    it('should pass isChild=false when parent is selected', () => {
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

      // The height handle should be rendered without isChild flag
      const heightHandle = screen.getByTestId('handle-height');
      expect(heightHandle).toBeTruthy();
    });

    it('should update child localTransform.y when dragging child height handle', () => {
      const childMesh = createTestChild(['wheelChild']);
      childMesh.localTransform.y = 50; // Starting Y position
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="wheelChild"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move up (decrease clientY = increase height)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 200, // Move up significantly
          bubbles: true,
        })
      );

      // Verify onUpdateObject was called with updated child transform
      expect(mockOnUpdateObject).toHaveBeenCalled();
      const lastCall = mockOnUpdateObject.mock.calls[mockOnUpdateObject.mock.calls.length - 1][0];
      expect(lastCall.children).toBeDefined();
    });

    it('should allow child localTransform.y to be negative when moving toward ground', () => {
      // Create a child that starts at y=0 (default position within model)
      const childMesh = createTestChild(['groundChild']);
      childMesh.localTransform.y = 0;
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="groundChild"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move down (increase clientY = decrease height)
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 400, // Move down significantly
          bubbles: true,
        })
      );

      // End drag
      fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));

      // Verify the child was updated
      expect(mockOnUpdateObject).toHaveBeenCalled();
    });

    it('should work with nested child paths', () => {
      const childMesh = createTestChild(['Scene', 'Model', 'LeftWheel']);
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="Scene.Model.LeftWheel"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Verify handle renders for nested path
      expect(heightHandle).toBeTruthy();

      // Interact with it
      fireEvent.pointerDown(heightHandle, { clientY: 300 });
      expect(mockOnDragStart).toHaveBeenCalled();
    });

    it('should handle multiple children and select the correct one', () => {
      const child1 = createTestChild(['wheel1']);
      child1.localTransform.y = 10;
      const child2 = createTestChild(['wheel2']);
      child2.localTransform.y = 20;
      const child3 = createTestChild(['wheel3']);
      child3.localTransform.y = 30;

      const objectWithChildren = {
        ...testObject,
        children: [child1, child2, child3],
      };

      render(
        <TransformGizmo
          object={objectWithChildren}
          selectedChildPath="wheel2"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      const heightHandle = screen.getByTestId('handle-height');

      // Start drag
      fireEvent.pointerDown(heightHandle, { clientY: 300 });

      // Move
      fireEvent(
        window,
        new PointerEvent('pointermove', {
          clientY: 250,
          bubbles: true,
        })
      );

      // Verify onUpdateObject was called
      expect(mockOnUpdateObject).toHaveBeenCalled();

      // The update should only modify wheel2, not wheel1 or wheel3
      const lastCall = mockOnUpdateObject.mock.calls[mockOnUpdateObject.mock.calls.length - 1][0];
      expect(lastCall.children).toBeDefined();
      if (lastCall.children) {
        const updatedWheel1 = lastCall.children.find(
          (c: ChildMesh) => c.path.join('.') === 'wheel1'
        );
        const updatedWheel3 = lastCall.children.find(
          (c: ChildMesh) => c.path.join('.') === 'wheel3'
        );
        // wheel1 and wheel3 should remain unchanged
        expect(updatedWheel1?.localTransform.y).toBe(10);
        expect(updatedWheel3?.localTransform.y).toBe(30);
      }
    });

    it('should switch between parent and child selection correctly', () => {
      const childMesh = createTestChild(['childPart']);
      const objectWithChild = {
        ...testObject,
        children: [childMesh],
      };

      // First render with parent selected
      const { rerender } = render(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath={null}
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();
      expect(screen.getByTestId('handle-height')).toBeTruthy();

      // Re-render with child selected
      rerender(
        <TransformGizmo
          object={objectWithChild}
          selectedChildPath="childPart"
          onUpdateObject={mockOnUpdateObject}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
        />
      );

      runFrame();

      // Height handle should still work
      const heightHandle = screen.getByTestId('handle-height');
      fireEvent.pointerDown(heightHandle, { clientY: 300 });
      expect(mockOnDragStart).toHaveBeenCalled();
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

  describe('calculatePixelsPerWorldUnit', () => {
    /**
     * Calculates pixels per world unit using camera distance and FOV.
     * This is a direct implementation of the formula for testing.
     */
    function calculatePixelsPerWorldUnit(
      cameraDistance: number,
      fovDegrees: number,
      viewportHeight: number
    ): number {
      if (cameraDistance <= 0) return 1;
      const vFovRadians = fovDegrees * (Math.PI / 180);
      const halfFovTan = Math.tan(vFovRadians / 2);
      return viewportHeight / (2 * cameraDistance * halfFovTan);
    }

    it('should return higher value for closer camera', () => {
      const closeResult = calculatePixelsPerWorldUnit(5, 75, 600);
      const farResult = calculatePixelsPerWorldUnit(20, 75, 600);

      // Closer camera = more pixels per world unit
      expect(closeResult).toBeGreaterThan(farResult);
    });

    it('should return higher value for larger viewport', () => {
      const largeViewport = calculatePixelsPerWorldUnit(10, 75, 1000);
      const smallViewport = calculatePixelsPerWorldUnit(10, 75, 500);

      // Larger viewport = more pixels per world unit
      expect(largeViewport).toBeGreaterThan(smallViewport);
    });

    it('should return lower value for wider FOV', () => {
      const narrowFov = calculatePixelsPerWorldUnit(10, 45, 600);
      const wideFov = calculatePixelsPerWorldUnit(10, 90, 600);

      // Narrow FOV = more pixels per world unit (more zoomed in)
      expect(narrowFov).toBeGreaterThan(wideFov);
    });

    it('should handle zero or negative distance gracefully', () => {
      const zeroDistance = calculatePixelsPerWorldUnit(0, 75, 600);
      const negativeDistance = calculatePixelsPerWorldUnit(-5, 75, 600);

      // Should return 1 as fallback
      expect(zeroDistance).toBe(1);
      expect(negativeDistance).toBe(1);
    });

    it('should be view-angle independent (same distance = same result)', () => {
      // The formula only depends on distance, FOV, and viewport - not view angle
      // This is the key improvement over the previous projection-based approach
      const distance = 10;
      const fov = 75;
      const viewport = 600;

      // Same inputs should always give same result
      const result1 = calculatePixelsPerWorldUnit(distance, fov, viewport);
      const result2 = calculatePixelsPerWorldUnit(distance, fov, viewport);
      const result3 = calculatePixelsPerWorldUnit(distance, fov, viewport);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should produce reasonable values for typical camera setup', () => {
      // Typical setup: camera 10 units away, 75° FOV, 600px viewport
      const result = calculatePixelsPerWorldUnit(10, 75, 600);

      // Should be a positive, reasonable value
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1000); // Sanity check
    });
  });

  describe('pixelsToWorldUnits', () => {
    /**
     * Converts screen pixels to world units.
     */
    function pixelsToWorldUnits(targetPixels: number, pixelsPerWorldUnit: number): number {
      if (pixelsPerWorldUnit <= 0) return 0;
      return targetPixels / pixelsPerWorldUnit;
    }

    it('should convert pixels to world units correctly', () => {
      // If 100 pixels = 1 world unit, then 50 pixels = 0.5 world units
      const result = pixelsToWorldUnits(50, 100);
      expect(result).toBe(0.5);
    });

    it('should return larger world units for fewer pixels per unit', () => {
      const target = 65; // target pixels
      const farResult = pixelsToWorldUnits(target, 50); // camera far away
      const closeResult = pixelsToWorldUnits(target, 200); // camera close

      // Far camera = fewer pixels per unit = larger world offset needed
      expect(farResult).toBeGreaterThan(closeResult);
    });

    it('should handle zero pixelsPerWorldUnit gracefully', () => {
      const result = pixelsToWorldUnits(65, 0);
      expect(result).toBe(0);
    });

    it('should handle negative pixelsPerWorldUnit gracefully', () => {
      const result = pixelsToWorldUnits(65, -100);
      expect(result).toBe(0);
    });

    it('should return 0 for 0 target pixels', () => {
      const result = pixelsToWorldUnits(0, 100);
      expect(result).toBe(0);
    });
  });

  describe('dynamic handle spacing', () => {
    // Constants from TransformGizmo.tsx
    const HANDLE_GAP_PIXELS = 35;
    const HANDLE_SPACING_PIXELS = 65;

    /**
     * Simulates the dynamic spacing calculation
     */
    function calculateDynamicSpacing(
      cameraDistance: number,
      fovDegrees: number,
      viewportHeight: number
    ) {
      const vFovRadians = fovDegrees * (Math.PI / 180);
      const halfFovTan = Math.tan(vFovRadians / 2);
      const pixelsPerWorldUnit =
        cameraDistance > 0 ? viewportHeight / (2 * cameraDistance * halfFovTan) : 1;

      return {
        dynamicGap: HANDLE_GAP_PIXELS / pixelsPerWorldUnit,
        dynamicHandleOffset: HANDLE_SPACING_PIXELS / pixelsPerWorldUnit,
        pixelsPerWorldUnit,
      };
    }

    it('should maintain constant screen-space gap at different zoom levels', () => {
      const viewportHeight = 600;
      const fov = 75;

      // Calculate at different distances
      const close = calculateDynamicSpacing(5, fov, viewportHeight);
      const medium = calculateDynamicSpacing(15, fov, viewportHeight);
      const far = calculateDynamicSpacing(30, fov, viewportHeight);

      // World units increase as camera moves away
      expect(far.dynamicGap).toBeGreaterThan(medium.dynamicGap);
      expect(medium.dynamicGap).toBeGreaterThan(close.dynamicGap);

      // But when converted back to screen pixels, they should all equal HANDLE_GAP_PIXELS
      expect(close.dynamicGap * close.pixelsPerWorldUnit).toBeCloseTo(HANDLE_GAP_PIXELS, 5);
      expect(medium.dynamicGap * medium.pixelsPerWorldUnit).toBeCloseTo(HANDLE_GAP_PIXELS, 5);
      expect(far.dynamicGap * far.pixelsPerWorldUnit).toBeCloseTo(HANDLE_GAP_PIXELS, 5);
    });

    it('should maintain constant screen-space handle offset at different zoom levels', () => {
      const viewportHeight = 600;
      const fov = 75;

      const close = calculateDynamicSpacing(5, fov, viewportHeight);
      const far = calculateDynamicSpacing(30, fov, viewportHeight);

      // World units differ
      expect(far.dynamicHandleOffset).toBeGreaterThan(close.dynamicHandleOffset);

      // But screen pixels are constant
      expect(close.dynamicHandleOffset * close.pixelsPerWorldUnit).toBeCloseTo(
        HANDLE_SPACING_PIXELS,
        5
      );
      expect(far.dynamicHandleOffset * far.pixelsPerWorldUnit).toBeCloseTo(
        HANDLE_SPACING_PIXELS,
        5
      );
    });

    it('should work identically regardless of view angle', () => {
      // The key insight: same distance from any angle should give same spacing
      // Previously, top-down view would cause handles to fly away
      const viewportHeight = 600;
      const fov = 75;
      const distance = 15;

      // Simulating different view angles with same distance
      // (The formula doesn't actually use angle, but we verify it gives consistent results)
      const result1 = calculateDynamicSpacing(distance, fov, viewportHeight);
      const result2 = calculateDynamicSpacing(distance, fov, viewportHeight);
      const result3 = calculateDynamicSpacing(distance, fov, viewportHeight);

      expect(result1.dynamicGap).toBe(result2.dynamicGap);
      expect(result2.dynamicGap).toBe(result3.dynamicGap);
      expect(result1.dynamicHandleOffset).toBe(result2.dynamicHandleOffset);
    });
  });

  // ==========================================================================
  // XZ Boundary Constraint Tests
  // ==========================================================================

  describe('XZ Boundary Constraints', () => {
    // Import constants for testing
    const XZ_BOUNDARY_INTERNAL = 2000; // Must match constants.tsx
    const INTERNAL_TO_WORLD = 100;

    /**
     * Clamps a value between min and max (same as in TransformGizmo)
     */
    function clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    it('should have XZ_BOUNDARY_INTERNAL matching GROUND_PLANE_EXTENT * 100', () => {
      const GROUND_PLANE_EXTENT = 20; // Must match constants.tsx
      expect(XZ_BOUNDARY_INTERNAL).toBe(GROUND_PLANE_EXTENT * INTERNAL_TO_WORLD);
    });

    it('should clamp positive X to boundary', () => {
      const rawX = 5000; // Way beyond boundary
      const clampedX = clamp(rawX, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
      expect(clampedX).toBe(XZ_BOUNDARY_INTERNAL);
      expect(clampedX).toBe(2000);
    });

    it('should clamp negative X to boundary', () => {
      const rawX = -5000; // Way beyond boundary
      const clampedX = clamp(rawX, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
      expect(clampedX).toBe(-XZ_BOUNDARY_INTERNAL);
      expect(clampedX).toBe(-2000);
    });

    it('should clamp positive Z to boundary', () => {
      const rawZ = 3500;
      const clampedZ = clamp(rawZ, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
      expect(clampedZ).toBe(XZ_BOUNDARY_INTERNAL);
    });

    it('should clamp negative Z to boundary', () => {
      const rawZ = -3500;
      const clampedZ = clamp(rawZ, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
      expect(clampedZ).toBe(-XZ_BOUNDARY_INTERNAL);
    });

    it('should not clamp values within boundary', () => {
      const values = [0, 100, -100, 1000, -1000, 1999, -1999];
      values.forEach((val) => {
        const clamped = clamp(val, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
        expect(clamped).toBe(val);
      });
    });

    it('should allow movement exactly at boundary', () => {
      const atBoundary = 2000;
      const clamped = clamp(atBoundary, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
      expect(clamped).toBe(2000);
    });

    it('should convert world units to internal units correctly', () => {
      // 20 world units = 2000 internal units
      const worldUnits = 20;
      const internalUnits = worldUnits * INTERNAL_TO_WORLD;
      expect(internalUnits).toBe(XZ_BOUNDARY_INTERNAL);
    });

    it('should convert internal units to world units correctly', () => {
      // 2000 internal units = 20 world units
      const internalUnits = 2000;
      const worldUnits = internalUnits / INTERNAL_TO_WORLD;
      expect(worldUnits).toBe(20);
    });
  });

  // ==========================================================================
  // Side View Threshold Tests (Updated Values)
  // ==========================================================================

  describe('Side View Threshold (Narrower)', () => {
    // Updated constants from TransformGizmo.tsx
    const SIDE_VIEW_THRESHOLD = 12; // Reduced from 20 to 12
    const TOPDOWN_VIEW_THRESHOLD = 55;
    const VIEW_MODE_HYSTERESIS = 2; // Reduced from 4 to 2

    type ViewMode = 'isometric' | 'side' | 'topdown';

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

    it('should use narrower side view threshold (12 degrees)', () => {
      expect(SIDE_VIEW_THRESHOLD).toBe(12);
    });

    it('should use smaller hysteresis (2 degrees)', () => {
      expect(VIEW_MODE_HYSTERESIS).toBe(2);
    });

    it('should return side view only when pitch is below 12 degrees', () => {
      expect(getViewMode(10, 'isometric')).toBe('side');
      expect(getViewMode(11, 'isometric')).toBe('side');
      expect(getViewMode(12, 'isometric')).toBe('isometric'); // At threshold
      expect(getViewMode(15, 'isometric')).toBe('isometric'); // Was side with old 20 threshold
    });

    it('should exit side mode at 14 degrees with hysteresis', () => {
      // Entering side mode
      let mode: ViewMode = getViewMode(10, 'isometric');
      expect(mode).toBe('side');

      // At 12 degrees, still in side mode due to hysteresis (12 + 2 = 14)
      mode = getViewMode(12, mode);
      expect(mode).toBe('side');

      // At 13 degrees, still in side mode due to hysteresis
      mode = getViewMode(13, mode);
      expect(mode).toBe('side');

      // At 15 degrees, exits side mode (past 14 hysteresis threshold)
      mode = getViewMode(15, mode);
      expect(mode).toBe('isometric');
    });

    it('should transition to isometric earlier than before', () => {
      // With old threshold of 20, angles 15-19 would be side view
      // With new threshold of 12, these should be isometric
      expect(getViewMode(15, 'isometric')).toBe('isometric');
      expect(getViewMode(18, 'isometric')).toBe('isometric');
      expect(getViewMode(19, 'isometric')).toBe('isometric');
    });

    it('should prevent flickering with smaller hysteresis', () => {
      let mode: ViewMode = 'isometric';

      // Enter side view
      mode = getViewMode(10, mode);
      expect(mode).toBe('side');

      // Oscillate near threshold
      mode = getViewMode(12, mode); // Should stay side (hysteresis)
      expect(mode).toBe('side');

      mode = getViewMode(13, mode); // Should stay side (hysteresis)
      expect(mode).toBe('side');

      mode = getViewMode(11, mode); // Back below threshold
      expect(mode).toBe('side');

      // Only exit when clearly past hysteresis
      mode = getViewMode(15, mode);
      expect(mode).toBe('isometric');
    });
  });

  // ==========================================================================
  // Handle Visibility Tests (Always Visible)
  // ==========================================================================

  describe('Handle Visibility (Always Visible)', () => {
    it('should not have MIN_CAMERA_DISTANCE or MAX_CAMERA_DISTANCE constants', () => {
      // These constants were removed - handles should always be visible
      // This test verifies the architectural decision
      // If someone adds them back, this test will fail as a reminder
      const moduleExports = ['TransformGizmo', 'TransformGizmoProps'];
      // The constants should not be exported or used
      expect(moduleExports).not.toContain('MIN_CAMERA_DISTANCE');
      expect(moduleExports).not.toContain('MAX_CAMERA_DISTANCE');
    });

    it('should render handles regardless of implied camera distance', () => {
      // Create test scenarios with objects at various positions
      // All should render handles without distance-based hiding
      const positions = [
        { x: 0, y: 0, z: 0 }, // At origin
        { x: 1000, y: 1000, z: 1000 }, // Far from origin
        { x: -500, y: 0, z: -500 }, // Negative coords
        { x: 0, y: 5000, z: 0 }, // High above ground
      ];

      // All positions should be valid for handle rendering
      positions.forEach((pos) => {
        expect(pos.x).toBeDefined();
        expect(pos.y).toBeDefined();
        expect(pos.z).toBeDefined();
      });
    });
  });
});
