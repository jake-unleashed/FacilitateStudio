import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { Project } from '../../types/project';
import { createErrorPopup, type PopupOptions } from '../../contexts/PopupContext';
import { useRouteTransition } from '../../contexts/RouteTransitionContext';
import type { SceneObject, SimStep } from '../../types';
import type { UseProjectAutoSaveResult } from '../useProjectAutoSave';

export type ExitOverlayState =
  | null
  | {
      mode: 'saving' | 'error';
      errorMessage?: string;
    };

export interface UseEditorNavigationGuardsArgs {
  navigate: NavigateFunction;
  currentProject: Project | null;

  /** Whether editor state differs from last saved baseline */
  isDirty: boolean;

  /** Flush any in-flight edits (e.g., StepCard textarea still focused) */
  flushPendingStepEdits: () => void;

  /** If recording is active, stop it before saving */
  recordingPositionForStepId: string | null;
  stopRecording: (() => void) | null;

  /** Snapshot getter (ref-backed) for save-before-navigation */
  getCurrentState: () => { objects: SceneObject[]; steps: SimStep[]; simulationTitle: string };

  /** Autosave controls */
  flushSave: UseProjectAutoSaveResult['flushSave'];
  flushSaveNow: UseProjectAutoSaveResult['flushSaveNow'];

  /** Popup surface for user-visible errors */
  showPopup: (options: PopupOptions) => void;
}

export interface UseEditorNavigationGuardsResult {
  exitOverlay: ExitOverlayState;
  isPublishModalOpen: boolean;
  setIsPublishModalOpen: (open: boolean) => void;

  requestNavigation: (destination: { type: 'home' } | { type: 'preview'; projectId: string }) => Promise<void>;
  handleRequestHome: () => Promise<void>;
  handleExitStay: () => void;
  handleExitLeaveAnyway: () => void;
  handleManualSave: () => Promise<void>;
  handlePublishClick: () => Promise<void>;
}

/**
 * useEditorNavigationGuards
 *
 * Centralizes save-before-exit behavior and best-effort flush on background/unload.
 * Also owns the “save overlay” state for navigation flows.
 */
export function useEditorNavigationGuards({
  navigate: _navigate,
  currentProject,
  isDirty,
  flushPendingStepEdits,
  recordingPositionForStepId,
  stopRecording,
  getCurrentState,
  flushSave,
  flushSaveNow,
  showPopup,
}: UseEditorNavigationGuardsArgs): UseEditorNavigationGuardsResult {
  const { transitionTo } = useRouteTransition();
  const [exitOverlay, setExitOverlay] = useState<ExitOverlayState>(null);
  const pendingExitActionRef = useRef<(() => void) | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Best-effort flush on unload / backgrounding.
  useEffect(() => {
    const handlePageHide = () => {
      if (!isDirty) return;
      flushSaveNow();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!isDirty) return;
      flushSaveNow();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      flushSaveNow();
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, flushSaveNow]);

  const requestNavigation = useCallback(
    async (destination: { type: 'home' } | { type: 'preview'; projectId: string }) => {
      flushPendingStepEdits();
      if (recordingPositionForStepId) {
        stopRecording?.();
      }

      const snapshot = getCurrentState();
      const dataOverride = {
        name: snapshot.simulationTitle,
        objects: snapshot.objects,
        steps: snapshot.steps,
      };

      const doNavigate = () => {
        if (destination.type === 'home') {
          void transitionTo('/');
        } else {
          void transitionTo(`/preview/${destination.projectId}`);
        }
      };

      pendingExitActionRef.current = null;

      // Avoid overlay flicker on fast saves: show after brief delay if still saving.
      let didForceNavigate = false;
      let didFinish = false;
      const showOverlayDelay = setTimeout(() => {
        if (didFinish) return;
        setExitOverlay({ mode: 'saving' });
      }, 150);

      // Safety timeout: if save takes longer than 2s total, force-navigate anyway.
      const safetyTimeout = setTimeout(() => {
        if (didFinish) return;
        didForceNavigate = true;
        console.warn('[useEditorNavigationGuards] Save took too long; force-navigating.');
        didFinish = true;
        clearTimeout(showOverlayDelay);
        setExitOverlay(null);
        doNavigate();
      }, 2000);

      try {
        await flushSave({ includeThumbnail: true, thumbnailTimeoutMs: 600, dataOverride });
        if (didForceNavigate) return;
        didFinish = true;
        clearTimeout(safetyTimeout);
        clearTimeout(showOverlayDelay);
        setExitOverlay(null);
        doNavigate();
      } catch (err) {
        if (didForceNavigate) return;
        didFinish = true;
        clearTimeout(safetyTimeout);
        clearTimeout(showOverlayDelay);
        console.error('[useEditorNavigationGuards] Failed to save before navigating:', err);
        const message = err instanceof Error ? err.message : 'Failed to save changes';
        pendingExitActionRef.current = doNavigate;
        setExitOverlay({ mode: 'error', errorMessage: message });
      }
    },
    [
      flushPendingStepEdits,
      recordingPositionForStepId,
      stopRecording,
      getCurrentState,
      flushSave,
      transitionTo,
    ]
  );

  const handleRequestHome = useCallback(async () => {
    await requestNavigation({ type: 'home' });
  }, [requestNavigation]);

  const handleExitStay = useCallback(() => {
    setExitOverlay(null);
  }, []);

  const handleExitLeaveAnyway = useCallback(() => {
    setExitOverlay(null);
    const action = pendingExitActionRef.current;
    pendingExitActionRef.current = null;
    if (action) {
      action();
      return;
    }
    void transitionTo('/');
  }, [transitionTo]);

  const handleManualSave = useCallback(async () => {
    try {
      const snapshot = getCurrentState();
      await flushSave({
        includeThumbnail: true,
        thumbnailTimeoutMs: 600,
        dataOverride: {
          name: snapshot.simulationTitle,
          objects: snapshot.objects,
          steps: snapshot.steps,
        },
      });
    } catch (err) {
      console.error('[useEditorNavigationGuards] Manual save failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      showPopup(createErrorPopup('Save failed', message));
    }
  }, [flushSave, getCurrentState, showPopup]);

  const handlePublishClick = useCallback(async () => {
    if (!currentProject) return;
    try {
      flushPendingStepEdits();
      if (recordingPositionForStepId) {
        stopRecording?.();
      }
      const snapshot = getCurrentState();
      await flushSave({
        includeThumbnail: true,
        thumbnailTimeoutMs: 600,
        dataOverride: {
          name: snapshot.simulationTitle,
          objects: snapshot.objects,
          steps: snapshot.steps,
        },
      });
      setIsPublishModalOpen(true);
    } catch (err) {
      console.error('[useEditorNavigationGuards] Failed to save before publishing:', err);
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      showPopup(createErrorPopup('Publish failed', message));
    }
  }, [
    currentProject,
    flushPendingStepEdits,
    recordingPositionForStepId,
    stopRecording,
    getCurrentState,
    flushSave,
    showPopup,
  ]);

  return {
    exitOverlay,
    isPublishModalOpen,
    setIsPublishModalOpen,
    requestNavigation,
    handleRequestHome,
    handleExitStay,
    handleExitLeaveAnyway,
    handleManualSave,
    handlePublishClick,
  };
}

