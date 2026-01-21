import type { ThreeEvent } from '@react-three/fiber';
import type { SceneObject } from '../../../types';

export interface ImportedModelProps {
  obj: SceneObject;
  isSelected: boolean;
  /** Path of the selected child mesh (if any) - format: "path.to.child" */
  selectedChildPath?: string | null;
  /**
   * Path of the child mesh to outline (if any) - format: "path.to.child".
   * Used by preview mode to highlight a target child without coupling to editor selection state.
   */
  outlinedChildPath?: string | null;
  /**
   * Called when the parent object is clicked.
   * - pendingChildPath: child to select if interaction is a click (not drag)
   * - dragChildPath: child to move if interaction is a drag (if not provided, moves root)
   */
  onPointerDown: (
    e: ThreeEvent<PointerEvent>,
    obj: SceneObject,
    pendingChildPath?: string | null,
    dragChildPath?: string | null
  ) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: (e: ThreeEvent<PointerEvent>) => void;
  onHoverEnd: () => void;
  isGhost?: boolean;
  /** If true, this is the actual reference object during recording (very transparent). If false but isGhost=true, it's the draggable ghost. */
  isActualReference?: boolean;
  /** If true and selectedChildPath is set, render only the target child with normal opacity, make rest very transparent */
  highlightOnlyChild?: boolean;
}

