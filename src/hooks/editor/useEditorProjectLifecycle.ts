import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { Project } from '../../types/project';
import type { EditorState } from '../undoRedo/types';

export interface UseEditorProjectLifecycleArgs {
  projectId: string | undefined;
  isLoadingProjects: boolean;
  getProject: (id: string) => Promise<Project | undefined>;
  createProject: (name?: string) => Project;
  navigate: NavigateFunction;
  setUndoRedoState: (state: EditorState) => void;
  /** Optional error handler for surfacing load failures to the UI */
  onLoadError?: (error: unknown) => void;
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
  onLoadError,
}: UseEditorProjectLifecycleArgs): UseEditorProjectLifecycleResult {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Wait for projects to load from storage before initializing.
    if (isLoadingProjects || isInitialized) return;

    let isCancelled = false;

    const initialize = async () => {
      if (projectId) {
        try {
          const project = await getProject(projectId);
          if (isCancelled) {
            return;
          }
          if (!project) {
            onLoadError?.(new Error('Project not found.'));
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
        } catch (error) {
          if (isCancelled) {
            return;
          }
          console.error('[useEditorProjectLifecycle] Failed to load project:', error);
          onLoadError?.(error);
          navigate('/');
          return;
        }
      }

      const newProject = createProject('New Simulation');
      if (isCancelled) {
        return;
      }
      setCurrentProject(newProject);
      setUndoRedoState({
        objects: [],
        steps: [],
        simulationTitle: newProject.name,
      });
      navigate(`/editor/${newProject.id}`, { replace: true });
      setIsInitialized(true);
    };

    void initialize();

    return () => {
      isCancelled = true;
    };
  }, [
    projectId,
    getProject,
    createProject,
    navigate,
    isInitialized,
    isLoadingProjects,
    setUndoRedoState,
    onLoadError,
  ]);

  return { currentProject, isInitialized };
}
