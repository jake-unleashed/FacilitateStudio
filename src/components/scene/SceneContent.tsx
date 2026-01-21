import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import type { PreviewOutlineTarget } from '../preview/types';
import { createChildSelectionId, parseSelectionId, pathToString, type FocusMode, type SceneObject, type SimStep } from '../../types';
import { isChildPathWithinSubtree } from '../../utils/previewTargeting';
import { SceneContentView } from './sceneContent/SceneContentView';
import { useRecordingObjects } from './sceneContent/useRecordingObjects';
import { calculateCanDrag } from './sceneContent/dragPolicy';
import type { DragState } from './DragHandler';
export interface SceneContentProps {
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

export const SceneContent: React.FC<SceneContentProps> = ({
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
  const controlsRef = useRef<CameraControlsImpl>(null!);
  const isPositioningCameraRef = useRef(false); // Track when camera is being positioned in preview
  const { invalidate, scene, camera, gl } = useThree();
  const hasNotifiedSceneRef = useRef(false);

  // Expose the Three.js scene to parent callers (used for occlusion-aware edit focus).
  useEffect(() => {
    if (!onSceneReady) return;
    if (hasNotifiedSceneRef.current) return;
    if (!scene) return;
    hasNotifiedSceneRef.current = true;
    onSceneReady(scene);
  }, [onSceneReady, scene]);

  // Parse the selection ID to separate parent and child selection
  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);
  const selectedParentId = parsedSelection?.objectId ?? null;
  const selectedChildPath = parsedSelection?.childPath ?? null;

  const selectedObject = objects.find((obj) => obj.id === selectedParentId) || null;

  // Preview outline target parsing (kept separate from selection state)
  const previewOutlineParentId = previewOutlineTarget?.objectId ?? null;
  const previewOutlineChildPath = previewOutlineTarget?.childPath ?? null;

  // Force a render frame when preview outline target changes
  useEffect(() => {
    if (previewMode) {
      invalidate();
    }
  }, [previewMode, previewOutlineTarget, invalidate]);

  // Drag state management
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredHit, setHoveredHit] = useState<{ objectId: string; childPath: string | null } | null>(null);
  const [isRecentlyDragged, setIsRecentlyDragged] = useState(false);
  const [isPreviewTargetHovering, setIsPreviewTargetHovering] = useState(false);

  const previewRaycasterRef = useRef(new THREE.Raycaster());
  const previewPointerNdcRef = useRef(new THREE.Vector2());

  const handleHoverStart = useCallback((objectId: string, e: ThreeEvent<PointerEvent>) => {
    const hitChildPathRaw =
      (e.object as unknown as { userData?: { childPath?: unknown } })?.userData?.childPath;
    const hitChildPath = typeof hitChildPathRaw === 'string' ? hitChildPathRaw : null;
    setHoveredHit({ objectId, childPath: hitChildPath });
  }, []);

  const handleHoverEnd = useCallback((objectId: string) => {
    setHoveredHit((prev) => (prev?.objectId === objectId ? null : prev));
  }, []);

  // Ref to track hasMoved synchronously (avoids stale closure issues in event handlers)
  const hasMovedRef = useRef(false);

  // Keep hasMovedRef in sync with dragState (for cases where state drives re-renders)
  useEffect(() => {
    hasMovedRef.current = dragState?.hasMoved ?? false;
  }, [dragState?.hasMoved]);

  // Ref to store the drag state for use in global pointer up listener
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Global safety listener for pointer up events (see original comments)
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragStateRef.current) {
        setDragState(null);
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  // Track if we've already notified parent
  const hasNotifiedRef = useRef(false);

  // Poll each frame until controls are ready - guarantees we capture them
  useFrame(() => {
    if (controlsRef.current && onCameraControlsReady && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      onCameraControlsReady(controlsRef.current);
    }
  });

  const { recordingStep, targetObjectId, targetObject, ghostObject, actualObject } = useRecordingObjects({
    recordingPositionForStepId,
    steps,
    objects,
    latestRecordingEndPositionRef,
  });

  const handleObjectPointerDown = useCallback(
    (
      e: ThreeEvent<PointerEvent>,
      obj: SceneObject,
      pendingChildPath?: string | null,
      dragChildPath?: string | null
    ) => {
      if (e.nativeEvent.button !== 0) return;

      if (previewMode && onPreviewObjectClick && previewStep?.type === 'move-item') {
        // In preview/published modes, move-item steps should only trigger when the user clicks the
        // intended target. For child targets, that means the clicked mesh must be within the
        // targeted child subtree (including descendants).
        const isTargetObject = previewStep.targetObjectId === obj.id;
        if (!isTargetObject) return;

        const targetChildPath = previewStep.targetChildPath ?? null;
        if (targetChildPath) {
          const clickedChildPath =
            (e.object as unknown as { userData?: { childPath?: unknown } })?.userData?.childPath;
          const clickedChildPathStr = typeof clickedChildPath === 'string' ? clickedChildPath : null;

          const isWithinTargetSubtree = isChildPathWithinSubtree(targetChildPath, clickedChildPathStr);

          if (!isWithinTargetSubtree) return;
        }

        e.stopPropagation();
        e.nativeEvent.stopPropagation();
        onPreviewObjectClick(obj.id);
        return;
      }

      if (recordingPositionForStepId && recordingStep) {
        if (obj.id !== targetObjectId) {
          return;
        }
      }

      const canDrag = calculateCanDrag(selectedParentId, selectedChildPath, obj.id, dragChildPath);

      if (canDrag) {
        e.stopPropagation();
        e.nativeEvent.stopPropagation();
        (e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      }

      const clickPoint = e.point;
      const groundPlaneY = clickPoint.y;
      hasMovedRef.current = false;

      if (dragChildPath) {
        const child = obj.children?.find((c) => pathToString(c.path) === dragChildPath);
        if (child) {
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
            childPath: dragChildPath,
            pendingChildPath: pendingChildPath ?? null,
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

      let dragObject = obj;
      let initialX = obj.transform.x;
      let initialZ = obj.transform.z;

      if (recordingPositionForStepId && recordingStep && obj.id === targetObjectId) {
        const startPos = recordingStep.startPosition || {
          x: targetObject?.transform.x || 0,
          y: targetObject?.transform.y || 0,
          z: targetObject?.transform.z || 0,
        };
        const currentPos = recordingStep.endPosition || startPos;
        initialX = currentPos.x;
        initialZ = currentPos.z;
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
      previewMode,
      onPreviewObjectClick,
      previewStep,
      recordingPositionForStepId,
      recordingStep,
      targetObjectId,
      targetObject,
      ghostObject,
      selectedParentId,
      selectedChildPath,
    ]
  );

  const hoveredObjectId = hoveredHit?.objectId ?? null;
  // Note: childPath is still tracked in hoveredHit for editor hover UX and debugging,
  // but preview/published cursor targeting uses raycasting for reliability.

  // In preview/published, use raycasting against the actual scene to determine whether the
  // cursor is currently over the outlined clickable target. This is more reliable than relying
  // on per-object hover callbacks (which can be affected by overlays and mesh transitions).
  useEffect(() => {
    if (!previewMode) {
      setIsPreviewTargetHovering(false);
      return;
    }

    // Only show pointer when there's a current outlined target (i.e. a clickable move-item step).
    if (!previewOutlineParentId) {
      setIsPreviewTargetHovering(false);
      return;
    }

    const dom = gl.domElement;

    const computeIsHoveringTarget = (event: PointerEvent): boolean => {
      const rect = dom.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      previewPointerNdcRef.current.set(x, y);

      previewRaycasterRef.current.setFromCamera(previewPointerNdcRef.current, camera);
      const intersections = previewRaycasterRef.current.intersectObjects(scene.children, true);

      for (const hit of intersections) {
        const hitSceneObjectId = (hit.object as unknown as { userData?: { sceneObjectId?: unknown } })?.userData
          ?.sceneObjectId;
        if (hitSceneObjectId !== previewOutlineParentId) continue;

        if (!previewOutlineChildPath) return true;

        const hitChildPathRaw =
          (hit.object as unknown as { userData?: { childPath?: unknown } })?.userData?.childPath;
        const hitChildPath = typeof hitChildPathRaw === 'string' ? hitChildPathRaw : null;
        return isChildPathWithinSubtree(previewOutlineChildPath, hitChildPath);
      }

      return false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const next = computeIsHoveringTarget(event);
      setIsPreviewTargetHovering((prev) => (prev === next ? prev : next));
    };

    const handlePointerLeave = () => {
      setIsPreviewTargetHovering(false);
    };

    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [
    previewMode,
    previewOutlineParentId,
    previewOutlineChildPath,
    gl,
    camera,
    scene,
  ]);

  const isCursorHovering = useMemo(() => {
    if (!previewMode) {
      return hoveredObjectId !== null;
    }

    return isPreviewTargetHovering;
  }, [
    previewMode,
    hoveredObjectId,
    isPreviewTargetHovering,
  ]);

  const handleDragEnd = useCallback(
    (wasDrag: boolean) => {
      if (dragState && !wasDrag) {
        if (dragState.pendingChildPath) {
          const childSelectionId = createChildSelectionId(dragState.objectId, dragState.pendingChildPath);
          onSelectObject(childSelectionId);
          onFocusObject?.(dragState.object, dragState.pendingChildPath, 'soft');
        } else if (dragState.childPath) {
          // Keep selection stable.
        } else {
          onSelectObject(dragState.objectId);
          onFocusObject?.(dragState.object, undefined, 'soft');
        }
      }

      if (wasDrag && onDragEnd) {
        onDragEnd();
      }

      setDragState(null);

      if (wasDrag) {
        setIsRecentlyDragged(true);
        setTimeout(() => {
          setIsRecentlyDragged(false);
        }, 50);
      }
    },
    [dragState, onSelectObject, onDragEnd, onFocusObject]
  );

  const handleMarkAsDrag = useCallback(() => {
    if (hasMovedRef.current || dragState?.hasMoved) {
      return;
    }

    hasMovedRef.current = true;

    if (dragState && !dragState.canDrag) {
      setDragState((prev) => {
        if (prev && !prev.hasMoved) {
          return { ...prev, hasMoved: true };
        }
        return prev;
      });
      return;
    }

    if (dragState) {
      const targetSelectionId = dragState.childPath
        ? createChildSelectionId(dragState.objectId, dragState.childPath)
        : dragState.objectId;
      if (targetSelectionId !== selectedObjectId) {
        onSelectObject(targetSelectionId);
      }
    }

    onDragStart?.();

    setDragState((prev) => {
      if (prev && !prev.hasMoved) {
        return { ...prev, hasMoved: true };
      }
      return prev;
    });
  }, [onDragStart, dragState, selectedObjectId, onSelectObject]);

  const handleDoubleClick = useCallback((_obj: SceneObject) => {
    // No-op: double-click to focus is disabled
  }, []);

  useEffect(() => {
    if (dragState && !dragState.hasMoved) {
      const updatedObj = objects.find((o) => o.id === dragState.objectId);
      if (updatedObj && updatedObj !== dragState.object) {
        setDragState((prev) => (prev ? { ...prev, object: updatedObj } : null));
      }
    }
  }, [objects, dragState]);

  return (
    <SceneContentView
      objects={objects}
      selectedParentId={selectedParentId}
      selectedChildPath={selectedChildPath}
      selectedObjectId={selectedObjectId}
      selectedObject={selectedObject}
      previewMode={previewMode}
      previewStep={previewStep}
      shouldAnimateMoveItem={shouldAnimateMoveItem}
      previewOutlineParentId={previewOutlineParentId}
      previewOutlineChildPath={previewOutlineChildPath}
      onPreviewTransformUpdate={onPreviewTransformUpdate}
      onPreviewStepComplete={onPreviewStepComplete}
      onPreviewOutlineTargetChange={onPreviewOutlineTargetChange}
      controlsRef={controlsRef}
      isPositioningCameraRef={isPositioningCameraRef}
      recordingPositionForStepId={recordingPositionForStepId}
      targetObjectId={targetObjectId}
      recordingStep={recordingStep}
      actualObject={actualObject}
      ghostObject={ghostObject}
      dragState={dragState}
      hasMovedRef={hasMovedRef}
      hoveredObjectId={hoveredObjectId}
      isCursorHovering={isCursorHovering}
      isRecentlyDragged={isRecentlyDragged}
      onUpdateObject={onUpdateObject}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onFocusObject={onFocusObject}
      handleObjectPointerDown={handleObjectPointerDown}
      handleDoubleClick={handleDoubleClick}
      handleHoverStart={handleHoverStart}
      handleHoverEnd={handleHoverEnd}
      handleDragEnd={handleDragEnd}
      handleMarkAsDrag={handleMarkAsDrag}
    />
  );
};

