export type ToolType = 'select' | 'move' | 'rotate' | 'scale';

export interface Transform {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

/**
 * Represents a child mesh within a 3D model.
 * Children are automatically extracted from the model's mesh hierarchy.
 */
export interface ChildMesh {
  /** Display name of the child mesh */
  name: string;
  /** Path in the Three.js hierarchy (e.g., ["Scene", "Body", "Wheel_FL"]) */
  path: string[];
  /** Local transform offset from the default position (applied on top of parent) */
  localTransform: Transform;
}

/**
 * Default transform with no offset - used for child meshes initially
 */
export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

export interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'zone' | 'text-popup' | 'wire';
  icon?: string;
  transform: Transform;
  properties: {
    visible: boolean;
    grabbable?: boolean;
    hasGravity?: boolean;
    locked?: boolean;
    color?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  /** Child meshes within this object (for imported 3D models with hierarchy) */
  children?: ChildMesh[];
}

export interface SimStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  /** Step type - determines the step behavior */
  type?: StepType | null;
  /** For info-card steps: heading text */
  heading?: string;
  /** For info-card steps: body text */
  bodyText?: string;
  /** For info-card steps: button text */
  buttonText?: string;
  /** For info-card steps: card color theme */
  cardColor?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  /** For move-item steps: ID of the object to move */
  targetObjectId?: string;
  /** For move-item steps: starting position of the object */
  startPosition?: { x: number; y: number; z: number };
  /** For move-item steps: target/end position of the object */
  endPosition?: { x: number; y: number; z: number };
}

export type SidebarSection = 'add' | 'steps' | 'scenes' | 'objects';

/** Step type for simulation steps */
export type StepType = 'info-card' | 'move-item';

/**
 * Parsed selection ID for objects and their children.
 * Format: "objectId" or "objectId/childPath"
 */
export interface ParsedSelectionId {
  objectId: string;
  childPath: string | null;
}

/**
 * Parse a selection ID into object ID and optional child path.
 * @param selectionId - The full selection ID (e.g., "obj-123" or "obj-123/wheel_fl")
 */
export function parseSelectionId(selectionId: string | null): ParsedSelectionId | null {
  if (!selectionId) return null;
  const slashIndex = selectionId.indexOf('/');
  if (slashIndex === -1) {
    return { objectId: selectionId, childPath: null };
  }
  return {
    objectId: selectionId.substring(0, slashIndex),
    childPath: selectionId.substring(slashIndex + 1),
  };
}

/**
 * Create a selection ID for a child mesh.
 * @param objectId - Parent object ID
 * @param childPath - Child path identifier
 */
export function createChildSelectionId(objectId: string, childPath: string): string {
  return `${objectId}/${childPath}`;
}

/**
 * Convert a path array to a path string for use in selection IDs.
 */
export function pathToString(path: string[]): string {
  return path.join('.');
}

/**
 * Convert a path string back to a path array.
 */
export function stringToPath(pathStr: string): string[] {
  return pathStr.split('.');
}
