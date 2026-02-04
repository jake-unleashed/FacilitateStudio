/* eslint-disable react-refresh/only-export-components */
// Disabled: This file exports both GuidedWorkflowProvider (component) and hook helpers.
// Co-locating hooks with their context is the standard React pattern used in this repo (see PopupContext).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  GuidedWorkflowActions,
  GuidedWorkflowPhase,
  GuidedWorkflowState,
} from '../types/guidedWorkflow';

const phaseOrder: GuidedWorkflowPhase[] = [
  'step-creation',
  'model-upload',
  'model-positioning',
  'step-configuration',
  'finish',
];

const initialState: GuidedWorkflowState = {
  isActive: false,
  hasDismissedWelcome: false,
  currentPhase: 'welcome',
  currentStepIndex: 0,
  pendingSteps: [],
  creationMethod: null,
};

interface GuidedWorkflowContextValue {
  state: GuidedWorkflowState;
  actions: GuidedWorkflowActions;
  isFirstPhase: boolean;
  isLastPhase: boolean;
}

const GuidedWorkflowContext = createContext<GuidedWorkflowContextValue | null>(null);

interface GuidedWorkflowProviderProps {
  children: ReactNode;
  projectId?: string;
}

function getStorageKey(projectId?: string): string | null {
  if (!projectId) return null;
  return `guided-workflow-${projectId}`;
}

function getPhaseIndex(phase: GuidedWorkflowPhase): number {
  return phaseOrder.indexOf(phase);
}

export function GuidedWorkflowProvider({
  children,
  projectId,
}: GuidedWorkflowProviderProps): JSX.Element {
  const storageKey = useMemo(() => getStorageKey(projectId), [projectId]);

  const [state, setState] = useState<GuidedWorkflowState>(() => {
    if (!storageKey) return initialState;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initialState;
      const parsed = JSON.parse(raw) as Partial<GuidedWorkflowState>;
      return { ...initialState, ...parsed };
    } catch (error) {
      console.warn('[GuidedWorkflow] Failed to load persisted state:', error);
      return initialState;
    }
  });

  useEffect(() => {
    if (!storageKey) {
      setState(initialState);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setState(initialState);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<GuidedWorkflowState>;
      setState({ ...initialState, ...parsed });
    } catch (error) {
      console.warn('[GuidedWorkflow] Failed to load persisted state:', error);
      setState(initialState);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('[GuidedWorkflow] Failed to persist state:', error);
    }
  }, [state, storageKey]);

  const startWorkflow = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'step-creation',
    }));
  }, []);

  const skipToEditor = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      hasDismissedWelcome: true,
      currentPhase: 'welcome',
    }));
  }, []);

  const exitWorkflow = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      hasDismissedWelcome: true,
      currentPhase: 'welcome',
    }));
  }, []);

  const nextPhase = useCallback(() => {
    setState((prev) => {
      const currentIndex = getPhaseIndex(prev.currentPhase);
      const nextIndex = Math.min(currentIndex + 1, phaseOrder.length - 1);
      if (currentIndex === nextIndex) return prev;
      return { ...prev, currentPhase: phaseOrder[nextIndex] };
    });
  }, []);

  const previousPhase = useCallback(() => {
    setState((prev) => {
      const currentIndex = getPhaseIndex(prev.currentPhase);
      const nextIndex = Math.max(currentIndex - 1, 0);
      if (currentIndex === nextIndex) return prev;
      return { ...prev, currentPhase: phaseOrder[nextIndex] };
    });
  }, []);

  const setCurrentStepIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, currentStepIndex: index }));
  }, []);

  const setPendingSteps = useCallback((steps: string[]) => {
    setState((prev) => ({ ...prev, pendingSteps: steps }));
  }, []);

  const setCreationMethod = useCallback((method: GuidedWorkflowState['creationMethod']) => {
    setState((prev) => ({ ...prev, creationMethod: method }));
  }, []);

  const actions: GuidedWorkflowActions = useMemo(
    () => ({
      startWorkflow,
      skipToEditor,
      nextPhase,
      previousPhase,
      setCurrentStepIndex,
      setPendingSteps,
      setCreationMethod,
      exitWorkflow,
    }),
    [
      startWorkflow,
      skipToEditor,
      nextPhase,
      previousPhase,
      setCurrentStepIndex,
      setPendingSteps,
      setCreationMethod,
      exitWorkflow,
    ]
  );

  const isFirstPhase = getPhaseIndex(state.currentPhase) === 0;
  const isLastPhase = getPhaseIndex(state.currentPhase) === phaseOrder.length - 1;

  const value = useMemo(
    () => ({
      state,
      actions,
      isFirstPhase,
      isLastPhase,
    }),
    [actions, isFirstPhase, isLastPhase, state]
  );

  return <GuidedWorkflowContext.Provider value={value}>{children}</GuidedWorkflowContext.Provider>;
}

export function useGuidedWorkflowContext(): GuidedWorkflowContextValue {
  const context = useContext(GuidedWorkflowContext);
  if (!context) {
    throw new Error('useGuidedWorkflowContext must be used within a GuidedWorkflowProvider');
  }
  return context;
}
