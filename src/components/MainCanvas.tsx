import React, { Suspense, useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { SceneObject, SimStep, parseSelectionId, createChildSelectionId } from '../types';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../constants';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import {
  CameraControls,
  Environment,
  ContactShadows,
  Grid,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { PerformanceMonitorScene, PerformanceMonitorUI } from './PerformanceMonitor';
import { PreviewMoveItemStepRenderer } from './preview/PreviewMoveItemStepRenderer';
import { ImportedModel } from './scene/ImportedModel';
import { BoundingBox } from './scene/BoundingBox';

// Check if we're in development mode (Vite provides this)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV ?? process.env.NODE_ENV === 'development';

// ============================================================================
// Constants
// ============================================================================

/** Minimum distance in pixels before considering it a drag vs a click */
const DRAG_THRESHOLD_PIXELS = 5;

/** Conversion factor from scene units to Three.js world units */
const SCENE_TO_WORLD_SCALE = 100;

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
interface DragState {
  /** ID of the object being dragged */
  objectId: string;
  /** Reference to the scene object being dragged */
  object: SceneObject;
  /** Y-coordinate of the drag plane (set to click point Y for consistent projection) */
  groundPlaneY: number;
  /** Object's starting X position in scene units (before drag began) */
  initialObjectX: number;
  /** Object's starting Z position in scene units (before drag began) */
  initialObjectZ: number;
  /** X-coordinate where user grabbed on the drag plane (world units) */
  initialGrabX: number;
  /** Z-coordinate where user grabbed on the drag plane (world units) */
  initialGrabZ: number;
  /** Whether mouse moved beyond drag threshold (distinguishes click vs drag) */
  hasMoved: boolean;
  /** Initial mouse screen position for threshold calculation */
  startPosition: { x: number; y: number };
}

interface SceneContentProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (obj: SceneObject) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  recordingPositionForStepId?: string | null;
  steps?: SimStep[];
  previewMode?: boolean;
  previewStep?: SimStep | null;
  onPreviewObjectClick?: (objectId: string) => void;
  onPreviewPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
  onPreviewStepComplete?: () => void;
  shouldAnimateMoveItem?: boolean;
}

// Shared geometry instances - created once and reused across all primitives
const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

interface IndustrialPrimitiveProps {
  obj: SceneObject;
  isSelected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, obj: SceneObject) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isGhost?: boolean;
}

const IndustrialPrimitiveInner: React.FC<IndustrialPrimitiveProps> = ({
  obj,
  isSelected,
  onPointerDown,
  onDoubleClick,
  isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const boxMeshRef = useRef<THREE.Mesh>(null);
  const [meshReady, setMeshReady] = useState(false);
  const color = obj.properties.color || '#3b82f6';

  // Ensure BoundingBox can access the mesh ref after mount
  useEffect(() => {
    if (boxMeshRef.current && !meshReady) {
      setMeshReady(true);
    }
  }, [meshReady]);

  // Memoize position array to prevent unnecessary re-renders
  const position = useMemo<[number, number, number]>(
    () => [obj.transform.x / 100, obj.transform.y / 100, -obj.transform.z / 100],
    [obj.transform.x, obj.transform.y, obj.transform.z]
  );

  // Memoize rotation array
  const rotation = useMemo<[number, number, number]>(
    () => [
      THREE.MathUtils.degToRad(obj.transform.rotationX),
      THREE.MathUtils.degToRad(obj.transform.rotationY),
      THREE.MathUtils.degToRad(obj.transform.rotationZ),
    ],
    [obj.transform.rotationX, obj.transform.rotationY, obj.transform.rotationZ]
  );

  // Memoize scale array
  const scale = useMemo<[number, number, number]>(
    () => [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ],
    [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]
  );

  // Memoize event handlers
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onPointerDown(e, obj);
    },
    [onPointerDown, obj]
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onDoubleClick(obj);
    },
    [onDoubleClick, obj]
  );

  const handlePointerEnter = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverStart();
    },
    [onHoverStart]
  );

  const handlePointerLeave = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverEnd();
    },
    [onHoverEnd]
  );

  // Calculate emissive properties
  const emissiveColor = isHovered && !isDragging ? color : '#000000';
  const emissiveIntensity = isHovered && !isDragging ? 0.1 : 0;

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh ref={boxMeshRef} geometry={sharedBoxGeometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.1}
          // eslint-disable-next-line react/no-unknown-property
          emissive={emissiveColor}
          // eslint-disable-next-line react/no-unknown-property
          emissiveIntensity={emissiveIntensity}
          transparent={isGhost}
          opacity={isGhost ? 0.45 : 1.0}
        />
      </mesh>

      {isSelected && meshReady && boxMeshRef.current && (
        <BoundingBox model={boxMeshRef.current} color={color} visible={isSelected} />
      )}
    </group>
  );
};

// Memoized component with custom comparison for optimal re-rendering
const IndustrialPrimitive = memo(IndustrialPrimitiveInner, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.obj.id === nextProps.obj.id &&
    prevProps.obj.transform.x === nextProps.obj.transform.x &&
    prevProps.obj.transform.y === nextProps.obj.transform.y &&
    prevProps.obj.transform.z === nextProps.obj.transform.z &&
    prevProps.obj.transform.rotationX === nextProps.obj.transform.rotationX &&
    prevProps.obj.transform.rotationY === nextProps.obj.transform.rotationY &&
    prevProps.obj.transform.rotationZ === nextProps.obj.transform.rotationZ &&
    prevProps.obj.transform.scaleX === nextProps.obj.transform.scaleX &&
    prevProps.obj.transform.scaleY === nextProps.obj.transform.scaleY &&
    prevProps.obj.transform.scaleZ === nextProps.obj.transform.scaleZ &&
    prevProps.obj.properties.color === nextProps.obj.properties.color &&
    prevProps.obj.properties.visible === nextProps.obj.properties.visible &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered
  );
});

// Cursor manager component - updates document cursor based on hover/drag state
const CursorManager: React.FC<{
  isHovering: boolean;
  isDragging: boolean;
}> = ({ isHovering, isDragging }) => {
  const { gl } = useThree();

  useEffect(() => {
    if (isDragging) {
      gl.domElement.style.cursor = 'grabbing';
    } else if (isHovering) {
      gl.domElement.style.cursor = 'grab';
    } else {
      gl.domElement.style.cursor = 'crosshair';
    }

    return () => {
      gl.domElement.style.cursor = 'crosshair';
    };
  }, [isHovering, isDragging, gl]);

  return null;
};


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
const DragHandler: React.FC<{
  dragState: DragState | null;
  hasMovedRef: React.MutableRefObject<boolean>;
  onUpdateObject: (obj: SceneObject) => void;
  onDragEnd: (wasDrag: boolean) => void;
  onMarkAsDrag: () => void;
}> = ({ dragState, hasMovedRef, onUpdateObject, onDragEnd, onMarkAsDrag }) => {
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
      // Always block events while a pointer is down on an object (even before we
      // cross the drag threshold). This prevents accidental camera movement
      // from small hand jitter on click/drag.
      event.stopPropagation();
      event.preventDefault();

      // Check if we've moved beyond the drag threshold
      const dx = event.clientX - dragState.startPosition.x;
      const dy = event.clientY - dragState.startPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only start actual dragging if we've moved beyond threshold
      if (distance < DRAG_THRESHOLD_PIXELS) return;

      // Mark as a real drag (not just a click)
      // Check BOTH dragState.hasMoved AND hasMovedRef to prevent multiple calls
      // during rapid pointer events before React re-renders
      if (!dragState.hasMoved && !hasMovedRef.current) {
        onMarkAsDrag();
      }

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

        // Apply delta to initial object position (convert from world to scene units)
        // Note: Z is negated because Three.js Z is opposite to scene transform Z
        const newX = dragState.initialObjectX + deltaX * SCENE_TO_WORLD_SCALE;
        const newZ = dragState.initialObjectZ - deltaZ * SCENE_TO_WORLD_SCALE;

        // Update object with new position
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
    };

    const handlePointerUp = (event: PointerEvent) => {
      // Prevent the pointer up event from reaching camera controls
      // This is critical to avoid unwanted camera movement after dragging
      event.stopPropagation();
      event.preventDefault();

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

// Navigation keys that trigger continuous movement
const NAVIGATION_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'q',
  'e',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
]);

// Keyboard navigation component - handles WASD, arrow keys, Q/E, F, Home
const KeyboardNavigator: React.FC<{
  controlsRef: React.RefObject<CameraControlsImpl>;
  selectedObject: SceneObject | null;
  onFocusObject?: (obj: SceneObject) => void;
}> = ({ controlsRef, selectedObject, onFocusObject }) => {
  const keysPressed = useRef<Set<string>>(new Set());
  const { gl, invalidate } = useThree();

  // Pan and rotation speeds
  const PAN_SPEED = 0.08;
  const ROTATE_SPEED = 0.02;

  // Handle keydown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      keysPressed.current.add(key);

      // Focus on selected object (F key) - delegates to onFocusObject for unified focus behavior
      if (key === 'f' && selectedObject && onFocusObject) {
        onFocusObject(selectedObject);
        e.preventDefault();
      }

      // Reset view (Home or 0 key)
      if ((key === 'home' || key === '0') && controlsRef.current) {
        controlsRef.current.setLookAt(...DEFAULT_CAMERA_POSITION, ...DEFAULT_CAMERA_TARGET, true);
        invalidate(); // Trigger re-render for smooth animation
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Capture ref value for cleanup to satisfy exhaustive-deps rule
    const keysPressedRef = keysPressed.current;

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keysPressedRef.clear(); // Clean up on unmount
    };
  }, [gl, selectedObject, controlsRef, invalidate, onFocusObject]);

  // Continuous movement in useFrame for smooth WASD/arrow key navigation
  useFrame(() => {
    if (!controlsRef.current) return;

    const keys = keysPressed.current;

    // Early return if no navigation keys are pressed - saves CPU cycles
    if (keys.size === 0) return;

    // Check if any navigation keys are actually pressed
    let hasNavigationKey = false;
    for (const key of keys) {
      if (NAVIGATION_KEYS.has(key)) {
        hasNavigationKey = true;
        break;
      }
    }
    if (!hasNavigationKey) return;

    const controls = controlsRef.current;

    // Forward/Backward (W/S or Up/Down arrows) - truck forward/back
    if (keys.has('w') || keys.has('arrowup')) {
      controls.forward(PAN_SPEED, false);
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      controls.forward(-PAN_SPEED, false);
    }

    // Left/Right (A/D or Left/Right arrows) - truck left/right
    if (keys.has('a') || keys.has('arrowleft')) {
      controls.truck(-PAN_SPEED, 0, false);
    }
    if (keys.has('d') || keys.has('arrowright')) {
      controls.truck(PAN_SPEED, 0, false);
    }

    // Rotate (Q/E) - azimuth rotation
    if (keys.has('q')) {
      controls.rotate(-ROTATE_SPEED, 0, false);
    }
    if (keys.has('e')) {
      controls.rotate(ROTATE_SPEED, 0, false);
    }
  });

  return null;
};

const SceneContent: React.FC<SceneContentProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onFocusObject,
  onCameraControlsReady,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  previewMode = false,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewPositionUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
}) => {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const isPositioningCameraRef = useRef(false); // Track when camera is being positioned in preview
  
  // Parse the selection ID to separate parent and child selection
  const parsedSelection = useMemo(() => parseSelectionId(selectedObjectId), [selectedObjectId]);
  const selectedParentId = parsedSelection?.objectId ?? null;
  const selectedChildPath = parsedSelection?.childPath ?? null;
  
  const selectedObject = objects.find((obj) => obj.id === selectedParentId) || null;

  // Drag state management
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [isRecentlyDragged, setIsRecentlyDragged] = useState(false);

  // Ref to track hasMoved synchronously (avoids stale closure issues in event handlers)
  const hasMovedRef = useRef(false);

  // Keep hasMovedRef in sync with dragState (for cases where state drives re-renders)
  useEffect(() => {
    hasMovedRef.current = dragState?.hasMoved ?? false;
  }, [dragState?.hasMoved]);

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

  // Get ghost object position (uses endPosition from step) and actual object position (start position)
  const ghostObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;
    // Ghost uses endPosition from step if available, otherwise uses startPosition
    const startPos = recordingStep.startPosition || {
      x: targetObject.transform.x,
      y: targetObject.transform.y,
      z: targetObject.transform.z,
    };
    const ghostPos = recordingStep.endPosition || startPos;
    return {
      ...targetObject,
      transform: {
        ...targetObject.transform,
        x: ghostPos.x,
        y: ghostPos.y,
        z: ghostPos.z,
      },
    };
  }, [targetObject, recordingStep]);

  const actualObject = useMemo(() => {
    if (!targetObject || !recordingStep) return null;
    // Actual object uses start position (locked in place), or current position if no startPosition saved
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
  }, [targetObject, recordingStep]);

  // Handle pointer down on object - start potential drag
  const handleObjectPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>, obj: SceneObject) => {
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
      if (recordingPositionForStepId) {
        if (obj.id !== targetObjectId) {
          // Disable dragging for non-target objects during recording
          return;
        }
      }

      // CRITICAL: Stop the pointerdown from reaching CameraControls.
      // R3F's `e.stopPropagation()` prevents other R3F handlers, but the camera
      // controls also listen at the DOM level.
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      // `stopImmediatePropagation` is not available on all Event types; guard it.
      (
        e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }
      ).stopImmediatePropagation?.();

      const clickPoint = e.point;

      // Use click point Y for the drag plane - this ensures consistent projection
      // between the initial click and subsequent drag movements
      const groundPlaneY = clickPoint.y;

      // Reset hasMovedRef synchronously before setting drag state
      hasMovedRef.current = false;

      setDragState({
        objectId: obj.id,
        object: obj,
        groundPlaneY,
        initialObjectX: obj.transform.x,
        initialObjectZ: obj.transform.z,
        initialGrabX: clickPoint.x,
        initialGrabZ: clickPoint.z,
        hasMoved: false,
        startPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
      });
    },
    [recordingPositionForStepId, targetObjectId, previewMode, onPreviewObjectClick]
  );

  // Handle pointer down on a child mesh - selects the child
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

      // Select the child immediately (clicking a child is always a selection, not a drag)
      const childSelectionId = createChildSelectionId(obj.id, childPath);
      onSelectObject(childSelectionId);
    },
    [onSelectObject]
  );

  // Handle drag end - select object if it was just a click
  const handleDragEnd = useCallback(
    (wasDrag: boolean) => {
      console.log('[DRAG] End - wasDrag:', wasDrag, 'hasMovedRef:', hasMovedRef.current);

      if (dragState && !wasDrag) {
        // It was a click, not a drag - select the object
        onSelectObject(dragState.objectId);
      }

      // Notify parent that drag ended (for undo/redo batching)
      if (wasDrag && onDragEnd) {
        console.log('[DRAG] Calling onDragEnd (endBatch)');
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
    [dragState, onSelectObject, onDragEnd]
  );

  // Mark the current interaction as a drag (mouse moved beyond threshold)
  const handleMarkAsDrag = useCallback(() => {
    // Set ref SYNCHRONOUSLY before state update to avoid stale closure issues
    // This ensures handlePointerUp always sees the correct value via hasMovedRef
    console.log(
      '[DRAG] Mark as drag - hasMovedRef before:',
      hasMovedRef.current,
      'dragState.hasMoved:',
      dragState?.hasMoved
    );

    // CRITICAL: Only proceed if this is the FIRST time marking as drag
    if (hasMovedRef.current || dragState?.hasMoved) {
      console.log('[DRAG] Already marked as drag, skipping');
      return;
    }

    // Set ref SYNCHRONOUSLY
    hasMovedRef.current = true;

    // Call onDragStart SYNCHRONOUSLY *before* any state updates
    // This prevents race conditions where updateObject commands are sent before batching begins
    console.log('[DRAG] Calling onDragStart (beginBatch) SYNCHRONOUSLY');
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
  }, [onDragStart, dragState]);

  // Handle double-click to focus on object
  const handleDoubleClick = useCallback(
    (obj: SceneObject) => {
      if (onFocusObject) {
        onFocusObject(obj);
      }
    },
    [onFocusObject]
  );

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
      {/* Enhanced lighting for better model visibility */}
      <ambientLight intensity={1.2} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <directionalLight position={[10, 15, 10]} intensity={1.8} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={2.0} />
      <pointLight position={[-10, 8, -10]} intensity={1.5} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <spotLight position={[0, 20, 0]} angle={0.6} penumbra={0.5} intensity={2.5} castShadow />

      {/* Preview Move Item Step - renders outline and handles animation */}
      {previewMode && previewStep?.type === 'move-item' && (
        <PreviewMoveItemStepRenderer
          step={previewStep}
          objects={objects}
          cameraControlsRef={controlsRef}
          isPositioningCameraRef={isPositioningCameraRef}
          shouldAnimate={shouldAnimateMoveItem}
          onPositionUpdate={onPreviewPositionUpdate}
          onComplete={onPreviewStepComplete}
        />
      )}

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <PerspectiveCamera makeDefault position={DEFAULT_CAMERA_POSITION} fov={35} />

      <group>
        {objects.map(
          (obj) =>
            obj.properties.visible &&
            // During recording, don't render the target object normally (we'll render it as actual + ghost)
            !(recordingPositionForStepId && obj.id === targetObjectId) &&
            (obj.properties.modelAssetId ? (
              <ImportedModel
                key={obj.id}
                obj={obj}
                isSelected={selectedParentId === obj.id}
                selectedChildPath={selectedParentId === obj.id ? selectedChildPath : null}
                onPointerDown={handleObjectPointerDown}
                onChildPointerDown={handleChildPointerDown}
                onDoubleClick={handleDoubleClick}
                isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                isHovered={hoveredObjectId === obj.id}
                onHoverStart={() => setHoveredObjectId(obj.id)}
                onHoverEnd={() => setHoveredObjectId(null)}
              />
            ) : (
              <IndustrialPrimitive
                key={obj.id}
                obj={obj}
                isSelected={selectedParentId === obj.id}
                onPointerDown={handleObjectPointerDown}
                onDoubleClick={handleDoubleClick}
                isDragging={dragState?.objectId === obj.id && dragState.hasMoved}
                isHovered={hoveredObjectId === obj.id}
                onHoverStart={() => setHoveredObjectId(obj.id)}
                onHoverEnd={() => setHoveredObjectId(null)}
              />
            ))
        )}
        {/* Render actual object at start position during recording (non-draggable) */}
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
            />
          ))}
        {/* Render ghost object during recording (draggable) */}
        {recordingPositionForStepId &&
          ghostObject &&
          ghostObject.properties.visible &&
          (ghostObject.properties.modelAssetId ? (
            <ImportedModel
              key={`ghost-${ghostObject.id}`}
              obj={ghostObject}
              isSelected={selectedParentId === ghostObject.id}
              selectedChildPath={selectedParentId === ghostObject.id ? selectedChildPath : null}
              onPointerDown={handleObjectPointerDown}
              onChildPointerDown={handleChildPointerDown}
              onDoubleClick={handleDoubleClick}
              isDragging={dragState?.objectId === ghostObject.id && dragState.hasMoved}
              isHovered={hoveredObjectId === ghostObject.id}
              onHoverStart={() => setHoveredObjectId(ghostObject.id)}
              onHoverEnd={() => setHoveredObjectId(null)}
              isGhost={true}
            />
          ) : (
            <IndustrialPrimitive
              key={`ghost-${ghostObject.id}`}
              obj={ghostObject}
              isSelected={selectedParentId === ghostObject.id}
              onPointerDown={handleObjectPointerDown}
              onDoubleClick={handleDoubleClick}
              isDragging={dragState?.objectId === ghostObject.id && dragState.hasMoved}
              isHovered={hoveredObjectId === ghostObject.id}
              onHoverStart={() => setHoveredObjectId(ghostObject.id)}
              onHoverEnd={() => setHoveredObjectId(null)}
              isGhost={true}
            />
          ))}
      </group>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.2}
        scale={20}
        blur={2.5}
        far={1}
        resolution={256} // Lower resolution for better performance (default is 512)
        frames={1} // Only render shadow once (static shadows)
      />

      {/* Grid visible from both above and below */}
      <Grid
        infiniteGrid
        fadeDistance={40}
        sectionColor="#94a3b8"
        cellColor="#cbd5e1"
        sectionThickness={1.0}
        cellThickness={0.4}
        side={THREE.DoubleSide}
      />

      {/* Premium CameraControls - tuned for beginners */}
      <CameraControls
        ref={controlsRef}
        makeDefault
        // Disable camera controls while a pointer interaction on an object is in-flight.
        // This prevents camera rotate/pan from competing with object click/drag.
        // Allow controls to be enabled in preview mode if camera is being positioned
        enabled={
          (!previewMode && dragState === null && !isRecentlyDragged) ||
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
        // Zoom settings
        minDistance={3}
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
  onFocusObject?: (obj: SceneObject) => void;
  onCameraControlsReady?: (controls: CameraControlsImpl) => void;
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
  /** Enable preview mode (disables camera controls, enables preview interactions) */
  previewMode?: boolean;
  /** Current preview step (used for rendering preview-step UI like move-item) */
  previewStep?: SimStep | null;
  /** Callback when object is clicked in preview mode */
  onPreviewObjectClick?: (objectId: string) => void;
  /** Callback when preview move-item step updates object position (during animation) */
  onPreviewPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
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
  onCanvasReady,
  showPerformanceMonitor = IS_DEV,
  onDragStart,
  onDragEnd,
  recordingPositionForStepId,
  steps = [],
  previewMode = false,
  previewStep = null,
  onPreviewObjectClick,
  onPreviewPositionUpdate,
  onPreviewStepComplete,
  shouldAnimateMoveItem = false,
}) => {
  // Performance monitoring state
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
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
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            recordingPositionForStepId={recordingPositionForStepId}
            steps={steps}
            previewMode={previewMode}
            previewStep={previewStep}
            onPreviewObjectClick={onPreviewObjectClick}
            onPreviewPositionUpdate={onPreviewPositionUpdate}
            onPreviewStepComplete={onPreviewStepComplete}
            shouldAnimateMoveItem={shouldAnimateMoveItem}
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
