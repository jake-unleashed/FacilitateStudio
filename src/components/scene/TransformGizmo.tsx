/**
 * TransformGizmo Component
 *
 * Floating handles for object manipulation in 3D space:
 * - Height Handle: Drag up/down to adjust Y position (world-space)
 * - XZ Handle: Drag to move object on the ground plane (uses raycasting for 1:1 movement)
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

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { ArrowUpDown, Move } from 'lucide-react';
import * as THREE from 'three';

import { SceneObject, ChildMesh, pathToString } from '../../types';
import { findChildByPath } from '../../utils/modelLoaders';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Props for the main TransformGizmo component */
export interface TransformGizmoProps {
  /** The scene object to manipulate */
  object: SceneObject;
  /** Path string identifying the selected child mesh (null if parent is selected) */
  selectedChildPath: string | null;
  /** Callback when object is updated */
  onUpdateObject: (obj: SceneObject) => void;
  /** Called when drag operation starts (for undo batching) */
  onDragStart?: () => void;
  /** Called when drag operation ends (for undo batching) */
  onDragEnd?: () => void;
  /** Whether the object is currently being dragged directly (hides gizmo) */
  isDragging?: boolean;
}

/** Shared props for handle components */
interface BaseHandleProps {
  onDragStart: () => void;
  onDragEnd: () => void;
  camera: THREE.Camera;
  gl: THREE.WebGLRenderer;
}

/** Props specific to HeightHandle */
interface HeightHandleProps extends BaseHandleProps {
  /** Current height value in internal units */
  value: number;
  /** Callback when height changes */
  onChange: (value: number) => void;
  /** World position for screen-space calculations */
  worldPosition: THREE.Vector3;
  /** Parent scale factor (used for children when childMesh is not available) */
  scaleFactor: number;
  /** Three.js mesh for child - used to extract effective world scale */
  childMesh: THREE.Object3D | null;
}

/** Props specific to XZHandle */
interface XZHandleProps extends BaseHandleProps {
  /** The parent scene object */
  object: SceneObject;
  /** Selected child data (null if parent is selected) */
  selectedChild: ChildMesh | null;
  /** Path string for selected child */
  selectedChildPath: string | null;
  /** Callback when object is updated */
  onUpdateObject: (obj: SceneObject) => void;
  /** World position of the object center for raycasting */
  objectWorldPosition: THREE.Vector3;
  /** Three.js mesh for child - used to extract effective world scale */
  childMesh: THREE.Object3D | null;
}

/** Tooltip component props */
interface TooltipProps {
  text: string;
  visible: boolean;
}

/** Internal drag state for height handle */
interface HeightDragState {
  startMouseY: number;
  initialValue: number;
  pixelsPerInternalUnit: number;
  hasMoved: boolean;
}

/** Internal drag state for XZ handle */
interface XZDragState {
  groundPlaneY: number;
  initialGrabX: number;
  initialGrabZ: number;
  initialObjectX: number;
  initialObjectZ: number;
  childWorldScaleX?: number;
  childWorldScaleZ?: number;
  hasMoved: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Gap between object bounding box and gizmo (in world units) */
const GIZMO_GAP = 0.45;

/** Minimum vertical spacing between handles to avoid overlap (in world units) */
const MIN_HANDLE_SPACING = 0.4;

/** Default vertical offset for XZ handle below height handle (in world units) */
const XZ_HANDLE_OFFSET = 0.35;

/** Minimum camera distance to show gizmo */
const MIN_CAMERA_DISTANCE = 1;

/** Maximum camera distance to show gizmo */
const MAX_CAMERA_DISTANCE = 50;

/** Conversion factor: internal units to world units (100 internal = 1 world) */
const INTERNAL_TO_WORLD = 100;

/** Delay before showing hover tooltip (ms) */
const TOOLTIP_HOVER_DELAY = 400;

/** Duration to show click tooltip (ms) */
const TOOLTIP_CLICK_DURATION = 2000;

/** Minimum drag threshold in pixels to register movement */
const DRAG_THRESHOLD_PX = 3;

/** Minimum XZ world movement to register as drag */
const XZ_DRAG_THRESHOLD = 0.001;

/** Height value constraints */
const HEIGHT_MIN = 0;
const HEIGHT_MAX = 500;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Finds a child mesh data object by its path string
 */
function findChildDataByPath(children: ChildMesh[] | undefined, pathStr: string): ChildMesh | null {
  if (!children) return null;

  for (const child of children) {
    if (pathToString(child.path) === pathStr) {
      return child;
    }
  }
  return null;
}

/**
 * Finds a Three.js object in the scene by its custom objectId userData property
 */
function findObjectGroupInScene(scene: THREE.Scene, objectId: string): THREE.Object3D | null {
  let result: THREE.Object3D | null = null;

  scene.traverse((obj) => {
    if (obj.userData?.objectId === objectId) {
      result = obj;
    }
  });

  return result;
}

/**
 * Traverses a group to find the actual loaded model
 * (handles nested group structures from model loaders)
 */
function findModelInGroup(group: THREE.Object3D): THREE.Object3D | null {
  if (group.children.length === 0) {
    return group;
  }

  const firstChild = group.children[0];

  // If first child is a mesh, the group itself contains the model
  if (firstChild instanceof THREE.Mesh) {
    return group;
  }

  // If first child is a group, dive deeper
  if (firstChild instanceof THREE.Group && firstChild.children.length > 0) {
    return firstChild.children[0] ?? null;
  }

  return group;
}

/**
 * Extracts the scale component from a world matrix for a given axis
 * @param matrix - The world matrix to extract from
 * @param axis - 'x' | 'y' | 'z'
 * @returns The scale value for that axis
 */
function extractScaleFromMatrix(matrix: THREE.Matrix4, axis: 'x' | 'y' | 'z'): number {
  const elements = matrix.elements;

  // Matrix columns for each axis basis vector:
  // X: [0,1,2], Y: [4,5,6], Z: [8,9,10]
  const offsets = { x: 0, y: 4, z: 8 };
  const offset = offsets[axis];

  return Math.sqrt(
    elements[offset] * elements[offset] +
      elements[offset + 1] * elements[offset + 1] +
      elements[offset + 2] * elements[offset + 2]
  );
}

/**
 * Clamps a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Tooltip Component
// ============================================================================

const Tooltip = memo<TooltipProps>(function Tooltip({ text, visible }) {
  if (!visible) return null;

  return (
    <div
      className="animate-in fade-in pointer-events-none absolute left-1/2
                 top-12 -translate-x-1/2 whitespace-nowrap rounded-lg
                 bg-slate-800/95 px-3 py-1.5
                 text-xs font-medium
                 text-white
                 shadow-lg backdrop-blur-md duration-150"
      style={{ zIndex: 1000 }}
    >
      {text}
      <div
        className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 
                   rotate-45 bg-slate-800/95"
      />
    </div>
  );
});

// ============================================================================
// Custom Hook: useTooltip
// ============================================================================

interface UseTooltipReturn {
  showTooltip: boolean;
  tooltipText: string;
  handlePointerEnter: () => void;
  handlePointerLeave: () => void;
  showClickTooltip: (text: string) => void;
  hideTooltip: () => void;
}

/**
 * Hook for managing tooltip visibility with hover delay and click behavior
 */
function useTooltip(hoverText: string, isDragging: boolean): UseTooltipReturn {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipText, setTooltipText] = useState('');

  const hoverTimeoutRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handlePointerEnter = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!isDragging) {
        setTooltipText(hoverText);
        setShowTooltip(true);
      }
    }, TOOLTIP_HOVER_DELAY);
  }, [hoverText, isDragging]);

  const handlePointerLeave = useCallback(() => {
    setShowTooltip(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const showClickTooltip = useCallback((text: string) => {
    setTooltipText(text);
    setShowTooltip(true);
    clickTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
    }, TOOLTIP_CLICK_DURATION);
  }, []);

  const hideTooltip = useCallback(() => {
    setShowTooltip(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  return {
    showTooltip,
    tooltipText,
    handlePointerEnter,
    handlePointerLeave,
    showClickTooltip,
    hideTooltip,
  };
}

// ============================================================================
// Handle Button Styling
// ============================================================================

/**
 * Generates CSS classes for handle button based on state
 */
function getHandleClasses(isDragging: boolean, isHovered: boolean): string {
  const baseClasses = `
    flex items-center justify-center
    w-10 h-10 rounded-2xl
    bg-white/90 text-slate-500
    border border-white/60
    backdrop-blur-xl
    transition-all duration-150 ease-out
    cursor-grab active:cursor-grabbing
    select-none
    hover:text-slate-700
  `;

  if (isDragging) {
    return `${baseClasses} scale-95 ring-2 ring-blue-400 shadow-md`;
  }
  if (isHovered) {
    return `${baseClasses} scale-110 bg-white shadow-xl`;
  }
  return `${baseClasses} shadow-lg`;
}

// ============================================================================
// Height Handle Component
// ============================================================================

const HeightHandle = memo<HeightHandleProps>(function HeightHandle({
  value,
  onChange,
  onDragStart,
  onDragEnd,
  camera,
  gl,
  worldPosition,
  scaleFactor,
  childMesh,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<HeightDragState | null>(null);

  const tooltip = useTooltip('Drag up/down to adjust height', isDragging);

  /**
   * Calculates the effective Y scale accounting for child mesh world transform
   */
  const getEffectiveScaleY = useCallback((): number => {
    if (childMesh) {
      childMesh.updateMatrixWorld(true);
      return extractScaleFromMatrix(childMesh.matrixWorld, 'y');
    }
    return scaleFactor;
  }, [childMesh, scaleFactor]);

  /**
   * Calculates how many pixels correspond to one internal unit of height change
   */
  const calculatePixelsPerInternalUnit = useCallback((): number => {
    const rect = gl.domElement.getBoundingClientRect();
    const effectiveScaleY = getEffectiveScaleY();
    const worldUnitsPerInternalUnit = (1 / INTERNAL_TO_WORLD) * effectiveScaleY;

    // Project two points separated by one internal unit of world height
    const pos1 = worldPosition.clone().project(camera);
    const pos2 = worldPosition
      .clone()
      .add(new THREE.Vector3(0, worldUnitsPerInternalUnit, 0))
      .project(camera);

    const screenY1 = ((-pos1.y + 1) / 2) * rect.height;
    const screenY2 = ((-pos2.y + 1) / 2) * rect.height;

    return Math.abs(screenY1 - screenY2) || 1;
  }, [camera, gl, worldPosition, getEffectiveScaleY]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      tooltip.hideTooltip();

      const pixelsPerInternalUnit = calculatePixelsPerInternalUnit();

      setIsDragging(true);
      dragStateRef.current = {
        startMouseY: e.clientY,
        initialValue: value,
        pixelsPerInternalUnit,
        hasMoved: false,
      };
      onDragStart();
    },
    [value, calculatePixelsPerInternalUnit, onDragStart, tooltip]
  );

  // Handle drag movement and release
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const screenDeltaY = state.startMouseY - e.clientY;

      // Check if movement exceeds threshold
      if (Math.abs(screenDeltaY) > DRAG_THRESHOLD_PX) {
        state.hasMoved = true;
      }

      if (!state.hasMoved) return;

      // Convert screen delta to internal units
      const internalDelta = screenDeltaY / state.pixelsPerInternalUnit;
      const newHeight = clamp(state.initialValue + internalDelta, HEIGHT_MIN, HEIGHT_MAX);
      onChange(newHeight);
    };

    const handlePointerUp = () => {
      const hasMoved = dragStateRef.current?.hasMoved ?? false;

      if (hasMoved) {
        onDragEnd();
      } else {
        tooltip.showClickTooltip('Hold and drag to adjust');
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
  }, [isDragging, onChange, onDragEnd, tooltip]);

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
        aria-label="Height - drag up or down to adjust"
        data-testid="handle-height"
      >
        <ArrowUpDown size={20} strokeWidth={2.5} />
      </div>
      <Tooltip text={tooltip.tooltipText} visible={tooltip.showTooltip} />
    </div>
  );
});

// ============================================================================
// XZ Handle Component - Uses raycasting for true 1:1 movement
// ============================================================================

const XZHandle = memo<XZHandleProps>(function XZHandle({
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

      if (selectedChild && selectedChildPath) {
        // Child movement: account for effective world scale
        const effectiveScaleX = state.childWorldScaleX || 1;
        const effectiveScaleZ = state.childWorldScaleZ || 1;

        const newX = state.initialObjectX + (deltaX / effectiveScaleX) * INTERNAL_TO_WORLD;
        const newZ = state.initialObjectZ - (deltaZ / effectiveScaleZ) * INTERNAL_TO_WORLD;

        const updatedChildren = object.children?.map((child) => {
          if (pathToString(child.path) === selectedChildPath) {
            return {
              ...child,
              localTransform: { ...child.localTransform, x: newX, z: newZ },
            };
          }
          return child;
        });

        onUpdateObject({ ...object, children: updatedChildren });
      } else {
        // Parent movement
        const newX = state.initialObjectX + deltaX * INTERNAL_TO_WORLD;
        const newZ = state.initialObjectZ - deltaZ * INTERNAL_TO_WORLD;

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
  }, [
    isDragging,
    object,
    selectedChild,
    selectedChildPath,
    onUpdateObject,
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
      <Tooltip text={tooltip.tooltipText} visible={tooltip.showTooltip} />
    </div>
  );
});

// ============================================================================
// Main TransformGizmo Component
// ============================================================================

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

  // State for handle positions and visibility
  const [isVisible, setIsVisible] = useState(true);
  const [heightHandlePosition, setHeightHandlePosition] = useState<[number, number, number]>([
    0, 0, 0,
  ]);
  const [xzHandlePosition, setXZHandlePosition] = useState<[number, number, number]>([0, 0, 0]);

  // State for current transform values
  const [currentHeight, setCurrentHeight] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [childMesh, setChildMesh] = useState<THREE.Object3D | null>(null);

  // Refs for position tracking (avoid re-renders in frame loop)
  const heightPositionRef = useRef(new THREE.Vector3());
  const xzPositionRef = useRef(new THREE.Vector3());
  const objectWorldPositionRef = useRef(new THREE.Vector3());
  const lastHeightPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastXZPosRef = useRef<[number, number, number]>([0, 0, 0]);

  // Reusable Three.js objects (avoid allocations in frame loop)
  const boxRef = useRef(new THREE.Box3());
  const centerRef = useRef(new THREE.Vector3());

  // Find the selected child data if a child path is provided
  const selectedChild = selectedChildPath
    ? findChildDataByPath(object.children, selectedChildPath)
    : null;

  /**
   * Updates handle positions each frame based on object bounding box
   */
  useFrame(() => {
    const objectGroup = findObjectGroupInScene(scene, object.id);

    // Fallback positioning when object group not found
    if (!objectGroup) {
      const x = object.transform.x / INTERNAL_TO_WORLD;
      let heightY = object.transform.y / INTERNAL_TO_WORLD + 0.5;
      const z = -object.transform.z / INTERNAL_TO_WORLD;

      let xzY = heightY - XZ_HANDLE_OFFSET;

      // Apply overlap avoidance
      const verticalDistance = Math.abs(heightY - xzY);
      if (verticalDistance < MIN_HANDLE_SPACING) {
        const halfSeparation = (MIN_HANDLE_SPACING - verticalDistance) / 2;
        heightY += halfSeparation;
        xzY -= halfSeparation;
      }

      heightPositionRef.current.set(x, heightY, z);
      xzPositionRef.current.set(x, xzY, z);
      setHeightHandlePosition([x, heightY, z]);
      setXZHandlePosition([x, xzY, z]);
      setCurrentHeight(object.transform.y);
      setScaleFactor(1);
      setChildMesh(null);
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

      heightValue = selectedChild.localTransform.y;
      currentScaleFactor = object.transform.scaleY;
    }

    // Calculate bounding box
    const box = boxRef.current;
    box.setFromObject(targetObject);

    if (!box.isEmpty()) {
      const center = centerRef.current;
      box.getCenter(center);

      // Store world position for XZ handle raycasting
      objectWorldPositionRef.current.copy(center);

      // Calculate handle positions
      const heightX = box.max.x + GIZMO_GAP;
      let heightY = center.y;
      const heightZ = center.z;

      const xzX = heightX;
      let xzY = heightY - XZ_HANDLE_OFFSET;
      const xzZ = heightZ;

      // Apply overlap avoidance
      const verticalDistance = Math.abs(heightY - xzY);
      if (verticalDistance < MIN_HANDLE_SPACING) {
        const halfSeparation = (MIN_HANDLE_SPACING - verticalDistance) / 2;
        heightY += halfSeparation;
        xzY -= halfSeparation;
      }

      // Update height handle position (with change detection)
      const heightPos: [number, number, number] = [heightX, heightY, heightZ];
      if (
        Math.abs(heightX - lastHeightPosRef.current[0]) > 0.001 ||
        Math.abs(heightY - lastHeightPosRef.current[1]) > 0.001 ||
        Math.abs(heightZ - lastHeightPosRef.current[2]) > 0.001
      ) {
        lastHeightPosRef.current = heightPos;
        heightPositionRef.current.set(heightX, heightY, heightZ);
        setHeightHandlePosition(heightPos);
      }

      // Update XZ handle position (with change detection)
      const xzPos: [number, number, number] = [xzX, xzY, xzZ];
      if (
        Math.abs(xzX - lastXZPosRef.current[0]) > 0.001 ||
        Math.abs(xzY - lastXZPosRef.current[1]) > 0.001 ||
        Math.abs(xzZ - lastXZPosRef.current[2]) > 0.001
      ) {
        lastXZPosRef.current = xzPos;
        xzPositionRef.current.set(xzX, xzY, xzZ);
        setXZHandlePosition(xzPos);
      }
    }

    // Update state values (with change detection)
    if (currentHeight !== heightValue) setCurrentHeight(heightValue);
    if (scaleFactor !== currentScaleFactor) setScaleFactor(currentScaleFactor);
    if (childMesh !== foundChildMesh) setChildMesh(foundChildMesh);

    // Check visibility based on camera distance
    const distance = camera.position.distanceTo(objectWorldPositionRef.current);
    const shouldBeVisible = distance > MIN_CAMERA_DISTANCE && distance < MAX_CAMERA_DISTANCE;
    if (shouldBeVisible !== isVisible) {
      setIsVisible(shouldBeVisible);
    }
  });

  /**
   * Handles height value changes from the height handle
   */
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (selectedChild && selectedChildPath) {
        // Update child's local transform
        const updatedChildren = object.children?.map((child) => {
          if (pathToString(child.path) === selectedChildPath) {
            return {
              ...child,
              localTransform: { ...child.localTransform, y: newHeight },
            };
          }
          return child;
        });

        onUpdateObject({ ...object, children: updatedChildren });
      } else {
        // Update parent's transform
        onUpdateObject({
          ...object,
          transform: { ...object.transform, y: newHeight },
        });
      }
    },
    [object, selectedChild, selectedChildPath, onUpdateObject]
  );

  const handleDragStart = useCallback(() => {
    onDragStart?.();
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  // Hide gizmo when object is being dragged directly or camera is out of range
  if (!isVisible || isDragging) {
    return null;
  }

  return (
    <>
      {/* Height Handle */}
      <group position={heightHandlePosition}>
        <Html
          center
          sprite
          transform={false}
          occlude={false}
          style={{ pointerEvents: 'auto', userSelect: 'none' }}
        >
          <div data-testid="transform-gizmo-height" onPointerDown={(e) => e.stopPropagation()}>
            <HeightHandle
              value={currentHeight}
              onChange={handleHeightChange}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              camera={camera}
              gl={gl}
              worldPosition={heightPositionRef.current}
              scaleFactor={scaleFactor}
              childMesh={childMesh}
            />
          </div>
        </Html>
      </group>

      {/* XZ Handle */}
      <group position={xzHandlePosition}>
        <Html
          center
          sprite
          transform={false}
          occlude={false}
          style={{ pointerEvents: 'auto', userSelect: 'none' }}
        >
          <div data-testid="transform-gizmo-xz" onPointerDown={(e) => e.stopPropagation()}>
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
