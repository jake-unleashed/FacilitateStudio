/**
 * TransformGizmo Types
 *
 * Type definitions for the TransformGizmo component and its handles.
 */

import * as THREE from 'three';
import { SceneObject, ChildMesh } from '../../../types';

// ============================================================================
// Public Types
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

// ============================================================================
// Internal Types (shared between handle components)
// ============================================================================

/** Shared props for handle components */
export interface BaseHandleProps {
  onDragStart: () => void;
  onDragEnd: () => void;
  camera: THREE.Camera;
  gl: THREE.WebGLRenderer;
}

/** Props specific to HeightHandle */
export interface HeightHandleProps extends BaseHandleProps {
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
export interface XZHandleProps extends BaseHandleProps {
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

/** Props specific to LeftRightHandle */
export interface LeftRightHandleProps extends BaseHandleProps {
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

/** Tooltip component props */
export interface TooltipProps {
  text: string;
  visible: boolean;
}

/** Internal drag state for height handle */
export interface HeightDragState {
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
export interface XZDragState {
  groundPlaneY: number;
  initialGrabX: number;
  initialGrabZ: number;
  initialObjectX: number;
  initialObjectY: number;
  initialObjectZ: number;
  /**
   * Inverse of the parent's linear (rotation+scale) transform.
   * Used to convert world-space deltas into the child's parent-local delta.
   */
  invParentLinear?: THREE.Matrix3;
  hasMoved: boolean;
}

/** Internal drag state for Left/Right handle (side view mode) */
export interface LeftRightDragState {
  /** Starting mouse X position in screen space */
  startMouseX: number;
  /** The camera right vector at drag start (locked for consistent movement) */
  moveDirection: THREE.Vector3;
  /** Pixels per world unit (for screen-to-world conversion) */
  pixelsPerWorldUnit: number;
  /** Initial object X position in internal units */
  initialObjectX: number;
  /** Initial object Y position in internal units */
  initialObjectY: number;
  /** Initial object Z position in internal units */
  initialObjectZ: number;
  /**
   * Inverse of the parent's linear (rotation+scale) transform.
   * Used to convert world-space deltas into the child's parent-local delta.
   */
  invParentLinear?: THREE.Matrix3;
  /** Whether movement threshold exceeded */
  hasMoved: boolean;
}

/** View modes for context-aware handle display */
export type ViewMode = 'isometric' | 'side' | 'topdown';

/** Return type for useTooltip hook */
export interface UseTooltipReturn {
  showTooltip: boolean;
  tooltipText: string;
  handlePointerEnter: () => void;
  handlePointerLeave: () => void;
  showClickTooltip: (text: string) => void;
  hideTooltip: () => void;
}
