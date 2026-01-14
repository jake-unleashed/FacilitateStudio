/**
 * XZHandle Component
 *
 * Drag handle for moving objects on the ground plane (XZ).
 * Uses raycasting for true 1:1 movement.
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Move } from 'lucide-react';
import * as THREE from 'three';

import { XZHandleProps, XZDragState } from './types';
import { XZ_DRAG_THRESHOLD } from './constants';
import { XZ_BOUNDARY_INTERNAL, INTERNAL_TO_WORLD } from '../../../constants';
import { pathToString } from '../../../types';
import { extractScaleFromMatrix, clamp, getHandleClasses } from './utils';
import { useTooltip } from './useTooltip';
import { GizmoTooltip } from './GizmoTooltip';

/**
 * XZ plane movement handle - drag to move on ground
 */
export const XZHandle = memo<XZHandleProps>(function XZHandle({
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
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<XZDragState | null>(null);

  // Use refs to avoid recreating useEffect when object/child changes during drag
  // This prevents the "jumpiness" caused by event listener teardown/setup mid-drag
  const objectRef = useRef(object);
  const selectedChildRef = useRef(selectedChild);
  const selectedChildPathRef = useRef(selectedChildPath);
  const onUpdateObjectRef = useRef(onUpdateObject);

  // Keep refs in sync with props
  useEffect(() => {
    objectRef.current = object;
  }, [object]);
  useEffect(() => {
    selectedChildRef.current = selectedChild;
  }, [selectedChild]);
  useEffect(() => {
    selectedChildPathRef.current = selectedChildPath;
  }, [selectedChildPath]);
  useEffect(() => {
    onUpdateObjectRef.current = onUpdateObject;
  }, [onUpdateObject]);

  const tooltip = useTooltip('Drag to move on ground', isDragging);

  // Pre-allocated Three.js objects for raycasting (performance optimization)
  const raycasterRef = useRef(new THREE.Raycaster());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectionRef = useRef(new THREE.Vector3());
  const mouseCoordsRef = useRef(new THREE.Vector2());

  /**
   * Converts client coordinates to normalized device coordinates
   */
  const clientToNDC = useCallback(
    (clientX: number, clientY: number): THREE.Vector2 => {
      const rect = gl.domElement.getBoundingClientRect();
      return mouseCoordsRef.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
    },
    [gl]
  );

  /**
   * Performs raycast to ground plane and returns intersection point
   */
  const raycastToGround = useCallback(
    (clientX: number, clientY: number, planeY: number): THREE.Vector3 | null => {
      const ndc = clientToNDC(clientX, clientY);
      raycasterRef.current.setFromCamera(ndc, camera);
      groundPlaneRef.current.constant = -planeY;

      if (
        raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionRef.current)
      ) {
        return intersectionRef.current;
      }
      return null;
    },
    [camera, clientToNDC]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      tooltip.hideTooltip();

      const groundPlaneY = objectWorldPosition.y;
      const intersection = raycastToGround(e.clientX, e.clientY, groundPlaneY);

      if (!intersection) return;

      // Determine initial position values and child scale factors
      let initialX: number;
      let initialZ: number;
      let childWorldScaleX: number | undefined;
      let childWorldScaleZ: number | undefined;

      if (selectedChild && selectedChildPath && childMesh) {
        initialX = selectedChild.localTransform.x;
        initialZ = selectedChild.localTransform.z;

        // Extract effective world scale from child mesh's world matrix
        childMesh.updateMatrixWorld(true);
        childWorldScaleX = extractScaleFromMatrix(childMesh.matrixWorld, 'x');
        childWorldScaleZ = extractScaleFromMatrix(childMesh.matrixWorld, 'z');
      } else {
        initialX = object.transform.x;
        initialZ = object.transform.z;
      }

      setIsDragging(true);
      dragStateRef.current = {
        groundPlaneY,
        initialGrabX: intersection.x,
        initialGrabZ: intersection.z,
        initialObjectX: initialX,
        initialObjectZ: initialZ,
        childWorldScaleX,
        childWorldScaleZ,
        hasMoved: false,
      };
      onDragStart();
    },
    [
      object,
      selectedChild,
      selectedChildPath,
      objectWorldPosition,
      childMesh,
      onDragStart,
      tooltip,
      raycastToGround,
    ]
  );

  // Handle drag movement and release
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const intersection = raycastToGround(e.clientX, e.clientY, state.groundPlaneY);
      if (!intersection) return;

      const deltaX = intersection.x - state.initialGrabX;
      const deltaZ = intersection.z - state.initialGrabZ;

      // Check if movement exceeds threshold
      if (Math.abs(deltaX) > XZ_DRAG_THRESHOLD || Math.abs(deltaZ) > XZ_DRAG_THRESHOLD) {
        state.hasMoved = true;
      }

      if (!state.hasMoved) return;

      // Use refs to get current values (avoids stale closures during drag)
      const currentObject = objectRef.current;
      const currentSelectedChild = selectedChildRef.current;
      const currentSelectedChildPath = selectedChildPathRef.current;
      const currentOnUpdateObject = onUpdateObjectRef.current;

      if (currentSelectedChild && currentSelectedChildPath) {
        // Child movement: account for effective world scale
        const effectiveScaleX = state.childWorldScaleX || 1;
        const effectiveScaleZ = state.childWorldScaleZ || 1;

        const rawX = state.initialObjectX + (deltaX / effectiveScaleX) * INTERNAL_TO_WORLD;
        const rawZ = state.initialObjectZ - (deltaZ / effectiveScaleZ) * INTERNAL_TO_WORLD;

        // Note: Child positions are local to parent, so we don't clamp them to grid boundary
        // The parent's position determines if the child is within grid bounds

        const updatedChildren = currentObject.children?.map((child) => {
          if (pathToString(child.path) === currentSelectedChildPath) {
            return {
              ...child,
              localTransform: { ...child.localTransform, x: rawX, z: rawZ },
            };
          }
          return child;
        });

        currentOnUpdateObject({ ...currentObject, children: updatedChildren });
      } else {
        // Parent movement - clamp to grid boundary
        const rawX = state.initialObjectX + deltaX * INTERNAL_TO_WORLD;
        const rawZ = state.initialObjectZ - deltaZ * INTERNAL_TO_WORLD;
        const newX = clamp(rawX, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
        const newZ = clamp(rawZ, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);

        currentOnUpdateObject({
          ...currentObject,
          transform: { ...currentObject.transform, x: newX, z: newZ },
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
  }, [
    isDragging,
    // Removed object, selectedChild, selectedChildPath, onUpdateObject from deps
    // Using refs instead to avoid recreating listeners during drag
    onDragEnd,
    tooltip,
    raycastToGround,
  ]);

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
        aria-label="Move - drag to move on ground"
        data-testid="handle-xz"
      >
        <Move size={20} strokeWidth={2.5} />
      </div>
      <GizmoTooltip text={tooltip.tooltipText} visible={tooltip.showTooltip} />
    </div>
  );
});
