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
import { ArrowUpDown, Move, ArrowLeftRight } from 'lucide-react';
import * as THREE from 'three';

import { SceneObject, ChildMesh, pathToString } from '../../types';
import { findChildByPath } from '../../utils/modelLoaders';
import { calculateLowestPointOffset } from '../../utils/groundHeight';
import { XZ_BOUNDARY_INTERNAL, INTERNAL_TO_WORLD } from '../../constants';

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
  /** Whether the object is currently being dragged directly (disables smoothing for 1:1 movement) */
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
  /** Current Y position in internal units */
  value: number;
  /** Current lowest point of mesh in world Y coordinates (from bounding box) */
  minWorldY: number;
  /** Callback when Y position changes */
  onChange: (value: number) => void;
  /** World position for screen-space calculations */
  worldPosition: THREE.Vector3;
  /** Parent scale factor (used for children when childMesh is not available) */
  scaleFactor: number;
  /** Three.js mesh for child - used to extract effective world scale */
  childMesh: THREE.Object3D | null;
  /**
   * Whether this handle is editing a child object.
   *
   * When true, allows negative Y values because a child's localTransform.y = 0
   * represents its default position within the model (not ground level).
   * To move a child down to ground level, localTransform.y may need to be negative.
   *
   * The ground constraint (minWorldY >= 0) still applies to prevent going below ground.
   */
  isChild?: boolean;
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
  /** Initial Y value (internal units) when drag started */
  initialValue: number;
  /** Initial minWorldY when drag started (for ground constraint) */
  initialMinWorldY: number;
  /** World units per internal unit (for converting drag delta to world space) */
  worldUnitsPerInternalUnit: number;
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

/** Internal drag state for Left/Right handle (side view mode) */
interface LeftRightDragState {
  /** Starting mouse X position in screen space */
  startMouseX: number;
  /** The camera right vector at drag start (locked for consistent movement) */
  moveDirection: THREE.Vector3;
  /** Pixels per world unit (for screen-to-world conversion) */
  pixelsPerWorldUnit: number;
  /** Initial object X position in internal units */
  initialObjectX: number;
  /** Initial object Z position in internal units */
  initialObjectZ: number;
  /** Child world scale factors */
  childWorldScaleX?: number;
  childWorldScaleZ?: number;
  /** Whether movement threshold exceeded */
  hasMoved: boolean;
}

/** Props specific to LeftRightHandle */
interface LeftRightHandleProps extends BaseHandleProps {
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
  /** Current camera right vector for movement direction */
  cameraRight: THREE.Vector3;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Target screen-space pixel gap between object bounding box edge and handles.
 * This ensures consistent visual spacing regardless of camera zoom level.
 * ~30-40px provides comfortable separation from the object.
 */
const HANDLE_GAP_PIXELS = 35;

/**
 * Target screen-space pixel distance between height and XZ handles.
 * This ensures consistent visual spacing regardless of camera zoom level.
 * ~60-70px provides comfortable separation at typical viewing distances.
 */
const HANDLE_SPACING_PIXELS = 65;

/** Delay before showing hover tooltip (ms) */
const TOOLTIP_HOVER_DELAY = 400;

/** Duration to show click tooltip (ms) */
const TOOLTIP_CLICK_DURATION = 2000;

/** Minimum drag threshold in pixels to register movement */
const DRAG_THRESHOLD_PX = 3;

/** Minimum XZ world movement to register as drag */
const XZ_DRAG_THRESHOLD = 0.001;

/**
 * Lerp factor for smooth handle positioning (0-1).
 * Lower = smoother/slower, Higher = snappier/faster.
 * 0.08 provides a premium, smooth feel without feeling laggy.
 */
const POSITION_LERP_FACTOR = 0.08;

/**
 * Lerp factor for smoothing source data (object center, offset distance).
 * This eliminates jitter from bounding box fluctuations on complex models.
 * Higher than position lerp to stay responsive while smoothing input noise.
 */
const SOURCE_SMOOTHING_FACTOR = 0.15;

/**
 * Height value constraints (in internal units, where 100 = 1 world unit/meter).
 *
 * HEIGHT_MIN: Minimum Y value for ROOT objects only. Child objects can have
 * negative localTransform.y values to move below their default position within
 * the model (while still respecting ground constraint).
 *
 * HEIGHT_MAX: Maximum Y value (500 internal units = 5 meters above ground).
 */
const HEIGHT_MIN = 0;
const HEIGHT_MAX = 500;

/**
 * Pitch angle thresholds for view mode detection (in degrees).
 * - Side view: pitch < SIDE_VIEW_THRESHOLD (looking horizontally)
 * - Top-down view: pitch > TOPDOWN_VIEW_THRESHOLD (looking straight down/up)
 * - Isometric: everything in between
 *
 * SIDE_VIEW_THRESHOLD is narrow (~12°) so the side-to-side handle only appears
 * when viewing approximately horizontally (e.g. from the side of an object).
 */
const SIDE_VIEW_THRESHOLD = 12;
const TOPDOWN_VIEW_THRESHOLD = 55;

/**
 * Hysteresis values to prevent mode flickering at boundaries.
 * Enter a mode at the threshold, but don't exit until past threshold + hysteresis.
 */
const VIEW_MODE_HYSTERESIS = 2;

// ============================================================================
// Types
// ============================================================================

/** View modes for context-aware handle display */
type ViewMode = 'isometric' | 'side' | 'topdown';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate bounding box only from meshes with actual geometry.
 * This excludes empty transforms, cameras, lights, and other non-renderable objects
 * that may have positions but no visible geometry.
 *
 * @param obj - The Three.js object to calculate bounds for
 * @returns A Box3 containing only the bounds of visible geometry
 */
function calculateVisibleBounds(obj: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      if (posAttr && posAttr.count > 0) {
        child.geometry.computeBoundingBox();
        const geomBox = child.geometry.boundingBox;
        if (geomBox && !geomBox.isEmpty()) {
          const worldBox = geomBox.clone();
          worldBox.applyMatrix4(child.matrixWorld);
          box.union(worldBox);
        }
      }
    }
  });

  return box;
}

/**
 * Calculate volume-weighted center from meshes with actual geometry.
 * This gives more weight to larger meshes (main body) and less to tiny parts (screws).
 * Useful for positioning gizmos at the visual center of a model rather than at
 * the mathematical center of the bounding box (which can be skewed by outliers).
 *
 * @param obj - The Three.js object to calculate the weighted center for
 * @returns A Vector3 representing the volume-weighted center position
 */
function calculateWeightedCenter(obj: THREE.Object3D): THREE.Vector3 {
  let totalVolume = 0;
  const weightedSum = new THREE.Vector3();
  obj.updateMatrixWorld(true);

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      if (posAttr && posAttr.count > 0) {
        child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox;
        if (box && !box.isEmpty()) {
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          center.applyMatrix4(child.matrixWorld);

          const volume = Math.max(size.x * size.y * size.z, 0.0001);
          weightedSum.addScaledVector(center, volume);
          totalVolume += volume;
        }
      }
    }
  });

  if (totalVolume > 0) {
    weightedSum.divideScalar(totalVolume);
  }
  return weightedSum;
}

/**
 * Determines the current view mode based on camera pitch angle.
 * Uses hysteresis to prevent flickering at mode boundaries.
 *
 * @param camera - The Three.js camera
 * @param currentMode - The current view mode (for hysteresis)
 * @param cameraDirection - Reusable vector for camera direction (avoids allocation)
 * @returns The appropriate view mode for the camera angle
 */
function getViewMode(
  camera: THREE.Camera,
  currentMode: ViewMode,
  cameraDirection: THREE.Vector3
): ViewMode {
  camera.getWorldDirection(cameraDirection);

  // Calculate pitch angle (0° = horizontal, 90° = straight down/up)
  const pitchAngle = Math.asin(Math.abs(cameraDirection.y)) * (180 / Math.PI);

  // Apply hysteresis based on current mode
  const sideThreshold =
    currentMode === 'side' ? SIDE_VIEW_THRESHOLD + VIEW_MODE_HYSTERESIS : SIDE_VIEW_THRESHOLD;
  const topdownThreshold =
    currentMode === 'topdown'
      ? TOPDOWN_VIEW_THRESHOLD - VIEW_MODE_HYSTERESIS
      : TOPDOWN_VIEW_THRESHOLD;

  if (pitchAngle < sideThreshold) {
    return 'side';
  }
  if (pitchAngle > topdownThreshold) {
    return 'topdown';
  }
  return 'isometric';
}

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

/**
 * Calculates how many screen pixels correspond to one world unit at a given distance.
 * Uses perspective projection geometry for a view-angle-independent result.
 *
 * This ensures consistent screen-space sizing regardless of whether the camera
 * is looking from the side, top, bottom, or any angle.
 *
 * @param camera - The perspective camera
 * @param targetPosition - The world position to measure at
 * @param viewportHeight - The viewport height in pixels
 * @returns Pixels per world unit at the target position's depth
 */
function calculatePixelsPerWorldUnit(
  camera: THREE.Camera,
  targetPosition: THREE.Vector3,
  viewportHeight: number
): number {
  const cameraDistance = camera.position.distanceTo(targetPosition);

  // Guard against zero/negative distance
  if (cameraDistance <= 0) return 1;

  const perspCamera = camera as THREE.PerspectiveCamera;
  const vFovRadians = perspCamera.fov * (Math.PI / 180);
  const halfFovTan = Math.tan(vFovRadians / 2);

  // Perspective projection: at distance d, visible height = 2 * d * tan(fov/2)
  // pixels per world unit = viewport height / visible height
  return viewportHeight / (2 * cameraDistance * halfFovTan);
}

/**
 * Converts a target screen-space pixel distance to world units.
 * Used for maintaining consistent visual spacing regardless of zoom level.
 *
 * @param targetPixels - Desired distance in screen pixels
 * @param pixelsPerWorldUnit - Current pixels per world unit ratio
 * @returns Equivalent distance in world units
 */
function pixelsToWorldUnits(targetPixels: number, pixelsPerWorldUnit: number): number {
  // Guard against division by zero
  if (pixelsPerWorldUnit <= 0) return 0;
  return targetPixels / pixelsPerWorldUnit;
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
  minWorldY,
  onChange,
  onDragStart,
  onDragEnd,
  camera,
  gl,
  worldPosition,
  scaleFactor,
  childMesh,
  isChild = false,
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
   * Also returns worldUnitsPerInternalUnit for ground constraint calculations
   */
  const calculateDragFactors = useCallback((): {
    pixelsPerInternalUnit: number;
    worldUnitsPerInternalUnit: number;
  } => {
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

    return {
      pixelsPerInternalUnit: Math.abs(screenY1 - screenY2) || 1,
      worldUnitsPerInternalUnit,
    };
  }, [camera, gl, worldPosition, getEffectiveScaleY]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      tooltip.hideTooltip();

      const { pixelsPerInternalUnit, worldUnitsPerInternalUnit } = calculateDragFactors();

      setIsDragging(true);
      dragStateRef.current = {
        startMouseY: e.clientY,
        initialValue: value,
        initialMinWorldY: minWorldY,
        worldUnitsPerInternalUnit,
        pixelsPerInternalUnit,
        hasMoved: false,
      };
      onDragStart();
    },
    [value, minWorldY, calculateDragFactors, onDragStart, tooltip]
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

      // Calculate what the new minWorldY would be
      // When we change the internal value by internalDelta:
      // - World Y change = internalDelta * worldUnitsPerInternalUnit
      // - New minWorldY = initialMinWorldY + worldYChange
      const worldDelta = internalDelta * state.worldUnitsPerInternalUnit;
      const newMinWorldY = state.initialMinWorldY + worldDelta;

      // If newMinWorldY would be below ground (< 0), clamp the delta
      let clampedInternalDelta = internalDelta;
      if (newMinWorldY < 0) {
        // Calculate the maximum downward delta that keeps minWorldY at 0
        // 0 = initialMinWorldY + maxDownDelta * worldUnitsPerInternalUnit
        // maxDownDelta = -initialMinWorldY / worldUnitsPerInternalUnit
        const maxDownDelta = -state.initialMinWorldY / state.worldUnitsPerInternalUnit;
        clampedInternalDelta = Math.max(internalDelta, maxDownDelta);
      }

      // Calculate effective height minimum based on object type:
      // - Root objects: HEIGHT_MIN (0) - their Y value represents ground level
      // - Child objects: -Infinity - their localTransform.y is relative to default position,
      //   so negative values are valid (ground constraint above prevents going below ground)
      const effectiveHeightMin = isChild ? -Infinity : HEIGHT_MIN;
      const newValue = clamp(
        state.initialValue + clampedInternalDelta,
        effectiveHeightMin,
        HEIGHT_MAX
      );
      onChange(newValue);
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
  }, [isDragging, onChange, onDragEnd, tooltip, isChild]);

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

        const rawX = state.initialObjectX + (deltaX / effectiveScaleX) * INTERNAL_TO_WORLD;
        const rawZ = state.initialObjectZ - (deltaZ / effectiveScaleZ) * INTERNAL_TO_WORLD;

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
        const rawX = state.initialObjectX + deltaX * INTERNAL_TO_WORLD;
        const rawZ = state.initialObjectZ - deltaZ * INTERNAL_TO_WORLD;
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
// Left/Right Handle Component - For side view mode, moves along camera right axis
// ============================================================================

const LeftRightHandle = memo<LeftRightHandleProps>(function LeftRightHandle({
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
      // Use camera distance and FOV for view-angle-independent calculation
      // This prevents handles from flying away when looking from top-down or bottom-up
      // Calculate dynamic spacing using view-angle-independent formula
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

      heightValue = selectedChild.localTransform.y;
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
      // Get camera's forward direction
      camera.getWorldDirection(cameraDirectionRef.current);
      // Cross forward with up to get right direction (forward × up = right in right-handed system)
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
      // This prevents handles from flying away when looking from top-down or bottom-up
      const rect = gl.domElement.getBoundingClientRect();
      const pixelsPerWorldUnit = calculatePixelsPerWorldUnit(camera, center, rect.height);
      const dynamicHandleOffset = pixelsToWorldUnits(HANDLE_SPACING_PIXELS, pixelsPerWorldUnit);
      const dynamicGap = pixelsToWorldUnits(HANDLE_GAP_PIXELS, pixelsPerWorldUnit);

      // Final offset distance: smoothed bounding box half-extent + dynamic gap
      const offsetDistance = smoothedHalfExtent + dynamicGap;

      // Calculate TARGET positions along camera right vector from object center
      // Height handle at object center Y, XZ/LeftRight handle below (using dynamic offset)
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
        // When dragging, effectivePositionFactor = 1.0 for instant response
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
    // This works for BOTH parent objects and children - it's the true world-space minimum Y
    const actualMinWorldY = box.min.y;
    if (minWorldY !== actualMinWorldY) {
      setMinWorldY(actualMinWorldY);
    }
  });

  /**
   * Handles height value changes from the height handle.
   * The ground constraint is already enforced in the HeightHandle component using minWorldY,
   * so we just apply the new Y value directly.
   */
  const handleHeightChange = useCallback(
    (newY: number) => {
      if (selectedChild && selectedChildPath) {
        // Update child's local transform
        const updatedChildren = object.children?.map((child) => {
          if (pathToString(child.path) === selectedChildPath) {
            return {
              ...child,
              localTransform: { ...child.localTransform, y: newY },
            };
          }
          return child;
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
    [object, selectedChild, selectedChildPath, onUpdateObject]
  );

  const handleDragStart = useCallback(() => {
    setIsAnyHandleDragging(true);
    onDragStart?.();
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsAnyHandleDragging(false);
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
