import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Project, ProjectMetadata } from '../types/project';
import {
  IndexedDBProjectPersistence,
  createProjectPersistence,
} from '../persistence/projectPersistence';

/**
 * Return type for the useProjects hook.
 */
export interface UseProjectsResult {
  /** All loaded projects */
  projects: Project[];
  /** True while projects are being loaded from storage */
  isLoading: boolean;
  /** Error message if project operations failed */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
  /** Get a project by ID from local state */
  getProject: (id: string) => Project | undefined;
  /** Save a project (create or update) */
  saveProject: (project: Project) => void;
  /** Delete a project by ID */
  deleteProject: (id: string) => void;
  /** Create a new empty project (does not save it) */
  createProject: (name?: string) => Project;
  /** Get project metadata for library display */
  getProjectMetadata: () => ProjectMetadata[];
}

/**
 * Hook for managing projects in IndexedDB.
 * Provides CRUD operations and reactive state updates.
 * Uses IndexedDB for GB-scale storage (replacing localStorage which has 5-10MB limits).
 *
 * @returns Object containing projects state and CRUD operations
 */
export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** Error message if project operations fail (can be displayed to user) */
  const [error, setError] = useState<string | null>(null);

  // Use ref to keep persistence instance stable and track if we're mounted
  const persistenceRef = useRef<IndexedDBProjectPersistence | null>(null);
  const isMountedRef = useRef(true);

  // Get or create persistence instance
  const persistence = useMemo(() => {
    if (!persistenceRef.current) {
      persistenceRef.current = createProjectPersistence();
    }
    return persistenceRef.current;
  }, []);

  /** Clear the current error */
  const clearError = useCallback(() => setError(null), []);

  // Load projects from IndexedDB on mount
  useEffect(() => {
    isMountedRef.current = true;

    async function loadProjects() {
      try {
        const loaded = await persistence.loadProjects();
        if (isMountedRef.current) {
          setProjects(loaded);
          setError(null);
        }
      } catch (err) {
        console.error('[useProjects] Failed to load projects from IndexedDB:', err);
        if (isMountedRef.current) {
          setError(
            'Failed to load projects. Your browser storage may be corrupted or inaccessible.'
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      isMountedRef.current = false;
    };
  }, [persistence]);

  /**
   * Get a project by ID (from local state for sync access)
   */
  const getProject = useCallback(
    (id: string): Project | undefined => {
      return projects.find((p) => p.id === id);
    },
    [projects]
  );

  /**
   * Save a project (create or update).
   * Updates local state immediately, then persists to IndexedDB.
   */
  const saveProject = useCallback(
    (project: Project): void => {
      const now = new Date().toISOString();
      const updated: Project = {
        ...project,
        updatedAt: now,
        createdAt: project.createdAt || now,
      };

      // Update local state immediately for responsive UI
      setProjects((currentProjects) => {
        const existingIndex = currentProjects.findIndex((p) => p.id === updated.id);
        if (existingIndex >= 0) {
          const newProjects = [...currentProjects];
          newProjects[existingIndex] = updated;
          return newProjects.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        } else {
          return [updated, ...currentProjects].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
      });

      // Persist to IndexedDB (fire and forget with error handling)
      persistence.saveProject(updated).catch((err) => {
        console.error('[useProjects] Failed to save project to IndexedDB:', err);
        if (isMountedRef.current) {
          setError('Failed to save project. Please try again.');
        }
      });
    },
    [persistence]
  );

  /**
   * Delete a project by ID.
   */
  const deleteProject = useCallback(
    (id: string): void => {
      // Update local state immediately
      setProjects((currentProjects) => currentProjects.filter((p) => p.id !== id));

      // Persist to IndexedDB
      persistence.deleteProject(id).catch((err) => {
        console.error('[useProjects] Failed to delete project from IndexedDB:', err);
        if (isMountedRef.current) {
          setError('Failed to delete project. Please try again.');
        }
      });
    },
    [persistence]
  );

  /**
   * Get project metadata for library display (excludes heavy data)
   */
  const getProjectMetadata = useCallback((): ProjectMetadata[] => {
    return projects.map(({ id, name, createdAt, updatedAt, thumbnail }) => ({
      id,
      name,
      createdAt,
      updatedAt,
      thumbnail,
    }));
  }, [projects]);

  /**
   * Create a new empty project and return it
   */
  const createProject = useCallback((name: string = 'New Simulation'): Project => {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      objects: [],
      steps: [],
    };
    return newProject;
  }, []);

  return {
    projects,
    isLoading,
    /** Error message if project operations failed */
    error,
    /** Clear the current error */
    clearError,
    getProject,
    saveProject,
    deleteProject,
    createProject,
    getProjectMetadata,
  };
}
