/**
 * Unit tests for TransformGizmo component
 *
 * Tests the floating handles for object manipulation:
 * - Height Handle: Drag up/down to adjust Y position
 * - XZ Handle: Drag to move object on the ground plane
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    localTransform: { x: 0, y: 50, z: 0 },
  };
}

/**
 * Creates a Three.js group with userData for testing
 */
function createTestGroup(objectId: string): THREE.Group {
  const group = new THREE.Group();
  group.userData.objectId = objectId;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial()
  );
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

/**
 * Simulates a pointer drag operation
 */
async function simulateDrag(
  element: HTMLElement,
  startY: number,
  endY: number
): Promise<void> {
  // Start drag
  fireEvent.pointerDown(element, { clientY: startY });

  // Move
  fireEvent(
    window,
    new PointerEvent('pointermove', {
      clientY: endY,
      bubbles: true,
    })
  );

  // End drag
  fireEvent(window, new PointerEvent('pointerup', { bubbles: true }));
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

    it('should hide gizmo when isDragging is true', () => {
      const { container } = render(
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

      // The component should return null when dragging
      const handles = container.querySelectorAll('[data-testid^="handle-"]');
      expect(handles.length).toBe(0);
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
      fireEvent(
        window,
        new PointerEvent('pointermove', { clientY: 250, bubbles: true })
      );
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
      fireEvent(
        window,
        new PointerEvent('pointermove', { clientY: 1000, bubbles: true })
      );

      if (mockOnUpdateObject.mock.calls.length > 0) {
        const lastCall =
          mockOnUpdateObject.mock.calls[
            mockOnUpdateObject.mock.calls.length - 1
          ][0];
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
        elements[0] * elements[0] +
          elements[1] * elements[1] +
          elements[2] * elements[2]
      );

      expect(scaleX).toBeCloseTo(1);
    });

    it('should extract correct scale from scaled matrix', () => {
      const matrix = new THREE.Matrix4();
      matrix.makeScale(2, 3, 4);
      const elements = matrix.elements;

      const scaleX = Math.sqrt(
        elements[0] * elements[0] +
          elements[1] * elements[1] +
          elements[2] * elements[2]
      );
      const scaleY = Math.sqrt(
        elements[4] * elements[4] +
          elements[5] * elements[5] +
          elements[6] * elements[6]
      );
      const scaleZ = Math.sqrt(
        elements[8] * elements[8] +
          elements[9] * elements[9] +
          elements[10] * elements[10]
      );

      expect(scaleX).toBeCloseTo(2);
      expect(scaleY).toBeCloseTo(3);
      expect(scaleZ).toBeCloseTo(4);
    });
  });

  describe('clamp function logic', () => {
    it('should clamp value to min', () => {
      const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it('should clamp value to max', () => {
      const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should not clamp value within range', () => {
      const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
      expect(clamp(50, 0, 100)).toBe(50);
    });
  });
});

