import { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, ProjectMetadata } from '../types/project';
import {
  LocalStorageProjectPersistence,
  removeProject,
  upsertProject,
} from '../persistence/projectPersistence';

/**
 * Hook for managing projects in localStorage.
 * Provides CRUD operations and reactive state updates.
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** Error message if project operations fail (can be displayed to user) */
  const [error, setError] = useState<string | null>(null);
  const persistence = useMemo(() => new LocalStorageProjectPersistence(), []);

  /** Clear the current error */
  const clearError = useCallback(() => setError(null), []);

  // Load projects from localStorage on mount
  useEffect(() => {
    try {
      const loaded = persistence.loadProjects();
      setProjects(loaded);
      setError(null);
    } catch (error) {
      console.error('Failed to load projects from localStorage:', error);
      setError('Failed to load projects. Your browser storage may be corrupted or inaccessible.');
    } finally {
      setIsLoading(false);
    }
  }, [persistence]);

  // Persist projects to localStorage whenever they change
  const persistProjects = useCallback(
    (updatedProjects: Project[]) => {
      try {
        persistence.saveProjects(updatedProjects);
        setError(null); // Clear any previous errors on successful save
      } catch (error) {
        console.error('Failed to save projects to localStorage:', error);
        setError('Failed to save project. Your browser storage may be full or inaccessible.');
        throw error;
      }
    },
    [persistence]
  );

  /**
   * Get a project by ID
   */
  const getProject = useCallback(
    (id: string): Project | undefined => {
      return projects.find((p) => p.id === id);
    },
    [projects]
  );

  /**
   * Save a project (create or update)
   */
  const saveProject = useCallback(
    (project: Project): void => {
      // Use functional setState to avoid depending on projects in the callback,
      // which would cause this function to be recreated on every save.
      setProjects((currentProjects) => {
        const updatedProjects = upsertProject(currentProjects, project);
        persistProjects(updatedProjects);
        return updatedProjects;
      });
    },
    [persistProjects]
  );

  /**
   * Delete a project by ID
   */
  const deleteProject = useCallback(
    (id: string): void => {
      setProjects((currentProjects) => {
        const updatedProjects = removeProject(currentProjects, id);
        persistProjects(updatedProjects);
        return updatedProjects;
      });
    },
    [persistProjects]
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
