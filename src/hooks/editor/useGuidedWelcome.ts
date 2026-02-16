import { useEffect, useRef, useState } from 'react';
import type { FocusMode, SceneObject } from '../../types';
import type { GuidedWorkflowState } from '../../types/guidedWorkflow';

interface UseGuidedWelcomeArgs {
  isReady: boolean;
  isEntryTransitionDone: boolean;
  isNewProject: boolean;
  state: GuidedWorkflowState;
  objects: SceneObject[];
  onSelectObject: (id: string | null) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
}

interface UseGuidedWelcomeResult {
  showWelcome: boolean;
  setShowWelcome: (value: boolean) => void;
  shouldOfferWelcome: boolean;
  isGuidedUIMode: boolean;
}

export function useGuidedWelcome(args: UseGuidedWelcomeArgs): UseGuidedWelcomeResult {
  const {
    isReady,
    isEntryTransitionDone,
    isNewProject,
    state,
    objects,
    onSelectObject,
    onFocusObject,
  } = args;

  const [showWelcome, setShowWelcome] = useState(false);
  const hasAutoSelectedPositioningRef = useRef(false);
  const welcomeOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isReady) return;
    const shouldOffer = isNewProject && !state.isActive && !state.hasDismissedWelcome;
    if (!shouldOffer) {
      setShowWelcome(false);
      if (welcomeOpenTimeoutRef.current) {
        clearTimeout(welcomeOpenTimeoutRef.current);
        welcomeOpenTimeoutRef.current = null;
      }
      return;
    }

    if (!isEntryTransitionDone || showWelcome) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const delayMs = prefersReducedMotion ? 0 : 250;
    if (welcomeOpenTimeoutRef.current) {
      clearTimeout(welcomeOpenTimeoutRef.current);
      welcomeOpenTimeoutRef.current = null;
    }
    welcomeOpenTimeoutRef.current = setTimeout(() => {
      setShowWelcome(true);
      welcomeOpenTimeoutRef.current = null;
    }, delayMs);
  }, [
    isEntryTransitionDone,
    isNewProject,
    isReady,
    showWelcome,
    state.hasDismissedWelcome,
    state.isActive,
  ]);

  useEffect(() => {
    return () => {
      if (welcomeOpenTimeoutRef.current) clearTimeout(welcomeOpenTimeoutRef.current);
    };
  }, []);

  const shouldOfferWelcome =
    isNewProject && !state.isActive && !state.hasDismissedWelcome;
  const isGuidedUIMode = state.isActive || showWelcome || shouldOfferWelcome;
  const shouldLockNavigation =
    shouldOfferWelcome || (state.isActive && state.currentPhase === 'step-creation');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (shouldLockNavigation) {
      document.body.dataset.guidedNavLock = 'true';
    } else {
      delete document.body.dataset.guidedNavLock;
    }
  }, [shouldLockNavigation]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (state.isActive) {
      document.body.dataset.guidedPhase = state.currentPhase;
    } else {
      delete document.body.dataset.guidedPhase;
    }
    return () => {
      delete document.body.dataset.guidedPhase;
    };
  }, [state.currentPhase, state.isActive]);

  useEffect(() => {
    if (!state.isActive) return;
    if (state.currentPhase !== 'model-upload') return;
    onSelectObject(null);
  }, [onSelectObject, state.currentPhase, state.isActive]);

  useEffect(() => {
    if (!state.isActive || state.currentPhase !== 'model-positioning') {
      hasAutoSelectedPositioningRef.current = false;
      return;
    }

    if (hasAutoSelectedPositioningRef.current) return;

    const meshObjects = objects.filter((object) => object.type === 'mesh');
    if (meshObjects.length !== 1) return;

    hasAutoSelectedPositioningRef.current = true;
    onSelectObject(meshObjects[0].id);
    onFocusObject?.(meshObjects[0], undefined, 'full');
  }, [objects, onFocusObject, onSelectObject, state.currentPhase, state.isActive]);

  return {
    showWelcome,
    setShowWelcome,
    shouldOfferWelcome,
    isGuidedUIMode,
  };
}
