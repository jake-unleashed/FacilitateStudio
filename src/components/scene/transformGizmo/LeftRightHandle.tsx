/**
 * LeftRightHandle Component
 *
 * Drag handle for side view mode - moves along camera right axis.
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import * as THREE from 'three';

import { LeftRightHandleProps, LeftRightDragState } from './types';
import { DRAG_THRESHOLD_PX } from './constants';
import { XZ_BOUNDARY_INTERNAL, INTERNAL_TO_WORLD } from '../../../constants';
import { pathToString } from '../../../types';
import { findChildDataByPath, clamp, getHandleClasses } from './utils';
import { useTooltip } from './useTooltip';
import { GizmoTooltip } from './GizmoTooltip';

/**
 * Left/Right movement handle - for side view mode
 */
export const LeftRightHandle = memo<LeftRightHandleProps>(function LeftRightHandle({
  object,
  selectedChild,
  selectedChildPath,
  onUpdateObject,
  onDragStart,
  onDragEnd,
  camera,
  gl,
  objectWorldPosition,
  childMesh,
  cameraRight,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<LeftRightDragState | null>(null);

  const tooltip = useTooltip('Drag left/right to move', isDragging);

  // Pre-allocated vectors for screen projection
  const tempVec1 = useRef(new THREE.Vector3());
  const tempVec2 = useRef(new THREE.Vector3());

  /**
   * Calculates pixels per world unit along the camera right direction.
   * This allows us to convert screen-space X movement to world-space movement.
   */
  const calculatePixelsPerWorldUnit = useCallback((): number => {
    const rect = gl.domElement.getBoundingClientRect();
    const viewportWidth = rect.width;

    // Project object center to screen
    tempVec1.current.copy(objectWorldPosition);
    tempVec1.current.project(camera);

    // Project a point 1 world unit to the right (along camera right)
    tempVec2.current.copy(objectWorldPosition).add(cameraRight);
    tempVec2.current.project(camera);

    // Calculate pixel difference (NDC ranges from -1 to 1, so multiply by half viewport)
    const ndcDiff = Math.abs(tempVec2.current.x - tempVec1.current.x);
    const pixelDiff = ndcDiff * (viewportWidth / 2);

    // Ensure we don't divide by zero
    return Math.max(pixelDiff, 0.001);
  }, [camera, gl, objectWorldPosition, cameraRight]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Capture starting mouse X position
      const startMouseX = e.clientX;

      // Lock camera right direction at drag start
      const moveDirection = cameraRight.clone();

      // Calculate how many pixels = 1 world unit
      const pixelsPerWorldUnit = calculatePixelsPerWorldUnit();

      // Get initial object position
      let initialObjectX: number;
      let initialObjectZ: number;
      let childWorldScaleX: number | undefined;
      let childWorldScaleZ: number | undefined;

      if (selectedChild && selectedChildPath) {
        const childData = findChildDataByPath(object.children, selectedChildPath);
        initialObjectX = childData?.localTransform?.x ?? 0;
        initialObjectZ = childData?.localTransform?.z ?? 0;

        if (childMesh) {
          const worldScale = new THREE.Vector3();
          childMesh.getWorldScale(worldScale);
          childWorldScaleX = worldScale.x;
          childWorldScaleZ = worldScale.z;
        }
      } else {
        initialObjectX = object.transform.x;
        initialObjectZ = object.transform.z;
      }

      dragStateRef.current = {
        startMouseX,
        moveDirection,
        pixelsPerWorldUnit,
        initialObjectX,
        initialObjectZ,
        childWorldScaleX,
        childWorldScaleZ,
        hasMoved: false,
      };

      setIsDragging(true);
      onDragStart();
    },
    [
      object,
      selectedChild,
      selectedChildPath,
      onDragStart,
      childMesh,
      cameraRight,
      calculatePixelsPerWorldUnit,
    ]
  );

  // Handle pointer move and up events
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      // Calculate screen-space X delta (positive = moved right)
      const screenDeltaX = e.clientX - state.startMouseX;

      // Check if movement exceeds threshold
      if (Math.abs(screenDeltaX) > DRAG_THRESHOLD_PX) {
        state.hasMoved = true;
      }

      if (!state.hasMoved) return;

      // Convert screen pixels to world units
      const worldDelta = screenDeltaX / state.pixelsPerWorldUnit;

      // Calculate world-space movement along the camera right vector
      const worldDeltaX = state.moveDirection.x * worldDelta;
      const worldDeltaZ = state.moveDirection.z * worldDelta;

      if (selectedChild && selectedChildPath) {
        // Child movement: account for effective world scale
        const effectiveScaleX = state.childWorldScaleX || 1;
        const effectiveScaleZ = state.childWorldScaleZ || 1;

        const rawX = state.initialObjectX + (worldDeltaX / effectiveScaleX) * INTERNAL_TO_WORLD;
        const rawZ = state.initialObjectZ - (worldDeltaZ / effectiveScaleZ) * INTERNAL_TO_WORLD;

        // Note: Child positions are local to parent, so we don't clamp them to grid boundary
        // The parent's position determines if the child is within grid bounds

        const updatedChildren = object.children?.map((child) => {
          if (pathToString(child.path) === selectedChildPath) {
            return {
              ...child,
              localTransform: { ...child.localTransform, x: rawX, z: rawZ },
            };
          }
          return child;
        });

        onUpdateObject({ ...object, children: updatedChildren });
      } else {
        // Parent movement - clamp to grid boundary
        const rawX = state.initialObjectX + worldDeltaX * INTERNAL_TO_WORLD;
        const rawZ = state.initialObjectZ - worldDeltaZ * INTERNAL_TO_WORLD;
        const newX = clamp(rawX, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
        const newZ = clamp(rawZ, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);

        onUpdateObject({
          ...object,
          transform: { ...object.transform, x: newX, z: newZ },
        });
      }
    };

    const handlePointerUp = () => {
      const hasMoved = dragStateRef.current?.hasMoved ?? false;

      if (hasMoved) {
        onDragEnd();
      } else {
        tooltip.showClickTooltip('Hold and drag to move');
      }

      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, object, selectedChild, selectedChildPath, onUpdateObject, onDragEnd, tooltip]);

  return (
    <div className="relative">
      <div
        className={getHandleClasses(isDragging, isHovered)}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => {
          setIsHovered(true);
          tooltip.handlePointerEnter();
        }}
        onPointerLeave={() => {
          setIsHovered(false);
          tooltip.handlePointerLeave();
        }}
        aria-label="Move left/right"
        data-testid="handle-leftright"
      >
        <ArrowLeftRight size={20} strokeWidth={2.5} />
      </div>
      <GizmoTooltip text={tooltip.tooltipText} visible={tooltip.showTooltip} />
    </div>
  );
});
