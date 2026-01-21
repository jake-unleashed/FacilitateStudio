import type { ChildMesh, FocusMode, SceneObject } from '../../types';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RightSidebarProps {
  object: SceneObject | null;
  /** Selected child mesh (if any) - when set, shows child details instead of parent */
  selectedChild?: ChildMesh | null;
  onUpdate: (updated: SceneObject) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** Callback when a batch operation starts (for undo/redo batching) */
  onBatchStart?: () => void;
  /** Callback when a batch operation ends (for undo/redo batching) */
  onBatchEnd?: () => void;
  /** Called to focus camera on an object after reset */
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
}

