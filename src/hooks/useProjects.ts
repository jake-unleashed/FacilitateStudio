import { useState, useEffect, useCallback } from 'react';
import { Project, ProjectMetadata } from '../types/project';

const STORAGE_KEY = 'facilitate-studio-projects';

/**
 * Hook for managing projects in localStorage.
 * Provides CRUD operations and reactive state updates.
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Project[];
        // Sort by most recently updated
        parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setProjects(parsed);
      }
    } catch (error) {
      console.error('Failed to load projects from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Persist projects to localStorage whenever they change
  const persistProjects = useCallback((updatedProjects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
    } catch (error) {
      console.error('Failed to save projects to localStorage:', error);
    }
  }, []);

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
      const now = new Date().toISOString();
      const existingIndex = projects.findIndex((p) => p.id === project.id);

      let updatedProjects: Project[];

      if (existingIndex >= 0) {
        // Update existing project
        updatedProjects = [...projects];
        updatedProjects[existingIndex] = {
          ...project,
          updatedAt: now,
        };
      } else {
        // Create new project
        updatedProjects = [
          {
            ...project,
            createdAt: project.createdAt || now,
            updatedAt: now,
          },
          ...projects,
        ];
      }

      // Sort by most recently updated
      updatedProjects.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setProjects(updatedProjects);
      persistProjects(updatedProjects);
    },
    [projects, persistProjects]
  );

  /**
   * Delete a project by ID
   */
  const deleteProject = useCallback(
    (id: string): void => {
      const updatedProjects = projects.filter((p) => p.id !== id);
      setProjects(updatedProjects);
      persistProjects(updatedProjects);
    },
    [projects, persistProjects]
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
