/**
 * TransformGizmo Component
 *
 * Floating handles for object manipulation in 3D space:
 * - Height Handle: Drag up/down to adjust Y position (world-space)
 * - XZ Handle: Drag to move object on the ground plane (uses raycasting for 1:1 movement)
 * - Left/Right Handle: For side view mode, moves along camera right axis
 *
 * Design principles:
 * - Minimalist: icon only, no text labels (tooltips on hover/click)
 * - Premium: frosted glass effect, smooth animations
 * - Intuitive: clearly grabbable, obvious function
 * - 1:1 movement: handle and object move together with cursor
 * - World-space positioning: handles positioned to the right of object in 3D space
 *
 * @module TransformGizmo
 */

import { useCallback, useRef, memo } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { pathToString } from '../../../types';
import { INTERNAL_TO_WORLD } from '../../../constants';

import { TransformGizmoProps } from './types';
import { HeightHandle } from './HeightHandle';
import { XZHandle } from './XZHandle';
import { LeftRightHandle } from './LeftRightHandle';
import { useTransformGizmoFrame } from './useTransformGizmoFrame';

/**
 * Internal component that renders within the R3F context
 */
const TransformGizmoInner: React.FC<TransformGizmoProps> = ({
  object,
  selectedChildPath,
  onUpdateObject,
  onDragStart,
  onDragEnd,
  isDragging = false,
}) => {
  const { camera, gl } = useThree();

  const {
    heightHandlePosition,
    xzHandlePosition,
    currentHeight,
    scaleFactor,
    childMesh,
    minWorldY,
    viewMode,
    cameraRightState,
    selectedChild,
    heightWorldPositionRef,
    objectWorldPositionRef,
    setIsAnyHandleDragging,
  } = useTransformGizmoFrame({ object, selectedChildPath, isDragging });

  // Cached inverse parent linear transform for child-world translation during handle drags.
  // Set at drag start, cleared at drag end.
  const invParentLinearRef = useRef<THREE.Matrix3 | null>(null);
  const childDragStartWorldPosRef = useRef<THREE.Vector3 | null>(null);
  const childDragStartLocalRef = useRef<{ x: number; y: number; z: number } | null>(null);

  /**
   * Handles height value changes from the height handle.
   */
  const handleHeightChange = useCallback(
    (newY: number) => {
      if (selectedChild && selectedChildPath) {
        if (!object.children) return;

        // If we have the mesh + cached inverse parent linear transform, apply a WORLD-Y delta robustly.
        if (
          childMesh &&
          invParentLinearRef.current &&
          childDragStartWorldPosRef.current &&
          childDragStartLocalRef.current
        ) {
          const targetWorldY = newY / INTERNAL_TO_WORLD;
          const worldDeltaY = targetWorldY - childDragStartWorldPosRef.current.y;

          const localDelta = new THREE.Vector3(0, worldDeltaY, 0).applyMatrix3(
            invParentLinearRef.current
          );

          const updatedChildren = object.children.map((child) => {
            if (pathToString(child.path) !== selectedChildPath) return child;
            return {
              ...child,
              localTransform: {
                ...child.localTransform,
                x: childDragStartLocalRef.current!.x + localDelta.x * INTERNAL_TO_WORLD,
                y: childDragStartLocalRef.current!.y + localDelta.y * INTERNAL_TO_WORLD,
                z: childDragStartLocalRef.current!.z - localDelta.z * INTERNAL_TO_WORLD,
              },
            };
          });

          onUpdateObject({ ...object, children: updatedChildren });
          return;
        }

        // Fallback (tests / missing mesh): treat as local Y.
        const updatedChildren = object.children.map((child) => {
          if (pathToString(child.path) !== selectedChildPath) return child;
          return { ...child, localTransform: { ...child.localTransform, y: newY } };
        });
        onUpdateObject({ ...object, children: updatedChildren });
      } else {
        // Update parent's transform
        onUpdateObject({
          ...object,
          transform: { ...object.transform, y: newY },
        });
      }
    },
    [object, selectedChild, selectedChildPath, onUpdateObject, childMesh]
  );

  const handleDragStart = useCallback(() => {
    setIsAnyHandleDragging(true);
    if (selectedChildPath && childMesh?.parent) {
      childMesh.parent.updateMatrixWorld(true);
      invParentLinearRef.current = new THREE.Matrix3()
        .setFromMatrix4(childMesh.parent.matrixWorld)
        .invert();
      const worldPos = new THREE.Vector3();
      childMesh.getWorldPosition(worldPos);
      childDragStartWorldPosRef.current = worldPos;
      if (selectedChild) {
        childDragStartLocalRef.current = {
          x: selectedChild.localTransform.x,
          y: selectedChild.localTransform.y,
          z: selectedChild.localTransform.z,
        };
      } else {
        childDragStartLocalRef.current = null;
      }
    } else {
      invParentLinearRef.current = null;
      childDragStartWorldPosRef.current = null;
      childDragStartLocalRef.current = null;
    }
    onDragStart?.();
  }, [onDragStart, selectedChildPath, childMesh, selectedChild, setIsAnyHandleDragging]);

  const handleDragEnd = useCallback(() => {
    setIsAnyHandleDragging(false);
    invParentLinearRef.current = null;
    childDragStartWorldPosRef.current = null;
    childDragStartLocalRef.current = null;
    onDragEnd?.();
  }, [onDragEnd, setIsAnyHandleDragging]);

  // Determine which handles to show based on view mode
  const showHeightHandle = viewMode !== 'topdown';
  const showXZHandle = viewMode === 'isometric' || viewMode === 'topdown';
  const showLeftRightHandle = viewMode === 'side';

  // CSS for smooth fade transitions
  const fadeTransition = 'opacity 150ms ease-out, transform 150ms ease-out';
  const visibleStyle = { opacity: 1, transform: 'scale(1)', transition: fadeTransition };
  const hiddenStyle = {
    opacity: 0,
    transform: 'scale(0.8)',
    transition: fadeTransition,
    pointerEvents: 'none' as const,
  };

  return (
    <>
      {/* Height Handle - hidden in top-down view */}
      <group position={heightHandlePosition}>
        <Html
          center
          sprite
          transform={false}
          occlude={false}
          style={{
            pointerEvents: showHeightHandle ? 'auto' : 'none',
            userSelect: 'none',
          }}
        >
          <div
            data-testid="transform-gizmo-height"
            onPointerDown={(e) => e.stopPropagation()}
            style={showHeightHandle ? visibleStyle : hiddenStyle}
          >
            <HeightHandle
              value={currentHeight}
              minWorldY={minWorldY}
              onChange={handleHeightChange}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              camera={camera}
              gl={gl}
                worldPosition={heightWorldPositionRef.current}
              scaleFactor={scaleFactor}
              childMesh={childMesh}
              isChild={selectedChildPath !== null}
            />
          </div>
        </Html>
      </group>

      {/* XZ and Left/Right Handles - share exact same position, only one visible at a time */}
      <group position={xzHandlePosition}>
        <Html
          center
          sprite
          transform={false}
          occlude={false}
          style={{ pointerEvents: 'auto', userSelect: 'none' }}
        >
          {/* Container for overlapping handles - uses relative positioning */}
          <div style={{ position: 'relative', width: 40, height: 40 }}>
            {/* XZ Handle - shown in isometric and top-down modes */}
            <div
              data-testid="transform-gizmo-xz"
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                ...(showXZHandle ? visibleStyle : hiddenStyle),
              }}
            >
              <XZHandle
                object={object}
                selectedChild={selectedChild}
                selectedChildPath={selectedChildPath}
                onUpdateObject={onUpdateObject}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                camera={camera}
                gl={gl}
                objectWorldPosition={objectWorldPositionRef.current}
                childMesh={childMesh}
              />
            </div>
            {/* Left/Right Handle - shown only in side view mode */}
            <div
              data-testid="transform-gizmo-leftright"
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                ...(showLeftRightHandle ? visibleStyle : hiddenStyle),
              }}
            >
              <LeftRightHandle
                object={object}
                selectedChild={selectedChild}
                selectedChildPath={selectedChildPath}
                onUpdateObject={onUpdateObject}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                camera={camera}
                gl={gl}
                objectWorldPosition={objectWorldPositionRef.current}
                childMesh={childMesh}
                cameraRight={cameraRightState}
              />
            </div>
          </div>
        </Html>
      </group>
    </>
  );
};

/**
 * TransformGizmo - Floating handles for 3D object manipulation
 *
 * Renders height and XZ movement handles next to selected objects.
 * Supports both parent objects and child mesh selection.
 *
 * @example
 * ```tsx
 * <TransformGizmo
 *   object={selectedObject}
 *   selectedChildPath={childPath}
 *   onUpdateObject={handleUpdate}
 *   onDragStart={() => beginBatch('Move')}
 *   onDragEnd={() => endBatch()}
 * />
 * ```
 */
export const TransformGizmo = memo(TransformGizmoInner);
TransformGizmo.displayName = 'TransformGizmo';
