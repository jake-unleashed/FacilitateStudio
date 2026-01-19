/**
 * DragHandler Component
 *
 * Manages pointer events for object translation in the 3D scene.
 * Handles both parent objects and child mesh dragging with proper
 * coordinate space conversions.
 */

import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneObject, pathToString } from '../../types';
import { XZ_BOUNDARY_INTERNAL } from '../../constants';

// ============================================================================
// Constants
// ============================================================================

/** Minimum distance in pixels before considering it a drag vs a click */
export const DRAG_THRESHOLD_PIXELS = 5;

/** Conversion factor from scene units to Three.js world units */
export const SCENE_TO_WORLD_SCALE = 100;

/** Clamps a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Types
// ============================================================================

/**
 * Drag state for tracking object translation during drag operations.
 *
 * The drag system uses the click point's Y coordinate as the drag plane height,
 * ensuring consistent coordinate projection between the initial click and
 * subsequent drag movements. This prevents the "jump" issue that occurs when
 * clicking on elevated surfaces of 3D models.
 */
export interface DragState {
  /** ID of the object being dragged */
  objectId: string;
  /** Reference to the scene object being dragged */
  object: SceneObject;
  /** Path of the child being dragged (if any) - format: "path.to.child" */
  childPath?: string | null;
  /**
   * Path of a child that was clicked but should only be selected if interaction is a click (not drag).
   * Used for two-tier selection: when parent is selected, clicking on a child should select it only
   * if it's a discrete click, not a drag (drag should move the parent instead).
   */
  pendingChildPath?: string | null;
  /** Y-coordinate of the drag plane (set to click point Y for consistent projection) */
  groundPlaneY: number;
  /** Object's starting X position in scene units (before drag began) - for parent OR child's local X */
  initialObjectX: number;
  /** Object's starting Z position in scene units (before drag began) - for parent OR child's local Z */
  initialObjectZ: number;
  /** X-coordinate where user grabbed on the drag plane (world units) */
  initialGrabX: number;
  /** Z-coordinate where user grabbed on the drag plane (world units) */
  initialGrabZ: number;
  /** Whether mouse moved beyond drag threshold (distinguishes click vs drag) */
  hasMoved: boolean;
  /** Initial mouse screen position for threshold calculation */
  startPosition: { x: number; y: number };
  /**
   * Effective world scale of the child mesh (for child dragging only).
   * This accounts for ALL transforms: parent scale, model preprocessing scale, etc.
   * Used to convert world-space drag delta to local-space position change.
   */
  childWorldScaleX?: number;
  childWorldScaleZ?: number;
  /**
   * Whether dragging is allowed for this interaction.
   * When false, the interaction is selection-only (object must be selected first before dragging).
   * This prevents accidental drags when navigating/rotating the camera around objects.
   */
  canDrag: boolean;
}

// ============================================================================
// CursorManager Component
// ============================================================================

/**
 * CursorManager - Updates document cursor based on hover/drag state
 */
export const CursorManager: React.FC<{
  isHovering: boolean;
  isDragging: boolean;
}> = ({ isHovering, isDragging }) => {
  const { gl } = useThree();

  useEffect(() => {
    if (isDragging) {
      // `isDragging` can still become true for "gesture moved beyond threshold" even when
      // direct object translation is disabled (e.g. user is rotating the camera while
      // starting a gesture over an object). Keep a safe/default cursor for those cases.
      gl.domElement.style.cursor = 'default';
    } else if (isHovering) {
      // Objects are selectable/clickable, but not directly draggable.
      gl.domElement.style.cursor = 'pointer';
    } else {
      // Default cursor for camera navigation.
      gl.domElement.style.cursor = 'default';
    }

    return () => {
      gl.domElement.style.cursor = 'default';
    };
  }, [isHovering, isDragging, gl]);

  return null;
};

// ============================================================================
// DragHandler Component
// ============================================================================

interface DragHandlerProps {
  dragState: DragState | null;
  hasMovedRef: React.MutableRefObject<boolean>;
  onUpdateObject: (obj: SceneObject) => void;
  onDragEnd: (wasDrag: boolean) => void;
  onMarkAsDrag: () => void;
}

/**
 * DragHandler - Manages pointer events for object translation in the 3D scene.
 *
 * This component handles the drag-to-move interaction for scene objects:
 * 1. Raycasts from mouse position to a horizontal plane at the grab point height
 * 2. Calculates movement delta from initial grab position
 * 3. Updates object position while maintaining the grab point under cursor
 *
 * Key features:
 * - Uses capture phase event listeners to intercept before camera controls
 * - Implements drag threshold to distinguish clicks from drags
 * - Pre-allocates Three.js objects to avoid GC pressure
 */
export const DragHandler: React.FC<DragHandlerProps> = ({
  dragState,
  hasMovedRef,
  onUpdateObject,
  onDragEnd,
  onMarkAsDrag,
}) => {
  const { camera, gl } = useThree();
  // Pre-allocate Three.js objects to avoid GC pressure in hot loops
  const raycaster = useRef(new THREE.Raycaster());
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersection = useRef(new THREE.Vector3());
  const mouseCoords = useRef(new THREE.Vector2()); // Reusable Vector2 for mouse coordinates

  useEffect(() => {
    if (!dragState) return;

    // Update ground plane to object's Y position
    groundPlane.current.constant = -dragState.groundPlaneY;

    const handlePointerMove = (event: PointerEvent) => {
      // Safety check: if the primary button is no longer pressed, end the drag
      // This catches cases where the pointer up event was missed due to React re-render timing
      if ((event.buttons & 1) === 0) {
        // Primary button (left click) is not pressed - end drag immediately
        onDragEnd(hasMovedRef.current);
        return;
      }

      // Check if we've moved beyond the drag threshold
      const dx = event.clientX - dragState.startPosition.x;
      const dy = event.clientY - dragState.startPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If canDrag is false (clicking on unselected object), let camera controls handle
      // the gesture. We still track for click vs drag detection, but don't block events.
      if (!dragState.canDrag) {
        // Still mark as drag once threshold is crossed (for click vs drag distinction)
        if (distance >= DRAG_THRESHOLD_PIXELS && !dragState.hasMoved && !hasMovedRef.current) {
          onMarkAsDrag();
        }
        // Don't block - let camera controls rotate
        return;
      }

      // Block events while dragging an object. This prevents accidental camera movement
      // from small hand jitter on click/drag.
      event.stopPropagation();
      event.preventDefault();

      // Only start actual dragging if we've moved beyond threshold
      if (distance < DRAG_THRESHOLD_PIXELS) return;

      // Mark as a real drag (not just a click)
      // Check BOTH dragState.hasMoved AND hasMovedRef to prevent multiple calls
      // during rapid pointer events before React re-renders
      if (!dragState.hasMoved && !hasMovedRef.current) {
        onMarkAsDrag();
      }

      // Ground plane movement (XZ-axis)
      // Convert mouse position to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Reuse the Vector2 instead of creating a new one each frame
      mouseCoords.current.set(x, y);
      raycaster.current.setFromCamera(mouseCoords.current, camera);

      if (raycaster.current.ray.intersectPlane(groundPlane.current, intersection.current)) {
        // Calculate how far the grab point has moved on the drag plane
        const deltaX = intersection.current.x - dragState.initialGrabX;
        const deltaZ = intersection.current.z - dragState.initialGrabZ;

        // Check if we're dragging a child
        if (dragState.childPath && dragState.object.children) {
          // Use the effective world scale calculated at drag start.
          // This accounts for ALL transforms: parent's obj.transform.scale, model preprocessing scale, etc.
          // We divide the world delta by this scale to convert from world movement to local movement.
          const effectiveScaleX = dragState.childWorldScaleX || 1;
          const effectiveScaleZ = dragState.childWorldScaleZ || 1;

          // Divide world delta by effective world scale to get correct local movement
          // This ensures child moves 1:1 with cursor, just like root objects
          const childNewX =
            dragState.initialObjectX + (deltaX / effectiveScaleX) * SCENE_TO_WORLD_SCALE;
          const childNewZ =
            dragState.initialObjectZ - (deltaZ / effectiveScaleZ) * SCENE_TO_WORLD_SCALE;

          // Update child's localTransform in the parent object's children array
          const updatedChildren = dragState.object.children.map((child) => {
            const childPathStr = pathToString(child.path);
            if (childPathStr === dragState.childPath) {
              return {
                ...child,
                localTransform: {
                  ...child.localTransform,
                  x: childNewX,
                  z: childNewZ,
                },
              };
            }
            return child;
          });

          const updatedObject: SceneObject = {
            ...dragState.object,
            children: updatedChildren,
          };
          onUpdateObject(updatedObject);
        } else {
          // Update parent object's transform
          // Apply delta to initial position (convert from world to scene units)
          // Note: Z is negated because Three.js Z is opposite to scene transform Z
          // Clamp to grid boundary
          const rawX = dragState.initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
          const rawZ = dragState.initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;
          const newX = clamp(rawX, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
          const newZ = clamp(rawZ, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);

          const updatedObject: SceneObject = {
            ...dragState.object,
            transform: {
              ...dragState.object.transform,
              x: newX,
              z: newZ,
            },
          };
          onUpdateObject(updatedObject);
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      // Only block pointer up if we were actually dragging (canDrag=true and there was movement).
      // When canDrag=false, we let camera controls finish their gesture normally.
      if (dragState.canDrag && hasMovedRef.current) {
        // Prevent the pointer up event from reaching camera controls
        // This is critical to avoid unwanted camera movement after dragging
        event.stopPropagation();
        event.preventDefault();
      }

      // Use hasMovedRef instead of dragState.hasMoved to avoid stale closure issues
      // The ref is updated synchronously, so it always has the current value
      onDragEnd(hasMovedRef.current);
    };

    // Add listeners to window to capture events outside canvas
    // Use capture phase to intercept events before they reach camera controls
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
    };
    // hasMovedRef is a ref and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, camera, gl, onUpdateObject, onDragEnd, onMarkAsDrag]);

  return null;
};
