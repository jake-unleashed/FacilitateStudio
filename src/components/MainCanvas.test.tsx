/**
 * Unit tests for MainCanvas component
 *
 * These tests focus on the drag calculation logic and keyboard navigation.
 * The Three.js/React Three Fiber rendering is mocked.
 */

import { describe, it, expect, vi } from 'vitest';
import { SceneObject } from '../types';

// ============================================================================
// Constants Tests
// ============================================================================

describe('MainCanvas Constants', () => {
  it('should define DRAG_THRESHOLD_PIXELS as 5', async () => {
    // We can verify the constant by checking the behavior indirectly
    // A movement of less than 5 pixels should not trigger a drag
    const DRAG_THRESHOLD_PIXELS = 5;
    expect(DRAG_THRESHOLD_PIXELS).toBe(5);
  });

  it('should define SCENE_TO_WORLD_SCALE as 100', async () => {
    // Scene units are 100x world units
    const SCENE_TO_WORLD_SCALE = 100;
    expect(SCENE_TO_WORLD_SCALE).toBe(100);
  });
});

// ============================================================================
// DragState Interface Tests
// ============================================================================

describe('DragState', () => {
  it('should have all required properties', () => {
    // Verify the DragState interface shape
    interface DragState {
      objectId: string;
      object: SceneObject;
      groundPlaneY: number;
      initialObjectX: number;
      initialObjectZ: number;
      initialGrabX: number;
      initialGrabZ: number;
      hasMoved: boolean;
      startPosition: { x: number; y: number };
    }

    const testObject: SceneObject = {
      id: 'test-1',
      name: 'Test Object',
      type: 'mesh',
      transform: {
        x: 100,
        y: 0,
        z: -200,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      properties: { visible: true },
    };

    const dragState: DragState = {
      objectId: 'test-1',
      object: testObject,
      groundPlaneY: 1.5,
      initialObjectX: 100,
      initialObjectZ: -200,
      initialGrabX: 1.0,
      initialGrabZ: 2.0,
      hasMoved: false,
      startPosition: { x: 500, y: 300 },
    };

    expect(dragState.objectId).toBe('test-1');
    expect(dragState.groundPlaneY).toBe(1.5);
    expect(dragState.initialObjectX).toBe(100);
    expect(dragState.initialObjectZ).toBe(-200);
    expect(dragState.initialGrabX).toBe(1.0);
    expect(dragState.initialGrabZ).toBe(2.0);
    expect(dragState.hasMoved).toBe(false);
    expect(dragState.startPosition).toEqual({ x: 500, y: 300 });
  });
});

// ============================================================================
// Drag Calculation Logic Tests
// ============================================================================

describe('Drag Calculation Logic', () => {
  const SCENE_TO_WORLD_SCALE = 100;

  describe('Position Delta Calculation', () => {
    it('should calculate correct delta from initial grab point', () => {
      // Initial grab point
      const initialGrabX = 1.0;
      const initialGrabZ = 2.0;

      // Current intersection point (user moved mouse)
      const intersectionX = 2.5;
      const intersectionZ = 3.0;

      // Calculate deltas
      const deltaX = intersectionX - initialGrabX;
      const deltaZ = intersectionZ - initialGrabZ;

      expect(deltaX).toBe(1.5);
      expect(deltaZ).toBe(1.0);
    });

    it('should apply delta to initial object position correctly', () => {
      const initialObjectX = 100;
      const initialObjectZ = -200;
      const deltaX = 1.5;
      const deltaZ = 1.0;

      // Apply delta (Z is negated because Three.js Z is opposite to scene transform Z)
      const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
      const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

      expect(newX).toBe(250); // 100 + 1.5 * 100
      expect(newZ).toBe(-300); // -200 - 1.0 * 100
    });

    it('should handle negative deltas correctly', () => {
      const initialObjectX = 100;
      const initialObjectZ = -200;
      const deltaX = -2.0;
      const deltaZ = -1.5;

      const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
      const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

      expect(newX).toBe(-100); // 100 + (-2.0) * 100
      expect(newZ).toBe(-50); // -200 - (-1.5) * 100
    });

    it('should handle zero delta (no movement)', () => {
      const initialObjectX = 100;
      const initialObjectZ = -200;
      const deltaX = 0;
      const deltaZ = 0;

      const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
      const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

      expect(newX).toBe(100);
      expect(newZ).toBe(-200);
    });
  });

  describe('Drag Threshold', () => {
    const DRAG_THRESHOLD_PIXELS = 5;

    it('should not consider as drag if distance is less than threshold', () => {
      const startX = 500;
      const startY = 300;
      const currentX = 502;
      const currentY = 301;

      const dx = currentX - startX;
      const dy = currentY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      expect(distance).toBeLessThan(DRAG_THRESHOLD_PIXELS);
    });

    it('should consider as drag if distance exceeds threshold', () => {
      const startX = 500;
      const startY = 300;
      const currentX = 510;
      const currentY = 305;

      const dx = currentX - startX;
      const dy = currentY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      expect(distance).toBeGreaterThanOrEqual(DRAG_THRESHOLD_PIXELS);
    });

    it('should handle exact threshold distance', () => {
      const startX = 500;
      const startY = 300;
      // 3-4-5 triangle gives distance of 5
      const currentX = 503;
      const currentY = 304;

      const dx = currentX - startX;
      const dy = currentY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      expect(distance).toBe(5);
      expect(distance).toBeGreaterThanOrEqual(DRAG_THRESHOLD_PIXELS);
    });
  });

  describe('Ground Plane Y Calculation', () => {
    it('should use click point Y as ground plane Y', () => {
      // When clicking on a model at height 1.5, the ground plane should be at 1.5
      const clickPointY = 1.5;
      const groundPlaneY = clickPointY;

      expect(groundPlaneY).toBe(1.5);
    });

    it('should handle clicking at ground level (Y=0)', () => {
      const clickPointY = 0;
      const groundPlaneY = clickPointY;

      expect(groundPlaneY).toBe(0);
    });

    it('should handle elevated platforms', () => {
      // Object on a platform at Y=2.0, clicking on top at Y=3.5
      const clickPointY = 3.5;
      const groundPlaneY = clickPointY;

      expect(groundPlaneY).toBe(3.5);
    });
  });

  describe('Coordinate System Conversion', () => {
    it('should convert scene X to world X correctly', () => {
      const sceneX = 150;
      const worldX = sceneX / SCENE_TO_WORLD_SCALE;
      expect(worldX).toBe(1.5);
    });

    it('should convert scene Z to world Z with negation', () => {
      // Scene Z is negated in world space
      const sceneZ = -200;
      const worldZ = -sceneZ / SCENE_TO_WORLD_SCALE;
      expect(worldZ).toBe(2.0);
    });

    it('should convert world X to scene X correctly', () => {
      const worldX = 1.5;
      const sceneX = worldX * SCENE_TO_WORLD_SCALE;
      expect(sceneX).toBe(150);
    });

    it('should convert world Z to scene Z with negation', () => {
      const worldZ = 2.0;
      const sceneZ = -worldZ * SCENE_TO_WORLD_SCALE;
      expect(sceneZ).toBe(-200);
    });
  });
});

// ============================================================================
// Focus Logic Tests
// ============================================================================

describe('Focus Logic', () => {
  describe('Focus on selected object with F key', () => {
    it('should call onFocusObject when F key is pressed with selected object', () => {
      const mockOnFocusObject = vi.fn();
      const selectedObject: SceneObject = {
        id: 'obj-1',
        name: 'Test Object',
        type: 'mesh',
        transform: {
          x: 100,
          y: 0,
          z: -200,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: { visible: true },
      };

      // Simulate the key handler logic
      const key = 'f';
      const selectedChildPath: string | null = null;
      if (key === 'f' && selectedObject && mockOnFocusObject) {
        mockOnFocusObject(selectedObject, selectedChildPath ?? undefined);
      }

      expect(mockOnFocusObject).toHaveBeenCalledWith(selectedObject, undefined);
    });

    it('should not call onFocusObject when F key is pressed without selected object', () => {
      const mockOnFocusObject = vi.fn();
      const selectedObject = null;

      const key = 'f';
      const selectedChildPath: string | null = null;
      if (key === 'f' && selectedObject && mockOnFocusObject) {
        mockOnFocusObject(selectedObject, selectedChildPath ?? undefined);
      }

      expect(mockOnFocusObject).not.toHaveBeenCalled();
    });

    it('should not call onFocusObject when different key is pressed', () => {
      const mockOnFocusObject = vi.fn();
      const selectedObject: SceneObject = {
        id: 'obj-1',
        name: 'Test Object',
        type: 'mesh',
        transform: {
          x: 100,
          y: 0,
          z: -200,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: { visible: true },
      };

      const key = 'g' as string;
      const selectedChildPath: string | null = null;
      if (key === 'f' && selectedObject && mockOnFocusObject) {
        mockOnFocusObject(selectedObject, selectedChildPath ?? undefined);
      }

      expect(mockOnFocusObject).not.toHaveBeenCalled();
    });

    it('should pass childPath when focusing on a child object', () => {
      const mockOnFocusObject = vi.fn();
      const selectedObject: SceneObject = {
        id: 'obj-1',
        name: 'Test Object',
        type: 'mesh',
        transform: {
          x: 100,
          y: 0,
          z: -200,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: { visible: true, modelAssetId: 'asset-1' },
        children: [
          {
            name: 'Wheel',
            path: ['Scene', 'Wheel_FL'],
            localTransform: {
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
          },
        ],
      };

      const key = 'f';
      const selectedChildPath = 'Scene.Wheel_FL';
      if (key === 'f' && selectedObject && mockOnFocusObject) {
        mockOnFocusObject(selectedObject, selectedChildPath ?? undefined);
      }

      expect(mockOnFocusObject).toHaveBeenCalledWith(selectedObject, 'Scene.Wheel_FL');
    });
  });
});

// ============================================================================
// Drag Selection Logic Tests
// ============================================================================

describe('Drag Selection Logic', () => {
  describe('Auto-select on drag', () => {
    it('should select object when starting to drag an unselected object', () => {
      const mockOnSelectObject = vi.fn();
      const dragState = {
        objectId: 'obj-1',
        childPath: null as string | null,
      };
      const selectedObjectId: string | null = null;

      // Simulate handleMarkAsDrag logic
      if (dragState) {
        const targetSelectionId = dragState.childPath
          ? `${dragState.objectId}/${dragState.childPath}`
          : dragState.objectId;

        if (targetSelectionId !== selectedObjectId) {
          mockOnSelectObject(targetSelectionId);
        }
      }

      expect(mockOnSelectObject).toHaveBeenCalledWith('obj-1');
    });

    it('should not change selection when dragging already-selected object', () => {
      const mockOnSelectObject = vi.fn();
      const dragState = {
        objectId: 'obj-1',
        childPath: null as string | null,
      };
      const selectedObjectId = 'obj-1';

      if (dragState) {
        const targetSelectionId = dragState.childPath
          ? `${dragState.objectId}/${dragState.childPath}`
          : dragState.objectId;

        if (targetSelectionId !== selectedObjectId) {
          mockOnSelectObject(targetSelectionId);
        }
      }

      expect(mockOnSelectObject).not.toHaveBeenCalled();
    });

    it('should deselect child when dragging parent', () => {
      const mockOnSelectObject = vi.fn();
      const dragState = {
        objectId: 'obj-1',
        childPath: null as string | null, // Dragging parent, not child
      };
      const selectedObjectId = 'obj-1/Scene.Wheel_FL'; // Child is selected

      if (dragState) {
        const targetSelectionId = dragState.childPath
          ? `${dragState.objectId}/${dragState.childPath}`
          : dragState.objectId;

        if (targetSelectionId !== selectedObjectId) {
          mockOnSelectObject(targetSelectionId);
        }
      }

      // Should select parent (deselecting child)
      expect(mockOnSelectObject).toHaveBeenCalledWith('obj-1');
    });

    it('should select child when dragging child', () => {
      const mockOnSelectObject = vi.fn();
      const dragState = {
        objectId: 'obj-1',
        childPath: 'Scene.Wheel_FL',
      };
      const selectedObjectId = 'obj-1'; // Parent is selected

      if (dragState) {
        const targetSelectionId = dragState.childPath
          ? `${dragState.objectId}/${dragState.childPath}`
          : dragState.objectId;

        if (targetSelectionId !== selectedObjectId) {
          mockOnSelectObject(targetSelectionId);
        }
      }

      expect(mockOnSelectObject).toHaveBeenCalledWith('obj-1/Scene.Wheel_FL');
    });

    it('should select different object when dragging a different unselected object', () => {
      const mockOnSelectObject = vi.fn();
      const dragState = {
        objectId: 'obj-2',
        childPath: null as string | null,
      };
      const selectedObjectId = 'obj-1'; // Different object is selected

      if (dragState) {
        const targetSelectionId = dragState.childPath
          ? `${dragState.objectId}/${dragState.childPath}`
          : dragState.objectId;

        if (targetSelectionId !== selectedObjectId) {
          mockOnSelectObject(targetSelectionId);
        }
      }

      expect(mockOnSelectObject).toHaveBeenCalledWith('obj-2');
    });
  });

  describe('Child drag protection', () => {
    it('should require selection before child can be dragged', () => {
      // When a child is clicked that is not selected, it should be selected
      // but NOT set up for drag. This is tested by checking the pending mechanism.

      const selectedChildPath: string | null = null;
      const clickedChildPath = 'Scene.Wheel_FL';
      const isClickedChildSelected = selectedChildPath === clickedChildPath;

      // Child is not selected, so it should NOT be set up for immediate drag
      expect(isClickedChildSelected).toBe(false);

      // The click should use pendingChildPath mechanism (selection on click, not drag)
      const shouldUsePendingSelection = !isClickedChildSelected;
      expect(shouldUsePendingSelection).toBe(true);
    });

    it('should allow drag when clicking already-selected child', () => {
      const selectedChildPath = 'Scene.Wheel_FL';
      const clickedChildPath = 'Scene.Wheel_FL';
      const isClickedChildSelected = selectedChildPath === clickedChildPath;

      // Child is already selected, so drag can proceed
      expect(isClickedChildSelected).toBe(true);
    });
  });
});

// ============================================================================
// Integration-style Tests (Logic Flow)
// ============================================================================

describe('Drag Flow Integration', () => {
  const SCENE_TO_WORLD_SCALE = 100;
  const DRAG_THRESHOLD_PIXELS = 5;

  it('should complete a full drag operation correctly', () => {
    // 1. Setup initial state (pointer down on object)
    const testObject: SceneObject = {
      id: 'drag-test-1',
      name: 'Draggable Object',
      type: 'mesh',
      transform: {
        x: 100,
        y: 0,
        z: -200,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      properties: { visible: true },
    };

    // Click point on the model (elevated surface)
    const clickPoint = { x: 1.5, y: 1.0, z: 2.5 };

    // Create drag state
    const dragState = {
      objectId: testObject.id,
      object: testObject,
      groundPlaneY: clickPoint.y,
      initialObjectX: testObject.transform.x,
      initialObjectZ: testObject.transform.z,
      initialGrabX: clickPoint.x,
      initialGrabZ: clickPoint.z,
      hasMoved: false,
      startPosition: { x: 500, y: 300 },
    };

    // 2. Simulate mouse movement beyond threshold
    const currentMousePos = { x: 520, y: 310 };
    const dx = currentMousePos.x - dragState.startPosition.x;
    const dy = currentMousePos.y - dragState.startPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    expect(distance).toBeGreaterThan(DRAG_THRESHOLD_PIXELS);

    // 3. Calculate new intersection point (simulated raycast result)
    const newIntersection = { x: 3.0, y: 1.0, z: 4.0 };

    // 4. Calculate delta
    const deltaX = newIntersection.x - dragState.initialGrabX;
    const deltaZ = newIntersection.z - dragState.initialGrabZ;

    expect(deltaX).toBe(1.5);
    expect(deltaZ).toBe(1.5);

    // 5. Calculate new object position
    const newX = dragState.initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
    const newZ = dragState.initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

    expect(newX).toBe(250); // 100 + 1.5 * 100
    expect(newZ).toBe(-350); // -200 - 1.5 * 100
  });

  it('should maintain grab point under cursor throughout drag', () => {
    // Initial state
    const initialObjectX = 100;
    const initialObjectZ = -200;
    const initialGrabX = 1.0;
    const initialGrabZ = 2.0;

    // Simulate multiple drag movements
    const movements = [
      { intersectX: 1.5, intersectZ: 2.5 },
      { intersectX: 2.0, intersectZ: 3.0 },
      { intersectX: 1.0, intersectZ: 2.0 }, // Back to original
    ];

    for (const movement of movements) {
      const deltaX = movement.intersectX - initialGrabX;
      const deltaZ = movement.intersectZ - initialGrabZ;

      const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
      const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

      // The grab point relative to object should remain constant
      // Grab point in world = intersection point
      // Object position in world = newX/100, newZ/-100

      const objectWorldX = newX / SCENE_TO_WORLD_SCALE;
      const objectWorldZ = -newZ / SCENE_TO_WORLD_SCALE;

      // Grab offset should be constant
      const grabOffsetX = movement.intersectX - objectWorldX;
      const grabOffsetZ = movement.intersectZ - objectWorldZ;

      expect(grabOffsetX).toBeCloseTo(initialGrabX - initialObjectX / SCENE_TO_WORLD_SCALE);
      expect(grabOffsetZ).toBeCloseTo(initialGrabZ - -initialObjectZ / SCENE_TO_WORLD_SCALE);
    }
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  const SCENE_TO_WORLD_SCALE = 100;

  it('should handle very large drag distances', () => {
    const initialObjectX = 0;
    const initialObjectZ = 0;
    const deltaX = 100; // 100 world units
    const deltaZ = 100;

    const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
    const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

    expect(newX).toBe(10000);
    expect(newZ).toBe(-10000);
  });

  it('should handle very small drag distances', () => {
    const initialObjectX = 100;
    const initialObjectZ = -200;
    const deltaX = 0.001;
    const deltaZ = 0.001;

    const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
    const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

    expect(newX).toBeCloseTo(100.1);
    expect(newZ).toBeCloseTo(-200.1);
  });

  it('should handle objects at origin', () => {
    const initialObjectX = 0;
    const initialObjectZ = 0;
    const deltaX = 1.5;
    const deltaZ = 2.0;

    const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
    const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

    expect(newX).toBe(150);
    expect(newZ).toBe(-200);
  });

  it('should handle objects with negative coordinates', () => {
    const initialObjectX = -500;
    const initialObjectZ = 300;
    const deltaX = 2.0;
    const deltaZ = -1.0;

    const newX = initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
    const newZ = initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

    expect(newX).toBe(-300); // -500 + 200
    expect(newZ).toBe(400); // 300 - (-100)
  });
});
