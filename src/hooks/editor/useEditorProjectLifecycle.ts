import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { Project } from '../../types/project';
import type { EditorState } from '../undoRedo/types';

export interface UseEditorProjectLifecycleArgs {
  projectId: string | undefined;
  isLoadingProjects: boolean;
  getProject: (id: string) => Project | undefined;
  createProject: (name?: string) => Project;
  navigate: NavigateFunction;
  setUndoRedoState: (state: EditorState) => void;
}

export interface UseEditorProjectLifecycleResult {
  currentProject: Project | null;
  isInitialized: boolean;
}

/**
 * useEditorProjectLifecycle
 *
 * Loads an existing project (when route has an ID), or creates a new one and redirects
 * to `/editor/:id`. Also initializes the undo/redo state to match the loaded project.
 */
export function useEditorProjectLifecycle({
  projectId,
  isLoadingProjects,
  getProject,
  createProject,
  navigate,
  setUndoRedoState,
}: UseEditorProjectLifecycleArgs): UseEditorProjectLifecycleResult {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Wait for projects to load from storage before initializing.
    if (isLoadingProjects || isInitialized) return;

    if (projectId) {
      const project = getProject(projectId);
      if (!project) {
        navigate('/');
        return;
      }

      setCurrentProject(project);
      setUndoRedoState({
        objects: project.objects,
        steps: project.steps,
        simulationTitle: project.name,
      });
      setIsInitialized(true);
      return;
    }

    const newProject = createProject('New Simulation');
    setCurrentProject(newProject);
    setUndoRedoState({
      objects: [],
      steps: [],
      simulationTitle: newProject.name,
    });
    navigate(`/editor/${newProject.id}`, { replace: true });
    setIsInitialized(true);
  }, [
    projectId,
    getProject,
    createProject,
    navigate,
    isInitialized,
    isLoadingProjects,
    setUndoRedoState,
  ]);

  return { currentProject, isInitialized };
}

