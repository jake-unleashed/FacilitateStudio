import type { SaveStatus } from '../../hooks/useProjectAutoSave';

export interface TopBarProps {
  /** The current simulation title */
  title: string;
  /** Callback fired when the title is changed */
  onTitleChange: (newTitle: string) => void;
  /** Called when user requests going Home (lets editor guard + flush). */
  onRequestHome?: () => void;
  /** Auto-save status for subtle indicator. */
  saveStatus?: SaveStatus;
  /** Optional save error message (shown in tooltip). */
  saveErrorMessage?: string | null;
  /** Optional manual save callback (makes Save button clickable). */
  onManualSave?: () => void;
  /** Undo callback */
  onUndo?: () => void;
  /** Redo callback */
  onRedo?: () => void;
  /** Whether undo is available */
  canUndo?: boolean;
  /** Whether redo is available */
  canRedo?: boolean;
  /** Optional explicit preview handler; if omitted, falls back to navigating to /preview/:projectId */
  onPreviewClick?: () => void;
  /** Called when user clicks Publish. */
  onPublishClick?: () => void;
  /** Project id used for preview navigation fallback */
  projectId?: string;
  /** Whether there are steps configured enough for Preview/Publish actions. */
  hasUsableSteps?: boolean;
}

