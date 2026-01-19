import React, { Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  SceneObject,
  SimStep,
  FocusMode,
  parseSelectionId,
  createChildSelectionId,
  pathToString,
} from '../types';
import { DEFAULT_CAMERA_POSITION, GROUND_PLANE_EXTENT } from '../constants';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { CameraControls, Environment, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { PerformanceMonitorScene, PerformanceMonitorUI } from './PerformanceMonitor';
import { PreviewMoveItemStepRenderer } from './preview/PreviewMoveItemStepRenderer';
import type { PreviewOutlineTarget } from './preview/types';
import { ImportedModel } from './scene/ImportedModel';
import {
  ChildSelectionProvider,
  Select,
  ChildOutlineEffect,
  PreviewChildOutlineEffect,
  SelectionOutlineEffect,
  PreviewSelectionOutlineEffect,
} from './scene/SelectionOutline';
import { Selection } from '@react-three/postprocessing';
import { TransformGizmo } from './scene/transformGizmo';
import { FixedContactShadows, ContactShadowDebugger } from './scene/FixedContactShadows';
import { IndustrialPrimitive } from './scene/IndustrialPrimitive';
import { DragHandler, CursorManager, DragState } from './scene/DragHandler';
import { KeyboardNavigator } from './scene/KeyboardNavigator';
import {
  applyChildLocalTransform,
  applyChildWorldPosition,
  calculateChildWorldPosition,
  findChildByPathString,
} from '../utils/childTransformUtils';

// Check if we're in development mode (Vite provides this)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV ?? process.env.NODE_ENV === 'development';

// ============================================================================
// Grid and Shadow Configuration
// ============================================================================

/**
 * How quickly the grid fades at its edges.
 * Higher values = faster fade = sharper edge
 * Lower values = slower fade = softer edge
 * Note: With fixed-size grid, this controls the edge softness.
 */
const GRID_FADE_STRENGTH = 2.0;

/**
 * GridWithNoDepth - A wrapper around the drei Grid component that disables depth writing.
 *
 * Problem: The Grid component writes to the depth buffer, which interferes with the
 * postprocessing Outline effect's depth comparison. This causes selection outlines to
 * incorrectly appear as "hidden" (showing the hiddenEdgeColor) when objects are positioned
 * on certain sides of the grid.
 *
 * Solution: Disable depthWrite on the Grid's shader material so it doesn't affect
 * depth-based post-processing effects. Combined with renderOrder={-1}, this ensures
 * the grid is purely visual and doesn't interfere with object selection outlines.
 */
interface GridWithNoDepthProps {
  args: [number, number];
  cellSize: number;
  sectionSize: number;
  fadeDistance: number;
  fadeStrength: number;
  sectionColor: string;
  cellColor: string;
  sectionThickness: number;
  cellThickness: number;
  side: THREE.Side;
}

const GridWithNoDepth: React.FC<GridWithNoDepthProps> = (props) => {
  const gridRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (gridRef.current) {
      // The Grid component creates a mesh with a custom shader material
      // Disable depthWrite to prevent interference with Outline effect's depth comparison
      const material = gridRef.current.material as THREE.ShaderMaterial;
      if (material) {
        material.depthWrite = false;
      }
    }
  }, []);

  // renderOrder={-1} ensures grid renders before scene objects
  return <Grid ref={gridRef} {...props} renderOrder={-1} />;
};

// Note: Focus mode determination is now handled entirely in EditorPage.tsx
// The 'soft' focus mode adaptively handles all cases (too close, too far, comfort zone)
// MainCanvas just always triggers 'soft' focus on selection

// ============================================================================
// Selection-Before-Drag Logic
// ============================================================================

/**
 * Determines whether dragging is allowed for a pointer interaction.
 *
 * FEATURE: "Direct Dragging Disabled"
 * Direct click-and-drag translation of objects is disabled. Objects can only be moved
 * using the transform handles (gizmo). This prevents accidental object movement when:
 * - Users try to rotate the camera around objects
 * - Users attempt to select objects but accidentally drag them
 * - Camera movement (left click) accidentally triggers object translation
 *
 * When canDrag is false:
 * - Camera controls remain enabled (user can rotate/pan)
 * - Click-to-select still works (object is selected on pointer up if no drag)
 * - Object position is NOT updated during the gesture
 * - Objects can ONLY be moved via transform handles
 *
 * @param _selectedParentId - ID of the currently selected parent object (null if none)
 * @param _selectedChildPath - Path of the currently selected child (null if parent or none)
 * @param _clickedObjectId - ID of the object being clicked
 * @param _dragChildPath - Path of the child that would be dragged (null for parent drag)
 * @returns Always false - direct dragging is disabled, use transform handles instead
 */
function calculateCanDrag(
  _selectedParentId: string | null,
  _selectedChildPath: string | null,
  _clickedObjectId: string,
  _dragChildPath?: string | null
): boolean {
  // Direct dragging is disabled - objects can only be moved via transform handles
  // This prevents accidental object movement when users interact with the camera
  return false;

  // Previous implementation (disabled):
  // const isParentSelected = selectedParentId === clickedObjectId;
  // if (dragChildPath) {
  //   return isParentSelected && selectedChildPath === dragChildPath;
  // } else {
  //   return isParentSelected && selectedChildPath === null;
  // }
}

// ============================================================================
// Types
// ============================================================================

interface SceneContentProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  /** Callback when the Three.js scene is ready (for occlusion-aware focus raycasts) */
  onSceneReady?: (scene: THREE.Scene) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  recordingPositionForStepId?: string | null;
  steps?: SimStep[];
  latestRecordingEndPositionRef?: React.MutableRefObject<{
    stepId: string;
    endPosition: { x: number; y: number; z: number } | null;
    endRotation?: { x: number; y: number; z: number };
    endScale?: { x: number; y: number; z: number };
  } | null>;
  previewMode?: boolean;
  previewStep?: SimStep | null;
  onPreviewObjectClick?: (objectId: string) => void;
  onPreviewTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  onPreviewStepComplete?: () => void;
  shouldAnimateMoveItem?: boolean;
  previewOutlineTarget?: PreviewOutlineTarget | null;
  onPreviewOutlineTargetChange?: (target: PreviewOutlineTarget | null) => void;
}

const SceneContent: React.FC<SceneContentProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  onSceneReady,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  latestRecordingEndPositionRef,
  previewMode = false,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewTransformUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
  previewOutlineTarget = null,
  onPreviewOutlineTargetChange,
}) => {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const isPositioningCameraRef = useRef(false); // Track when camera is being positioned in preview
  const { invalidate, scene } = useThree();
  const hasNotifiedSceneRef = useRef(false);

  // Expose the Three.js scene to parent callers (used for occlusion-aware edit focus).
  useEffect(() => {
    if (!onSceneReady) return;
    if (hasNotifiedSceneRef.current) return;
    if (!scene) return;
    hasNotifiedSceneRef.current = true;
    onSceneReady(scene);
  }, [onSceneReady, scene]);

  // Ref to track latest endPosition during drag (avoids race condition with state updates)
  const latestEndPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const latestEndRotationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const latestEndScaleRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // Parse the selection ID to separate parent and child selection
  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);
  const selectedParentId = parsedSelection?.objectId ?? null;
  const selectedChildPath = parsedSelection?.childPath ?? null;

  const selectedObject = objects.find((obj) => obj.id === selectedParentId) || null;

  // Preview outline target parsing (kept separate from selection state)
  const previewOutlineParentId = previewOutlineTarget?.objectId ?? null;
  const previewOutlineChildPath = previewOutlineTarget?.childPath ?? null;

  // Force a render frame when preview outline target changes
  // This ensures the <Select enabled> prop update triggers a visible frame
  // without requiring user interaction (mouse move, etc.)
  useEffect(() => {
    if (previewMode) {
      invalidate();
    }
  }, [previewMode, previewOutlineTarget, invalidate]);

  // Drag state management
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [isRecentlyDragged, setIsRecentlyDragged] = useState(false);

  // Hover handling:
  // When moving directly from one object to another, React/Three pointer events can fire
  // "leave" for the previous object after "enter" for the next object. If we blindly clear
  // hover on every leave, the cursor can flicker to default while still hovering a new object.
  // We only clear hover if the leaving object is still the currently-hovered one.
  const handleHoverStart = useCallback((objectId: string) => {
    setHoveredObjectId(objectId);
  }, []);

  const handleHoverEnd = useCallback((objectId: string) => {
    setHoveredObjectId((prev) => (prev === objectId ? null : prev));
  }, []);

  // Ref to track hasMoved synchronously (avoids stale closure issues in event handlers)
  const hasMovedRef = useRef(false);

  // Keep hasMovedRef in sync with dragState (for cases where state drives re-renders)
  useEffect(() => {
    hasMovedRef.current = dragState?.hasMoved ?? false;
  }, [dragState?.hasMoved]);

  // Ref to store the drag state for use in global pointer up listener
  // This avoids stale closure issues since the effect can capture the ref
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // CRITICAL: Global safety listener for pointer up events
  // This catches pointer up events that might be missed due to React re-render timing
  // when switching between child selections. This runs ALWAYS, not just when dragState exists.
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      // Only act if we have drag state
      if (dragStateRef.current) {
        // Clear the drag state - the child was already selected in handleChildPointerDown
        // so we just need to clean up
        setDragState(null);
      }
    };

    // Listen on window WITHOUT capture phase - this runs AFTER DragHandler's listener
    // If DragHandler handled it, dragState will already be null
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []); // Empty deps - this listener is always active

  // Track if we've already notified parent
  const hasNotifiedRef = useRef(false);

  // Poll each frame until controls are ready - guarantees we capture them
  // This is necessary because refs don't trigger re-renders, so useEffect can't detect when populated
  useFrame(() => {
    if (controlsRef.current && onCameraControlsReady && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      onCameraControlsReady(controlsRef.current);
    }
  });

  // Find recording step and target object
  const recordingStep = useMemo(() => {
    if (!recordingPositionForStepId) return null;
    return steps.find((s) => s.id === recordingPositionForStepId) || null;
  }, [recordingPositionForStepId, steps]);

  const targetObjectId = recordingStep?.targetObjectId;
  const targetObject = useMemo(() => {
    if (!targetObjectId) return null;
    return objects.find((obj) => obj.id === targetObjectId) || null;
  }, [targetObjectId, objects]);

  // Memoize endPosition to avoid unnecessary ghost object recreations
  // Extract the position values as primitives to minimize dependency changes
  const endPosX = recordingStep?.endPosition?.x;
  const endPosY = recordingStep?.endPosition?.y;
  const endPosZ = recordingStep?.endPosition?.z;
  const startPosX = recordingStep?.startPosition?.x;
  const startPosY = recordingStep?.startPosition?.y;
  const startPosZ = recordingStep?.startPosition?.z;
  const endRotX = recordingStep?.endRotation?.x;
  const endRotY = recordingStep?.endRotation?.y;
  const endRotZ = recordingStep?.endRotation?.z;
  const endScaleX = recordingStep?.endScale?.x;
  const endScaleY = recordingStep?.endScale?.y;
  const endScaleZ = recordingStep?.endScale?.z;

  // Update local ref with latest endPosition from state (for use during drag)
  useEffect(() => {
    if (recordingStep?.endPosition) {
      latestEndPositionRef.current = recordingStep.endPosition;
    } else {
      latestEndPositionRef.current = null;
    }
  }, [recordingStep?.endPosition]);

  useEffect(() => {
    if (recordingStep?.endRotation) {
      latestEndRotationRef.current = recordingStep.endRotation;
    } else {
      latestEndRotationRef.current = null;
    }
  }, [recordingStep?.endRotation]);

  useEffect(() => {
    if (recordingStep?.endScale) {
      latestEndScaleRef.current = recordingStep.endScale;
    } else {
      latestEndScaleRef.current = null;
    }
  }, [recordingStep?.endScale]);

  // Get ghost object position - starts at startPosition, updates as user drags it
  // For child targets: ghost object is positioned at the child's world position
  // For parent targets: ghost object is positioned at the parent's position
  const ghostObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;

    // Calculate start position based on whether target is child or parent
    let startPos: { x: number; y: number; z: number };

    if (recordingStep.targetChildPath) {
      // Target is a child - use child's world start position
      // If startPosition is set, use it (it should be the child's world position)
      // Otherwise calculate it from the parent's current transform
      if (startPosX !== undefined && startPosY !== undefined && startPosZ !== undefined) {
        startPos = { x: startPosX, y: startPosY, z: startPosZ };
      } else {
        // Calculate child's world position from parent's current transform
        const childWorldPos = calculateChildWorldPosition(
          targetObject,
          recordingStep.targetChildPath
        );
        startPos = childWorldPos || {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        };
      }
    } else {
      // Target is parent - use parent's start position
      startPos = {
        x: startPosX ?? targetObject.transform.x,
        y: startPosY ?? targetObject.transform.y,
        z: startPosZ ?? targetObject.transform.z,
      };
    }

    // Use ref value from EditorPage if available (latest during drag, updated synchronously),
    // otherwise fall back to state value or local ref
    // This prevents "snap back" during drag when state update hasn't propagated yet
    const editorRefPos =
      latestRecordingEndPositionRef?.current?.stepId === recordingStep.id
        ? latestRecordingEndPositionRef.current.endPosition
        : null;
    const localRefPos = latestEndPositionRef.current;
    const statePos =
      endPosX !== undefined || endPosY !== undefined || endPosZ !== undefined
        ? { x: endPosX ?? startPos.x, y: endPosY ?? startPos.y, z: endPosZ ?? startPos.z }
        : null;

    const ghostPos = editorRefPos || localRefPos || statePos || startPos;

    const baseChild = recordingStep.targetChildPath
      ? findChildByPathString(targetObject, recordingStep.targetChildPath)
      : null;
    const defaultRot = baseChild
      ? {
          x: baseChild.localTransform.rotationX,
          y: baseChild.localTransform.rotationY,
          z: baseChild.localTransform.rotationZ,
        }
      : {
          x: targetObject.transform.rotationX,
          y: targetObject.transform.rotationY,
          z: targetObject.transform.rotationZ,
        };
    const defaultScale = baseChild
      ? {
          x: baseChild.localTransform.scaleX,
          y: baseChild.localTransform.scaleY,
          z: baseChild.localTransform.scaleZ,
        }
      : {
          x: targetObject.transform.scaleX,
          y: targetObject.transform.scaleY,
          z: targetObject.transform.scaleZ,
        };

    const editorRefRot =
      latestRecordingEndPositionRef?.current?.stepId === recordingStep.id
        ? (latestRecordingEndPositionRef.current.endRotation ?? null)
        : null;
    const localRefRot = latestEndRotationRef.current;
    const stateRot =
      endRotX !== undefined || endRotY !== undefined || endRotZ !== undefined
        ? { x: endRotX ?? defaultRot.x, y: endRotY ?? defaultRot.y, z: endRotZ ?? defaultRot.z }
        : null;
    const ghostRot = editorRefRot || localRefRot || stateRot || defaultRot;

    const editorRefScale =
      latestRecordingEndPositionRef?.current?.stepId === recordingStep.id
        ? (latestRecordingEndPositionRef.current.endScale ?? null)
        : null;
    const localRefScale = latestEndScaleRef.current;
    const stateScale =
      endScaleX !== undefined || endScaleY !== undefined || endScaleZ !== undefined
        ? {
            x: endScaleX ?? defaultScale.x,
            y: endScaleY ?? defaultScale.y,
            z: endScaleZ ?? defaultScale.z,
          }
        : null;
    const ghostScale = editorRefScale || localRefScale || stateScale || defaultScale;

    if (recordingStep.targetChildPath) {
      // Child-target recording should move ONLY the child (via its localTransform),
      // not the entire parent object. We achieve this by updating the child's localTransform
      // to place the child at the desired world position (ghostPos).
      const updatedForPos = applyChildWorldPosition(
        targetObject,
        recordingStep.targetChildPath,
        ghostPos
      );
      const updatedForRotScale =
        recordingStep.endRotation || recordingStep.endScale
          ? applyChildLocalTransform(updatedForPos ?? targetObject, recordingStep.targetChildPath, {
              rotationX: ghostRot.x,
              rotationY: ghostRot.y,
              rotationZ: ghostRot.z,
              scaleX: ghostScale.x,
              scaleY: ghostScale.y,
              scaleZ: ghostScale.z,
            })
          : updatedForPos;
      return updatedForRotScale ?? updatedForPos ?? targetObject;
    }

    // For parent targets, use ghost position directly
    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        x: ghostPos.x,
        y: ghostPos.y,
        z: ghostPos.z,
        rotationX: ghostRot.x,
        rotationY: ghostRot.y,
        rotationZ: ghostRot.z,
        scaleX: ghostScale.x,
        scaleY: ghostScale.y,
        scaleZ: ghostScale.z,
      },
    };
  }, [
    targetObject,
    recordingStep,
    // Use primitive values for position to minimize object recreations
    endPosX,
    endPosY,
    endPosZ,
    startPosX,
    startPosY,
    startPosZ,
    endRotX,
    endRotY,
    endRotZ,
    endScaleX,
    endScaleY,
    endScaleZ,
    latestRecordingEndPositionRef,
    latestEndPositionRef,
    latestEndRotationRef,
    latestEndScaleRef,
  ]);

  const actualObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;

    if (recordingStep.targetChildPath) {
      // Child-target recording should keep the parent fixed and place ONLY the child at the
      // recorded start position (world space) by adjusting localTransform.
      const startPos = recordingStep.startPosition ??
        calculateChildWorldPosition(targetObject, recordingStep.targetChildPath) ?? {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        };

      const updated = applyChildWorldPosition(
        targetObject,
        recordingStep.targetChildPath,
        startPos
      );
      return updated ?? targetObject;
    } else {
      // Target is parent - use start position directly
      const startPos = recordingStep.startPosition || {
        x: targetObject.transform.x,
        y: targetObject.transform.y,
        z: targetObject.transform.z,
      };
      return {
        ...targetObject,
        transform: {
          ...targetObject.transform,
          x: startPos.x,
          y: startPos.y,
          z: startPos.z,
        },
      };
    }
  }, [targetObject, recordingStep]);

  // Handle pointer down on object - start potential drag
  // pendingChildPath is used for two-tier selection: when parent is already selected
  // and user clicks on a child, we store the child path but only select it if it's a click (not a drag)
  const handleObjectPointerDown = useCallback(
    (
      e: ThreeEvent<PointerEvent>,
      obj: SceneObject,
      pendingChildPath?: string | null,
      dragChildPath?: string | null
    ) => {
      // Only handle left mouse button
      if (e.nativeEvent.button !== 0) return;

      // In preview mode, handle object clicks differently
      if (previewMode && onPreviewObjectClick) {
        e.stopPropagation();
        e.nativeEvent.stopPropagation();
        onPreviewObjectClick(obj.id);
        return;
      }

      // During recording, only allow dragging the ghost object (target object)
      // For child targets, we need to check both object ID and child path
      if (recordingPositionForStepId && recordingStep) {
        if (obj.id !== targetObjectId) {
          // Disable dragging for non-target objects during recording
          return;
        }
        // If target is a child, we should only allow dragging when that child is selected
        // The drag will update the parent object's transform, which affects the child
        // This is handled by the normal drag logic below
      }

      // Determine if dragging is allowed using the "selection before drag" rule
      const canDrag = calculateCanDrag(selectedParentId, selectedChildPath, obj.id, dragChildPath);

      // Stop pointer events from reaching CameraControls ONLY when we're going to drag.
      // When canDrag=false (clicking on unselected object), let camera controls handle
      // the event so the user can rotate around. We'll still track for click-to-select.
      if (canDrag) {
        // R3F's `e.stopPropagation()` prevents other R3F handlers, but the camera
        // controls also listen at the DOM level.
        e.stopPropagation();
        e.nativeEvent.stopPropagation();
        // `stopImmediatePropagation` is not available on all Event types; guard it.
        (
          e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }
        ).stopImmediatePropagation?.();
      }

      const clickPoint = e.point;

      // Use click point Y for the drag plane - this ensures consistent projection
      // between the initial click and subsequent drag movements
      const groundPlaneY = clickPoint.y;

      // Reset hasMovedRef synchronously before setting drag state
      hasMovedRef.current = false;

      // If dragChildPath is provided, set up drag for that child instead of root
      if (dragChildPath) {
        const child = obj.children?.find((c) => pathToString(c.path) === dragChildPath);
        if (child) {
          // Extract effective world scale from clicked mesh for child dragging
          const clickedMesh = e.object;
          clickedMesh.updateMatrixWorld(true);
          const worldMatrix = clickedMesh.matrixWorld;
          const elements = worldMatrix.elements;
          const childWorldScaleX = Math.sqrt(
            elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]
          );
          const childWorldScaleZ = Math.sqrt(
            elements[8] * elements[8] + elements[9] * elements[9] + elements[10] * elements[10]
          );

          setDragState({
            objectId: obj.id,
            object: obj,
            childPath: dragChildPath, // Set childPath for dragging
            pendingChildPath: pendingChildPath ?? null, // Keep pending for selection on click
            groundPlaneY,
            initialObjectX: child.localTransform.x,
            initialObjectZ: child.localTransform.z,
            initialGrabX: clickPoint.x,
            initialGrabZ: clickPoint.z,
            hasMoved: false,
            startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            childWorldScaleX,
            childWorldScaleZ,
            canDrag,
          });
          return;
        }
      }

      // Default: set up drag for root object
      // During recording, if this is the ghost object, use its current position from recordingStep
      let dragObject = obj;
      let initialX = obj.transform.x;
      let initialZ = obj.transform.z;

      if (recordingPositionForStepId && recordingStep && obj.id === targetObjectId) {
        // This is the ghost object - use its current position from step's endPosition or startPosition
        const startPos = recordingStep.startPosition || {
          x: targetObject?.transform.x || 0,
          y: targetObject?.transform.y || 0,
          z: targetObject?.transform.z || 0,
        };
        const currentPos = recordingStep.endPosition || startPos;
        // Use ghost object's current position for drag initialization
        initialX = currentPos.x;
        initialZ = currentPos.z;
        // Use the ghost object itself (which has the correct current transform)
        if (ghostObject) {
          dragObject = ghostObject;
        }
      }

      setDragState({
        objectId: obj.id,
        object: dragObject,
        pendingChildPath: pendingChildPath ?? null,
        groundPlaneY,
        initialObjectX: initialX,
        initialObjectZ: initialZ,
        initialGrabX: clickPoint.x,
        initialGrabZ: clickPoint.z,
        hasMoved: false,
        startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        canDrag,
      });
    },
    [
      recordingPositionForStepId,
      targetObjectId,
      recordingStep,
      targetObject,
      ghostObject,
      previewMode,
      onPreviewObjectClick,
      selectedParentId,
      selectedChildPath,
    ]
  );

  // Handle pointer down on a child mesh - selects the child and sets up drag state
  const handleChildPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>, obj: SceneObject, childPath: string) => {
      // Only handle left mouse button
      if (e.nativeEvent.button !== 0) return;

      // Stop propagation to prevent camera controls from responding
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      (
        e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }
      ).stopImmediatePropagation?.();

      // Find the child's current local transform
      const child = obj.children?.find((c) => pathToString(c.path) === childPath);
      if (!child) return;

      const clickPoint = e.point;
      const groundPlaneY = clickPoint.y;

      // Get child's current local position (in scene units)
      const initialChildX = child.localTransform.x;
      const initialChildZ = child.localTransform.z;

      // Extract effective world scale from the clicked mesh's world matrix.
      // This accounts for ALL transforms: parent's obj.transform.scale, model preprocessing scale, etc.
      // The world matrix contains position, rotation, and scale. We extract scale by measuring
      // the length of the basis vectors (columns of the upper 3x3 rotation/scale matrix).
      const clickedMesh = e.object;
      clickedMesh.updateMatrixWorld(true); // Ensure matrix is up-to-date
      const worldMatrix = clickedMesh.matrixWorld;

      // Extract scale from world matrix by getting the length of basis vectors
      // X basis vector is elements [0,1,2], Z basis vector is elements [8,9,10]
      const elements = worldMatrix.elements;
      const childWorldScaleX = Math.sqrt(
        elements[0] * elements[0] + elements[1] * elements[1] + elements[2] * elements[2]
      );
      const childWorldScaleZ = Math.sqrt(
        elements[8] * elements[8] + elements[9] * elements[9] + elements[10] * elements[10]
      );

      // Reset hasMovedRef synchronously before setting drag state
      hasMovedRef.current = false;

      // Set up drag state for the child
      // canDrag is true because this handler is only called when clicking on an already-selected child
      setDragState({
        objectId: obj.id,
        object: obj,
        childPath: childPath,
        groundPlaneY,
        initialObjectX: initialChildX,
        initialObjectZ: initialChildZ,
        initialGrabX: clickPoint.x,
        initialGrabZ: clickPoint.z,
        hasMoved: false,
        startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        childWorldScaleX,
        childWorldScaleZ,
        canDrag: true,
      });

      // Select the child
      const childSelectionId = createChildSelectionId(obj.id, childPath);
      onSelectObject(childSelectionId);

      // Adaptive soft focus: handles too close, too far, and comfort zone automatically
      onFocusObject?.(obj, childPath, 'soft');
    },
    [onSelectObject, onFocusObject]
  );

  // Handle drag end - select object if it was just a click
  // Also triggers smart auto-focus when selecting an object (only if camera is far from ideal)
  const handleDragEnd = useCallback(
    (wasDrag: boolean) => {
      if (dragState && !wasDrag) {
        // It was a click, not a drag
        // Check if there's a pending child path (two-tier selection from parent)
        if (dragState.pendingChildPath) {
          // Select the child that was clicked (drilling down from parent selection)
          const childSelectionId = createChildSelectionId(
            dragState.objectId,
            dragState.pendingChildPath
          );
          onSelectObject(childSelectionId);

          // Adaptive soft focus: handles too close, too far, and comfort zone automatically
          onFocusObject?.(dragState.object, dragState.pendingChildPath, 'soft');
        } else if (dragState.childPath) {
          // Already selecting a child directly (sibling navigation or child re-click)
          // The child was already selected in handleChildPointerDown, so just keep it
          // Don't re-select - this prevents accidentally selecting the parent on click release
        } else {
          // No pending child and no current child, select the parent object
          onSelectObject(dragState.objectId);

          // Adaptive soft focus: handles too close, too far, and comfort zone automatically
          // For re-selection of same object, soft focus will naturally do minimal adjustment
          onFocusObject?.(dragState.object, undefined, 'soft');
        }
      }

      // Notify parent that drag ended (for undo/redo batching)
      if (wasDrag && onDragEnd) {
        onDragEnd();
      }

      setDragState(null);

      // If this was an actual drag, prevent camera controls from responding
      // to the pointer up event by keeping them disabled briefly
      if (wasDrag) {
        setIsRecentlyDragged(true);
        // Re-enable camera controls after a short delay to ensure
        // the pointer up event doesn't affect the camera
        setTimeout(() => {
          setIsRecentlyDragged(false);
        }, 50); // 50ms is enough to skip the pointer up frame
      }
    },
    [dragState, onSelectObject, onDragEnd, onFocusObject]
  );

  // Mark the current interaction as a drag (mouse moved beyond threshold)
  const handleMarkAsDrag = useCallback(() => {
    // CRITICAL: Only proceed if this is the FIRST time marking as drag
    // Check BOTH ref and state to handle rapid events before React re-renders
    if (hasMovedRef.current || dragState?.hasMoved) {
      return;
    }

    // Set ref SYNCHRONOUSLY before state update to avoid stale closure issues
    // This ensures handlePointerUp always sees the correct value via hasMovedRef
    hasMovedRef.current = true;

    // If canDrag is false, this is a selection-only interaction (object wasn't selected before).
    // We still track hasMoved for click vs drag distinction, but don't start an actual drag.
    // This allows camera rotation while preventing accidental object movement.
    if (dragState && !dragState.canDrag) {
      // Update state to mark as moved (for click vs drag distinction)
      setDragState((prev) => {
        if (prev && !prev.hasMoved) {
          return { ...prev, hasMoved: true };
        }
        return prev;
      });
      return;
    }

    // Dragging an object = working with that object = select it
    // This ensures consistent UX: any direct manipulation selects the target
    if (dragState) {
      const targetSelectionId = dragState.childPath
        ? createChildSelectionId(dragState.objectId, dragState.childPath)
        : dragState.objectId;

      // Only update selection if it's different from current
      if (targetSelectionId !== selectedObjectId) {
        onSelectObject(targetSelectionId);
      }
    }

    // Call onDragStart SYNCHRONOUSLY *before* any state updates
    // This prevents race conditions where updateObject commands are sent before batching begins
    if (onDragStart) {
      onDragStart();
    }

    // Now update the state (this happens asynchronously)
    setDragState((prev) => {
      if (prev && !prev.hasMoved) {
        return { ...prev, hasMoved: true };
      }
      return prev;
    });
  }, [onDragStart, dragState, selectedObjectId, onSelectObject]);

  // Double-click handler - intentionally a no-op
  // Double-click focus was removed because it conflicts with multi-click child selection
  // Use F key or click in Scene Objects panel to focus instead
  const handleDoubleClick = useCallback((_obj: SceneObject) => {
    // No-op: double-click to focus is disabled
  }, []);

  // Update drag state when object is updated (keep reference fresh)
  // BUT: Only update if we're NOT currently dragging (hasMoved is false means we haven't started dragging yet)
  // During an active drag, we don't want to update dragState.object as it can cause extra updates
  useEffect(() => {
    if (dragState && !dragState.hasMoved) {
      // Only sync object reference before drag starts (when it's still just a click)
      const updatedObj = objects.find((o) => o.id === dragState.objectId);
      if (updatedObj && updatedObj !== dragState.object) {
        setDragState((prev) => (prev ? { ...prev, object: updatedObj } : null));
      }
    }
  }, [objects, dragState]);

  return (
    <>
      {/* Contact shadow debugger - monitors for trail issues in dev mode */}
      {IS_DEV && <ContactShadowDebugger />}

      {/* Enhanced lighting for better model visibility */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 15, 10]} intensity={1.8} />
      <directionalLight position={[-10, 10, -5]} intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={2.0} />
      <pointLight position={[-10, 8, -10]} intensity={1.5} />
      <spotLight position={[0, 20, 0]} angle={0.6} penumbra={0.5} intensity={2.5} />

      {/* Preview Move Item Step - renders outline and handles animation */}
      {previewMode && previewStep?.type === 'move-item' && (
        <PreviewMoveItemStepRenderer
          step={previewStep}
          objects={objects}
          cameraControlsRef={controlsRef}
          isPositioningCameraRef={isPositioningCameraRef}
          shouldAnimate={shouldAnimateMoveItem}
          onTransformUpdate={onPreviewTransformUpdate}
          onComplete={onPreviewStepComplete}
          onPreviewOutlineTargetChange={onPreviewOutlineTargetChange}
        />
      )}

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={35} />

      {/* FixedContactShadows - Custom implementation that explicitly clears render target
          to prevent shadow trail accumulation (independent of EffectComposer settings)
          Scale is matched to GROUND_PLANE_EXTENT for perfect grid alignment
          
          Shadow settings tuned for:
          - Darker, tighter shadow when objects touch ground
          - Shadow dissipates as objects lift off (controlled by 'far')
          - Minimal scattering for clean, focused shadows */}
      <FixedContactShadows
        opacity={0.18}
        scale={GROUND_PLANE_EXTENT * 2}
        blur={1.2}
        far={1.5}
        resolution={1024}
        smooth={true}
        color="#1e293b"
      />

      {/* Fixed-size grid visible from both above and below.
          Grid size matches movement constraint boundary exactly.
          Using args=[width, height] creates a fixed world-space grid.
          
          GridWithNoDepth disables depthWrite to prevent the grid from 
          interfering with the Outline effect's depth comparison. */}
      <GridWithNoDepth
        args={[GROUND_PLANE_EXTENT * 2, GROUND_PLANE_EXTENT * 2]}
        cellSize={1}
        sectionSize={5}
        fadeDistance={GROUND_PLANE_EXTENT}
        fadeStrength={GRID_FADE_STRENGTH}
        sectionColor="#94a3b8"
        cellColor="#cbd5e1"
        sectionThickness={0.8}
        cellThickness={0.4}
        side={THREE.DoubleSide}
      />

      {/* ChildSelectionProvider wraps everything for child outline support */}
      <ChildSelectionProvider>
        {/* Selection context for parent outlines (blue) */}
        <Selection>
          <group>
            {objects.map(
              (obj) =>
                obj.properties.visible &&
                // During recording, don't render the target object normally (we'll render it as actual + ghost)
                !(recordingPositionForStepId && obj.id === targetObjectId) && (
                  <Select
                    key={obj.id}
                    enabled={
                      ((!previewMode && selectedParentId === obj.id) ||
                        (previewMode &&
                          previewOutlineParentId === obj.id &&
                          // If we're outlining a child, avoid also outlining the parent.
                          previewOutlineChildPath === null)) &&
                      // For imported models, only outline parent when no child is selected
                      // (child selection uses emissive highlighting instead)
                      !(obj.properties.modelAssetId && selectedChildPath)
                    }
                  >
                    {obj.properties.modelAssetId ? (
                      <ImportedModel
                        obj={obj}
                        isSelected={selectedParentId === obj.id}
                        selectedChildPath={selectedParentId === obj.id ? selectedChildPath : null}
                        outlinedChildPath={
                          previewMode && previewOutlineParentId === obj.id
                            ? previewOutlineChildPath
                            : null
                        }
                        onPointerDown={handleObjectPointerDown}
                        onChildPointerDown={handleChildPointerDown}
                        onDoubleClick={handleDoubleClick}
                        isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                        isHovered={hoveredObjectId === obj.id}
                        onHoverStart={() => handleHoverStart(obj.id)}
                        onHoverEnd={() => handleHoverEnd(obj.id)}
                      />
                    ) : (
                      <IndustrialPrimitive
                        obj={obj}
                        isSelected={selectedParentId === obj.id}
                        onPointerDown={handleObjectPointerDown}
                        onDoubleClick={handleDoubleClick}
                        isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                        isHovered={hoveredObjectId === obj.id}
                        onHoverStart={() => handleHoverStart(obj.id)}
                        onHoverEnd={() => handleHoverEnd(obj.id)}
                      />
                    )}
                  </Select>
                )
            )}
            {/* Render actual object at start position during recording (non-draggable, very transparent reference) */}
            {recordingPositionForStepId &&
              actualObject &&
              actualObject.properties.visible &&
              (actualObject.properties.modelAssetId ? (
                <ImportedModel
                  key={`actual-${actualObject.id}`}
                  obj={actualObject}
                  isSelected={false}
                  onPointerDown={() => {}} // Disable interaction
                  onDoubleClick={() => {}}
                  isDragging={false}
                  isHovered={false}
                  onHoverStart={() => {}}
                  onHoverEnd={() => {}}
                  isGhost={true}
                  isActualReference={true}
                />
              ) : (
                <IndustrialPrimitive
                  key={`actual-${actualObject.id}`}
                  obj={actualObject}
                  isSelected={false}
                  onPointerDown={() => {}} // Disable interaction
                  onDoubleClick={() => {}}
                  isDragging={false}
                  isHovered={false}
                  onHoverStart={() => {}}
                  onHoverEnd={() => {}}
                  isGhost={true}
                  isActualReference={true}
                />
              ))}
            {/* Render ghost object during recording (draggable) */}
            {recordingPositionForStepId && ghostObject && ghostObject.properties.visible && (
              <Select key={`ghost-${ghostObject.id}`} enabled={selectedParentId === ghostObject.id}>
                {ghostObject.properties.modelAssetId ? (
                  <ImportedModel
                    obj={ghostObject}
                    isSelected={selectedParentId === ghostObject.id}
                    selectedChildPath={
                      selectedParentId === ghostObject.id ? selectedChildPath : null
                    }
                    onPointerDown={handleObjectPointerDown}
                    onChildPointerDown={handleChildPointerDown}
                    onDoubleClick={handleDoubleClick}
                    isDragging={dragState?.objectId === ghostObject.id && dragState.hasMoved}
                    isHovered={hoveredObjectId === ghostObject.id}
                    onHoverStart={() => handleHoverStart(ghostObject.id)}
                    onHoverEnd={() => handleHoverEnd(ghostObject.id)}
                    isGhost={true}
                    highlightOnlyChild={!!recordingStep?.targetChildPath}
                  />
                ) : (
                  <IndustrialPrimitive
                    obj={ghostObject}
                    isSelected={selectedParentId === ghostObject.id}
                    onPointerDown={handleObjectPointerDown}
                    onDoubleClick={handleDoubleClick}
                    isDragging={dragState?.objectId === ghostObject.id && dragState.hasMoved}
                    isHovered={hoveredObjectId === ghostObject.id}
                    onHoverStart={() => handleHoverStart(ghostObject.id)}
                    onHoverEnd={() => handleHoverEnd(ghostObject.id)}
                    isGhost={true}
                  />
                )}
              </Select>
            )}
          </group>

          {/* Post-processing outline effect for parent objects */}
          {previewMode ? <PreviewSelectionOutlineEffect /> : <SelectionOutlineEffect />}
        </Selection>

        {/* Child outline effect - MUST be outside Selection context */}
        {previewMode ? <PreviewChildOutlineEffect /> : <ChildOutlineEffect />}
      </ChildSelectionProvider>

      {/* Transform handles for selected object (height) */}
      {/* During recording, show gizmo for ghost object. Otherwise show for selected object */}
      {!previewMode &&
        ((recordingPositionForStepId && ghostObject && selectedParentId === ghostObject.id) ||
          (!recordingPositionForStepId && selectedObject)) && (
          <TransformGizmo
            object={recordingPositionForStepId && ghostObject ? ghostObject : selectedObject!}
            selectedChildPath={selectedChildPath}
            onUpdateObject={onUpdateObject}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={dragState?.hasMoved ?? false}
          />
        )}

      {/* Premium CameraControls - tuned for beginners */}
      <CameraControls
        ref={controlsRef}
        makeDefault
        // Disable camera controls while a pointer interaction on an object is in-flight.
        // This prevents camera rotate/pan from competing with object click/drag.
        // Exception: when canDrag=false (clicking unselected object), keep camera enabled
        // so the user can rotate around. Selection will still happen on click (not drag).
        // Allow controls to be enabled in preview mode if camera is being positioned
        enabled={
          (!previewMode && (dragState === null || !dragState.canDrag) && !isRecentlyDragged) ||
          (previewMode && isPositioningCameraRef.current)
        }
        // Smooth damping for premium feel - slower for more comfortable camera movements
        smoothTime={0.6}
        draggingSmoothTime={0.2}
        // Comfortable rotation speed for beginner-friendly navigation
        azimuthRotateSpeed={0.35}
        polarRotateSpeed={0.35}
        // Slower panning
        truckSpeed={1.2}
        // Zoom settings - minDistance reduced to allow close zoom on small child objects
        minDistance={0.5}
        maxDistance={60}
        dollySpeed={0.3}
        dollyToCursor={true}
        // Full rotation freedom - no artificial limits
        // Allows looking straight down, and from below the ground plane
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        // Azimuth (horizontal rotation) - unlimited
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        // Touch settings for trackpad/mobile
        touches={{
          one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
          two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
          three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
        }}
        // Mouse button mappings
        mouseButtons={{
          left: CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.DOLLY,
          right: CameraControlsImpl.ACTION.TRUCK,
          wheel: CameraControlsImpl.ACTION.DOLLY,
        }}
      />

      {/* Drag handler for object translation */}
      <DragHandler
        dragState={dragState}
        hasMovedRef={hasMovedRef}
        onUpdateObject={onUpdateObject}
        onDragEnd={handleDragEnd}
        onMarkAsDrag={handleMarkAsDrag}
      />

      {/* Cursor manager for visual feedback */}
      <CursorManager
        isHovering={hoveredObjectId !== null}
        isDragging={dragState?.hasMoved ?? false}
      />

      {/* Keyboard navigation */}
      <KeyboardNavigator
        controlsRef={controlsRef}
        selectedObject={selectedObject}
        selectedChildPath={selectedChildPath}
        onFocusObject={onFocusObject}
      />
    </>
  );
};

// Performance stats type for the monitor
interface PerformanceStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memory: number;
}

interface MainCanvasProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  /** Callback when the Three.js scene is ready (for occlusion-aware focus raycasts) */
  onSceneReady?: (scene: THREE.Scene) => void;
  /** Callback when the WebGL canvas is ready (for thumbnail capture) */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /** Show performance monitor (defaults to true in development) */
  showPerformanceMonitor?: boolean;
  /** Callback when drag operation starts (for undo/redo batching) */
  onDragStart?: () => void;
  /** Callback when drag operation ends (for undo/redo batching) */
  onDragEnd?: () => void;
  /** Step ID for which position is being recorded */
  recordingPositionForStepId?: string | null;
  /** Steps array for finding recording step */
  steps?: SimStep[];
  /** Ref to latest endPosition during recording (updated synchronously to avoid race conditions) */
  latestRecordingEndPositionRef?: React.MutableRefObject<{
    stepId: string;
    endPosition: { x: number; y: number; z: number } | null;
    endRotation?: { x: number; y: number; z: number };
    endScale?: { x: number; y: number; z: number };
  } | null>;
  /** Enable preview mode (disables camera controls, enables preview interactions) */
  previewMode?: boolean;
  /** Current preview step (used for rendering preview-step UI like move-item) */
  previewStep?: SimStep | null;
  /** Callback when object is clicked in preview mode */
  onPreviewObjectClick?: (objectId: string) => void;
  /** Callback when preview move-item step updates object transform (during animation) */
  onPreviewTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  /** Callback when preview move-item step finishes */
  onPreviewStepComplete?: () => void;
  /** Whether move-item animation should start (triggered after clicking target) */
  shouldAnimateMoveItem?: boolean;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  onSceneReady,
  onCanvasReady,
  showPerformanceMonitor = IS_DEV,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  latestRecordingEndPositionRef,
  previewMode = false,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewTransformUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
}) => {
  // Performance monitoring state
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  const [previewOutlineTarget, setPreviewOutlineTarget] = useState<PreviewOutlineTarget | null>(
    null
  );
  // Track if we've notified about canvas being ready
  const hasNotifiedCanvasRef = useRef(false);

  // Memoize the stats handler to prevent unnecessary re-renders
  const handlePerfStats = useCallback((stats: PerformanceStats) => {
    setPerfStats(stats);
  }, []);

  // Handle Canvas onCreate to expose the WebGL canvas element
  const handleCreated = useCallback(
    (state: { gl: THREE.WebGLRenderer }) => {
      if (onCanvasReady && !hasNotifiedCanvasRef.current) {
        hasNotifiedCanvasRef.current = true;
        onCanvasReady(state.gl.domElement);
      }
    },
    [onCanvasReady]
  );

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-slate-100">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]"></div>

      <div className="relative z-10 h-full w-full">
        <Canvas
          shadows
          className="h-full w-full"
          onPointerMissed={() => onSelectObject(null)}
          onCreated={handleCreated}
          // Performance optimizations
          dpr={[1, 2]} // Limit device pixel ratio (1 min, 2 max)
          performance={{ min: 0.5 }} // Allow adaptive performance scaling
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false, // Disable stencil buffer if not needed
            depth: true,
            alpha: true, // Enable transparency for background gradient compositing
            preserveDrawingBuffer: true, // Required for thumbnail capture
          }}
        >
          <SceneContent
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onFocusObject={onFocusObject}
            onCameraControlsReady={onCameraControlsReady}
            onSceneReady={onSceneReady}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            recordingPositionForStepId={recordingPositionForStepId}
            steps={steps}
            latestRecordingEndPositionRef={latestRecordingEndPositionRef}
            previewMode={previewMode}
            previewStep={previewStep}
            onPreviewObjectClick={onPreviewObjectClick}
            onPreviewTransformUpdate={onPreviewTransformUpdate}
            onPreviewStepComplete={onPreviewStepComplete}
            shouldAnimateMoveItem={shouldAnimateMoveItem}
            previewOutlineTarget={previewOutlineTarget}
            onPreviewOutlineTargetChange={setPreviewOutlineTarget}
          />

          {/* Performance monitor (scene component - collects stats) */}
          {showPerformanceMonitor && <PerformanceMonitorScene onStats={handlePerfStats} />}
        </Canvas>
      </div>

      {/* Performance monitor UI (outside canvas) */}
      {showPerformanceMonitor && <PerformanceMonitorUI stats={perfStats} position="top-left" />}
    </div>
  );
};
