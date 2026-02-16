import { useEffect, type MutableRefObject } from 'react';

interface UseAutosaveHydrationArgs {
  currentProjectId: string | null;
  isInitialized: boolean;
  setBaseline: () => void;
  undoRedoObjects: unknown[];
  undoRedoSteps: unknown[];
  undoRedoTitle: string;
  objects: unknown[];
  steps: unknown[];
  simulationTitle: string;
  hasHydratedRef: MutableRefObject<boolean>;
}

export function useAutosaveHydration(args: UseAutosaveHydrationArgs): void {
  const {
    currentProjectId,
    isInitialized,
    setBaseline,
    undoRedoObjects,
    undoRedoSteps,
    undoRedoTitle,
    objects,
    steps,
    simulationTitle,
    hasHydratedRef,
  } = args;

  useEffect(() => {
    if (!isInitialized || !currentProjectId) return;
    if (hasHydratedRef.current) return;
    if (
      undoRedoObjects !== objects ||
      undoRedoSteps !== steps ||
      undoRedoTitle !== simulationTitle
    ) {
      return;
    }
    hasHydratedRef.current = true;
    setBaseline();
  }, [
    currentProjectId,
    isInitialized,
    setBaseline,
    undoRedoObjects,
    undoRedoSteps,
    undoRedoTitle,
    objects,
    steps,
    simulationTitle,
    hasHydratedRef,
  ]);

  useEffect(() => {
    hasHydratedRef.current = false;
  }, [currentProjectId, hasHydratedRef]);
}
