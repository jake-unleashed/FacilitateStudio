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

import React, { useState, useCallback, useRef, memo } from 'react';
import { Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { pathToString } from '../../../types';
import { findChildByPath } from '../../../utils/modelLoaders';
import { calculateLowestPointOffset } from '../../../utils/groundHeight';
import { INTERNAL_TO_WORLD } from '../../../constants';

import { TransformGizmoProps, ViewMode } from './types';
import {
  HANDLE_GAP_PIXELS,
  HANDLE_SPACING_PIXELS,
  POSITION_LERP_FACTOR,
  SOURCE_SMOOTHING_FACTOR,
} from './constants';
import {
  calculateVisibleBounds,
  calculateWeightedCenter,
  getViewMode,
  findChildDataByPath,
  findObjectGroupInScene,
  findModelInGroup,
  calculatePixelsPerWorldUnit,
  pixelsToWorldUnits,
} from './utils';
import { HeightHandle } from './HeightHandle';
import { XZHandle } from './XZHandle';
import { LeftRightHandle } from './LeftRightHandle';

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
  const { camera, gl, scene } = useThree();

  // State for handle positions
  const [heightHandlePosition, setHeightHandlePosition] = useState<[number, number, number]>([
    0, 0, 0,
  ]);
  const [xzHandlePosition, setXZHandlePosition] = useState<[number, number, number]>([0, 0, 0]);

  // State for current transform values
  const [currentHeight, setCurrentHeight] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [childMesh, setChildMesh] = useState<THREE.Object3D | null>(null);

  // Ground height state - tracks the actual lowest point of the mesh in world space
  // minWorldY is the Y coordinate of the lowest point of the bounding box
  const [minWorldY, setMinWorldY] = useState(0);

  // Track when any handle is being dragged (disables smoothing for responsive feel)
  const [isAnyHandleDragging, setIsAnyHandleDragging] = useState(false);

  // Context-aware view mode (determines which handles to show)
  const [viewMode, setViewMode] = useState<ViewMode>('isometric');
  const viewModeRef = useRef<ViewMode>('isometric');

  // Camera right vector (exposed as state for LeftRightHandle)
  const [cameraRightState, setCameraRightState] = useState(new THREE.Vector3(1, 0, 0));

  // Refs for position tracking (avoid re-renders in frame loop)
  const heightPositionRef = useRef(new THREE.Vector3());
  const xzPositionRef = useRef(new THREE.Vector3());
  const objectWorldPositionRef = useRef(new THREE.Vector3());
  const lastHeightPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastXZPosRef = useRef<[number, number, number]>([0, 0, 0]);

  // Reusable Three.js objects (avoid allocations in frame loop)
  const boxRef = useRef(new THREE.Box3());
  const centerRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3());
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const boxSizeRef = useRef(new THREE.Vector3());

  // Target positions for smooth lerping (where handles SHOULD be)
  const heightTargetRef = useRef(new THREE.Vector3());
  const xzTargetRef = useRef(new THREE.Vector3());

  // Smoothed source data (eliminates bounding box jitter on complex models)
  const smoothedCenterRef = useRef(new THREE.Vector3());
  const smoothedOffsetDistanceRef = useRef(0);

  // Reusable vector for position calculations (avoid allocations in frame loop)
  const tempPositionRef = useRef(new THREE.Vector3());

  // Whether positions have been initialized (skip lerp on first frame)
  const positionsInitializedRef = useRef(false);

  // Find the selected child data if a child path is provided
  const selectedChild = selectedChildPath
    ? findChildDataByPath(object.children, selectedChildPath)
    : null;

  // Cached inverse parent linear transform for child-world translation during handle drags.
  // Set at drag start, cleared at drag end.
  const invParentLinearRef = useRef<THREE.Matrix3 | null>(null);
  const childDragStartWorldPosRef = useRef<THREE.Vector3 | null>(null);
  const childDragStartLocalRef = useRef<{ x: number; y: number; z: number } | null>(null);

  /**
   * Updates handle positions each frame based on object bounding box
   */
  useFrame((_, delta) => {
    // Calculate frame-rate independent smoothing factors
    // When dragging (handle or object directly), use instant snap (factor = 1) for 1:1 movement
    const isBeingDragged = isAnyHandleDragging || isDragging;
    const effectiveSourceFactor = isBeingDragged
      ? 1.0
      : 1 - Math.pow(1 - SOURCE_SMOOTHING_FACTOR, delta * 60);
    const effectivePositionFactor = isBeingDragged
      ? 1.0
      : 1 - Math.pow(1 - POSITION_LERP_FACTOR, delta * 60);

    const objectGroup = findObjectGroupInScene(scene, object.id);

    // Fallback positioning when object group not found
    if (!objectGroup) {
      const centerX = object.transform.x / INTERNAL_TO_WORLD;
      const targetHeightY = object.transform.y / INTERNAL_TO_WORLD + 0.5;
      const centerZ = -object.transform.z / INTERNAL_TO_WORLD;

      // Calculate camera right vector for fallback positioning
      camera.getWorldDirection(cameraDirectionRef.current);
      cameraRightRef.current.crossVectors(cameraDirectionRef.current, new THREE.Vector3(0, 1, 0));
      cameraRightRef.current.normalize();

      // Update view mode based on camera angle (with hysteresis)
      const newViewMode = getViewMode(camera, viewModeRef.current, cameraDirectionRef.current);
      if (newViewMode !== viewModeRef.current) {
        viewModeRef.current = newViewMode;
        setViewMode(newViewMode);
      }

      // Update camera right state for LeftRightHandle
      if (cameraRightRef.current.distanceToSquared(cameraRightState) > 0.0001) {
        setCameraRightState(cameraRightRef.current.clone());
      }

      // Calculate dynamic offsets in world units based on screen pixel targets
      const rect = gl.domElement.getBoundingClientRect();
      const fallbackPos = tempPositionRef.current.set(centerX, targetHeightY, centerZ);
      const pixelsPerWorldUnit = calculatePixelsPerWorldUnit(camera, fallbackPos, rect.height);
      const dynamicHandleOffset = pixelsToWorldUnits(HANDLE_SPACING_PIXELS, pixelsPerWorldUnit);
      const dynamicGap = pixelsToWorldUnits(HANDLE_GAP_PIXELS, pixelsPerWorldUnit);

      // Use fallback bounding box size (0.5) plus dynamic gap for consistent screen spacing
      const fallbackOffset = 0.5 + dynamicGap;
      const targetX = centerX + cameraRightRef.current.x * fallbackOffset;
      const targetZ = centerZ + cameraRightRef.current.z * fallbackOffset;

      // XZ handle below height handle (using dynamic offset for consistent screen spacing)
      const targetXzY = targetHeightY - dynamicHandleOffset;

      // Set targets
      heightTargetRef.current.set(targetX, targetHeightY, targetZ);
      xzTargetRef.current.set(targetX, targetXzY, targetZ);

      // First frame: snap to position; otherwise use frame-rate independent lerp
      if (!positionsInitializedRef.current) {
        heightPositionRef.current.copy(heightTargetRef.current);
        xzPositionRef.current.copy(xzTargetRef.current);
        positionsInitializedRef.current = true;
      } else {
        heightPositionRef.current.lerp(heightTargetRef.current, effectivePositionFactor);
        xzPositionRef.current.lerp(xzTargetRef.current, effectivePositionFactor);
      }

      setHeightHandlePosition([
        heightPositionRef.current.x,
        heightPositionRef.current.y,
        heightPositionRef.current.z,
      ]);
      setXZHandlePosition([
        xzPositionRef.current.x,
        xzPositionRef.current.y,
        xzPositionRef.current.z,
      ]);
      setCurrentHeight(object.transform.y);
      setScaleFactor(1);
      setChildMesh(null);

      // Fallback minWorldY calculation using the model height from properties
      const modelHeight = (object.properties.modelHeight as number) || 2.0;
      const fallbackLowestOffset = calculateLowestPointOffset(
        object.transform.rotationX,
        object.transform.rotationY,
        object.transform.rotationZ,
        object.transform.scaleX,
        object.transform.scaleY,
        object.transform.scaleZ,
        modelHeight
      );
      // minWorldY = objectCenterY + lowestPointOffset (lowestPointOffset is negative)
      const fallbackMinWorldY = object.transform.y / INTERNAL_TO_WORLD + fallbackLowestOffset;
      setMinWorldY(fallbackMinWorldY);
      return;
    }

    objectGroup.updateWorldMatrix(true, true);

    // Determine target object and values based on selection
    let targetObject: THREE.Object3D = objectGroup;
    let heightValue = object.transform.y;
    let currentScaleFactor = 1;
    let foundChildMesh: THREE.Object3D | null = null;

    if (selectedChildPath && selectedChild) {
      const model = findModelInGroup(objectGroup);

      if (model) {
        const pathArray = selectedChildPath.split('.');
        const meshFound = findChildByPath(model, pathArray);

        if (meshFound) {
          targetObject = meshFound;
          foundChildMesh = meshFound;
        }
      }

      // Child translation should be WORLD-based: show world Y in internal units.
      if (foundChildMesh) {
        const worldPos = new THREE.Vector3();
        foundChildMesh.getWorldPosition(worldPos);
        heightValue = worldPos.y * INTERNAL_TO_WORLD;
      } else {
        // Fallback (no mesh found): use local value
        heightValue = selectedChild.localTransform.y;
      }
      currentScaleFactor = object.transform.scaleY;
    }

    // Calculate bounding box from ONLY visible geometry (excludes empty transforms)
    const box = calculateVisibleBounds(targetObject);
    // Copy to ref for consistency with existing code
    boxRef.current.copy(box);

    if (!box.isEmpty()) {
      // Use volume-weighted center for positioning (focuses on bulk of geometry, not outliers)
      const rawCenter = calculateWeightedCenter(targetObject);
      centerRef.current.copy(rawCenter);

      // Calculate raw bounding box half-extent in XZ plane (without gap - gap is calculated dynamically)
      box.getSize(boxSizeRef.current);
      const rawHalfExtent = Math.max(boxSizeRef.current.x, boxSizeRef.current.z) / 2;

      // Smooth the source data to eliminate bounding box jitter on complex models
      // Uses frame-rate independent factor; snaps instantly when dragging
      if (!positionsInitializedRef.current) {
        // First frame: initialize smoothed values directly
        smoothedCenterRef.current.copy(rawCenter);
        smoothedOffsetDistanceRef.current = rawHalfExtent;
      } else {
        // Subsequent frames: lerp smoothed values towards raw values
        smoothedCenterRef.current.lerp(rawCenter, effectiveSourceFactor);
        smoothedOffsetDistanceRef.current +=
          (rawHalfExtent - smoothedOffsetDistanceRef.current) * effectiveSourceFactor;
      }

      // Use smoothed values for all calculations
      const center = smoothedCenterRef.current;
      const smoothedHalfExtent = smoothedOffsetDistanceRef.current;

      // Store world position for XZ handle raycasting
      objectWorldPositionRef.current.copy(center);

      // Calculate camera right vector (projected to XZ plane for consistency)
      camera.getWorldDirection(cameraDirectionRef.current);
      cameraRightRef.current.crossVectors(cameraDirectionRef.current, new THREE.Vector3(0, 1, 0));
      cameraRightRef.current.normalize();

      // Update view mode based on camera angle (with hysteresis)
      const newViewMode = getViewMode(camera, viewModeRef.current, cameraDirectionRef.current);
      if (newViewMode !== viewModeRef.current) {
        viewModeRef.current = newViewMode;
        setViewMode(newViewMode);
      }

      // Update camera right state for LeftRightHandle (only when changed significantly)
      if (cameraRightRef.current.distanceToSquared(cameraRightState) > 0.0001) {
        setCameraRightState(cameraRightRef.current.clone());
      }

      // Calculate dynamic spacing using view-angle-independent formula
      const rect = gl.domElement.getBoundingClientRect();
      const pixelsPerWorldUnit = calculatePixelsPerWorldUnit(camera, center, rect.height);
      const dynamicHandleOffset = pixelsToWorldUnits(HANDLE_SPACING_PIXELS, pixelsPerWorldUnit);
      const dynamicGap = pixelsToWorldUnits(HANDLE_GAP_PIXELS, pixelsPerWorldUnit);

      // Final offset distance: smoothed bounding box half-extent + dynamic gap
      const offsetDistance = smoothedHalfExtent + dynamicGap;

      // Calculate TARGET positions along camera right vector from object center
      const targetHeightY = center.y;
      const targetXzY = center.y - dynamicHandleOffset;

      // Set target positions
      heightTargetRef.current.set(
        center.x + cameraRightRef.current.x * offsetDistance,
        targetHeightY,
        center.z + cameraRightRef.current.z * offsetDistance
      );
      xzTargetRef.current.set(
        center.x + cameraRightRef.current.x * offsetDistance,
        targetXzY,
        center.z + cameraRightRef.current.z * offsetDistance
      );

      // On first frame, snap directly to target (no lerp)
      if (!positionsInitializedRef.current) {
        heightPositionRef.current.copy(heightTargetRef.current);
        xzPositionRef.current.copy(xzTargetRef.current);
        positionsInitializedRef.current = true;
      } else {
        // Smoothly lerp current positions towards targets (frame-rate independent)
        heightPositionRef.current.lerp(heightTargetRef.current, effectivePositionFactor);
        xzPositionRef.current.lerp(xzTargetRef.current, effectivePositionFactor);
      }

      // Update state for React rendering (always update for smooth animation)
      const heightPos: [number, number, number] = [
        heightPositionRef.current.x,
        heightPositionRef.current.y,
        heightPositionRef.current.z,
      ];
      const xzPos: [number, number, number] = [
        xzPositionRef.current.x,
        xzPositionRef.current.y,
        xzPositionRef.current.z,
      ];

      // Only trigger re-render if position changed meaningfully
      if (
        Math.abs(heightPos[0] - lastHeightPosRef.current[0]) > 0.0001 ||
        Math.abs(heightPos[1] - lastHeightPosRef.current[1]) > 0.0001 ||
        Math.abs(heightPos[2] - lastHeightPosRef.current[2]) > 0.0001
      ) {
        lastHeightPosRef.current = heightPos;
        setHeightHandlePosition(heightPos);
      }

      if (
        Math.abs(xzPos[0] - lastXZPosRef.current[0]) > 0.0001 ||
        Math.abs(xzPos[1] - lastXZPosRef.current[1]) > 0.0001 ||
        Math.abs(xzPos[2] - lastXZPosRef.current[2]) > 0.0001
      ) {
        lastXZPosRef.current = xzPos;
        setXZHandlePosition(xzPos);
      }
    }

    // Update state values (with change detection)
    if (currentHeight !== heightValue) setCurrentHeight(heightValue);
    if (scaleFactor !== currentScaleFactor) setScaleFactor(currentScaleFactor);
    if (childMesh !== foundChildMesh) setChildMesh(foundChildMesh);

    // Get the actual lowest point of the mesh from the bounding box
    const actualMinWorldY = box.min.y;
    if (minWorldY !== actualMinWorldY) {
      setMinWorldY(actualMinWorldY);
    }
  });

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
  }, [onDragStart, selectedChildPath, childMesh, selectedChild]);

  const handleDragEnd = useCallback(() => {
    setIsAnyHandleDragging(false);
    invParentLinearRef.current = null;
    childDragStartWorldPosRef.current = null;
    childDragStartLocalRef.current = null;
    onDragEnd?.();
  }, [onDragEnd]);

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
              worldPosition={heightPositionRef.current}
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
