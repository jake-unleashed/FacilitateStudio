import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import type { PreviewOutlineTarget } from '../preview/types';
import { createChildSelectionId, parseSelectionId, pathToString, type FocusMode, type SceneObject, type SimStep } from '../../types';
import { isChildPathWithinSubtree } from '../../utils/previewTargeting';
import { DEFAULT_SIMULATION_SETTINGS, type SimulationSettings } from '../../types/simulationSettings';
import { SceneContentView } from './sceneContent/SceneContentView';
import { useRecordingObjects } from './sceneContent/useRecordingObjects';
import { calculateCanDrag } from './sceneContent/dragPolicy';
import {
  getChildPathFromObject,
  stopNativeImmediatePropagation,
} from './sceneContent/pointerEventUtils';
import { usePreviewTargetHover } from './sceneContent/usePreviewTargetHover';
import { useDragStateLifecycle } from './sceneContent/useDragStateLifecycle';
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
  previewSettings?: SimulationSettings;
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

export function SceneContent({
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
  previewSettings = DEFAULT_SIMULATION_SETTINGS,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewTransformUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
  previewOutlineTarget = null,
  onPreviewOutlineTargetChange,
}: SceneContentProps): JSX.Element {
  const controlsRef = useRef<CameraControlsImpl>(null!);
  const isPositioningCameraRef = useRef(false);
  const [isCameraPositioning, setIsCameraPositioning] = useState(false);
  const { invalidate, scene, camera, gl } = useThree();
  const hasNotifiedSceneRef = useRef(false);

  useEffect(() => {
    if (!onSceneReady) return;
    if (hasNotifiedSceneRef.current) return;
    if (!scene) return;
    hasNotifiedSceneRef.current = true;
    onSceneReady(scene);
  }, [onSceneReady, scene]);

  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);
  const selectedParentId = parsedSelection?.objectId ?? null;
  const selectedChildPath = parsedSelection?.childPath ?? null;

  const selectedObject = objects.find((obj) => obj.id === selectedParentId) || null;

  const previewOutlineParentId = previewOutlineTarget?.objectId ?? null;
  const previewOutlineChildPath = previewOutlineTarget?.childPath ?? null;

  useEffect(() => {
    if (previewMode) {
      invalidate();
    }
  }, [previewMode, previewOutlineTarget, invalidate]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredHit, setHoveredHit] = useState<{ objectId: string; childPath: string | null } | null>(null);
  const [isRecentlyDragged, setIsRecentlyDragged] = useState(false);
  const hasMovedRef = useDragStateLifecycle({ dragState, setDragState });

  const handleHoverStart = useCallback((objectId: string, e: ThreeEvent<PointerEvent>) => {
    const hitChildPath = getChildPathFromObject(e.object);
    setHoveredHit({ objectId, childPath: hitChildPath });
  }, []);

  const handleHoverEnd = useCallback((objectId: string) => {
    setHoveredHit((prev) => (prev?.objectId === objectId ? null : prev));
  }, []);

  const hasNotifiedRef = useRef(false);

  useFrame(() => {
    if (controlsRef.current && onCameraControlsReady && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      onCameraControlsReady(controlsRef.current);
    }

    const refValue = isPositioningCameraRef.current;
    if (refValue !== isCameraPositioning) {
      setIsCameraPositioning(refValue);
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
          const clickedChildPathStr = getChildPathFromObject(e.object);

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
        stopNativeImmediatePropagation(e.nativeEvent);
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
      hasMovedRef,
    ]
  );

  const isPreviewTargetHovering = usePreviewTargetHover({
    previewMode,
    previewOutlineParentId,
    previewOutlineChildPath,
    gl,
    camera,
    scene,
  });

  const hoveredObjectId = hoveredHit?.objectId ?? null;
  const isCursorHovering = useMemo(
    () => (previewMode ? isPreviewTargetHovering : hoveredObjectId !== null),
    [previewMode, hoveredObjectId, isPreviewTargetHovering]
  );

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
  }, [hasMovedRef, onDragStart, dragState, selectedObjectId, onSelectObject]);

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
      previewSettings={previewSettings}
      previewStep={previewStep}
      shouldAnimateMoveItem={shouldAnimateMoveItem}
      previewOutlineParentId={previewOutlineParentId}
      previewOutlineChildPath={previewOutlineChildPath}
      onPreviewTransformUpdate={onPreviewTransformUpdate}
      onPreviewStepComplete={onPreviewStepComplete}
      onPreviewOutlineTargetChange={onPreviewOutlineTargetChange}
      controlsRef={controlsRef}
      isPositioningCameraRef={isPositioningCameraRef}
      isCameraPositioning={isCameraPositioning}
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
}

