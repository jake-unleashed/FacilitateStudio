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
  const persistence = useMemo(() => new LocalStorageProjectPersistence(), []);

  // Load projects from localStorage on mount
  useEffect(() => {
    try {
      const loaded = persistence.loadProjects();
      setProjects(loaded);
    } catch (error) {
      console.error('Failed to load projects from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [persistence]);

  // Persist projects to localStorage whenever they change
  const persistProjects = useCallback(
    (updatedProjects: Project[]) => {
      try {
        persistence.saveProjects(updatedProjects);
      } catch (error) {
        console.error('Failed to save projects to localStorage:', error);
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
    getProject,
    saveProject,
    deleteProject,
    createProject,
    getProjectMetadata,
  };
}
