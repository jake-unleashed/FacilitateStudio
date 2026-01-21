import type { AssetMetadata, UploadProgress } from '../../types/model';
import type { ChildMesh, FocusMode, SceneObject, SidebarSection, SimStep } from '../../types';

export interface LeftSidebarProps {
  activeTab: SidebarSection | null;
  setActiveTab: (tab: SidebarSection | null) => void;
  steps: SimStep[];
  objects: SceneObject[];
  onSelectObject: (id: string | null) => void;
  selectedObjectId: string | null;
  /** Focus camera on object (with optional child path for child-level focus) */
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onAddStep?: (step: Omit<SimStep, 'id'>) => void;
  onInsertStep?: (index: number, step?: Omit<SimStep, 'id'>) => void;
  onUpdateStep?: (step: SimStep) => void;
  onDeleteStep?: (stepId: string) => void;
  onReorderSteps?: (previousOrder: string[], newOrder: string[]) => void;
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: (stepId: string) => void;
  recordingPositionForStepId?: string | null;
  onUploadAsset?: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onRemoveAsset?: (assetId: string) => void;
}

export interface LeftSidebarHandle {
  /** Flush any in-progress StepCard edits (e.g. focused textarea). */
  flushPendingEdits: () => void;
}

export interface StepTypeConfig {
  type: import('../../types').StepType;
  icon: import('lucide-react').LucideIcon;
  color: 'text-blue-600' | 'text-purple-600';
  label: string;
}

export interface HierarchyItemProps {
  obj: SceneObject;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
}

export interface ChildItemProps {
  child: ChildMesh;
  parentObj: SceneObject;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onFocusObject?: (obj: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  depth: number;
}

