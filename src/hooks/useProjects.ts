import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Project, ProjectMetadata } from '../types/project';
import {
  clearIndexedDbProjectsStore,
  createProjectPersistence,
  createSupabasePersistence,
  loadCachedProjectsSnapshot,
  saveCachedProjectsSnapshot,
} from '../persistence/projectPersistence';
import { useAuth } from '../contexts/AuthContext';
import {
  isBase64Thumbnail,
  toThumbnailStorageRef,
  uploadThumbnailToStorage,
} from '../utils/thumbnailUpload';
import { DEFAULT_SIMULATION_SETTINGS, toSimulationSettings } from '../types/simulationSettings';
import { logger } from '../utils/logger';
import { StorageError } from '../utils/errors';

const CLOUD_SAVE_RETRY_DELAY_MS = 1500;
const LOCAL_PROJECTS_CLEANUP_KEY_PREFIX = 'local-projects-cleaned';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withSimulationSettings(project: Project): Project {
  return {
    ...project,
    simulationSettings: toSimulationSettings(project.simulationSettings),
  };
}

/**
 * Return type for the useProjects hook.
 */
export interface UseProjectsResult {
  /** All loaded projects */
  projects: Project[];
  /** True while projects are being loaded from storage */
  isLoading: boolean;
  /** True while cached projects are being refreshed in background */
  isSyncing: boolean;
  /** Error message if project operations failed */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
  /** Get a full project by ID from persistence */
  getProject: (id: string) => Promise<Project | undefined>;
  /** Save a project (create or update) */
  saveProject: (project: Project) => Promise<void>;
  /** Delete a project by ID */
  deleteProject: (id: string) => Promise<void>;
  /** Create a new empty project (does not save it) */
  createProject: (name?: string) => Project;
  /** Get project metadata for library display */
  getProjectMetadata: () => ProjectMetadata[];
}

/**
 * Hook for managing projects using local (IndexedDB) and cloud (Supabase) persistence.
 *
 * Behavior:
 * - When signed out: uses local IndexedDB persistence (primarily for dev/fallback scenarios)
 * - When signed in: uses cloud (Supabase) as the source of truth
 *   - Uses the user-scoped `project-cache` snapshot for fast startup and best-effort offline reads
 *   - Does NOT read or merge device-level projects into the signed-in experience
 *
 * @returns Object containing projects state and CRUD operations
 */
export function useProjects(): UseProjectsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  /** Error message if project operations fail (can be displayed to user) */
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to avoid setting state after unmount.
  const isMountedRef = useRef(true);
  // Used to gate rollback when multiple saves happen rapidly for the same project.
  // This avoids relying on timestamps (which can collide within the same millisecond).
  const saveTokenByProjectIdRef = useRef<Map<string, number>>(new Map());
  const persistenceMode = useMemo(() => (userId ? 'cloud' : 'local'), [userId]);

  // Local persistence is only used while signed out.
  const localPersistence = useMemo(
    () => (userId ? null : createProjectPersistence()),
    [userId]
  );
  // Cloud persistence is only available when authenticated.
  const cloudPersistence = useMemo(() => (userId ? createSupabasePersistence() : null), [userId]);

  /** Clear the current error */
  const clearError = useCallback(() => setError(null), []);

  // Load projects from the active persistence backend.
  useEffect(() => {
    isMountedRef.current = true;

    async function loadProjects() {
      let hasCachedProjects = false;

      try {
        const cachedProjects = await loadCachedProjectsSnapshot(userId);
        if (isMountedRef.current && cachedProjects !== null) {
          setProjects(cachedProjects);
          setError(null);
          setIsLoading(false);
          setIsSyncing(true);
          hasCachedProjects = true;
        }
      } catch (cacheError) {
        logger.warn('[useProjects] Failed to read cached project snapshot:', cacheError);
      }

      if (!hasCachedProjects && isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        if (!cloudPersistence) {
          const loaded = localPersistence ? await localPersistence.loadProjects() : [];
          const normalizedLoaded = loaded.map(withSimulationSettings);
          if (isMountedRef.current) {
            setProjects(normalizedLoaded);
            setError(null);
            setIsSyncing(false);
          }
          void saveCachedProjectsSnapshot(normalizedLoaded, userId).catch((cacheError) => {
            logger.warn('[useProjects] Failed to update project snapshot cache:', cacheError);
          });
          return;
        }

        const cloudProjects = await cloudPersistence.loadProjects();
        const sortedProjects = [...cloudProjects.map(withSimulationSettings)].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        if (isMountedRef.current) {
          setProjects(sortedProjects);
          setError(null);
          setIsSyncing(false);
        }
        void saveCachedProjectsSnapshot(sortedProjects, userId).catch((cacheError) => {
          logger.warn('[useProjects] Failed to update project snapshot cache:', cacheError);
        });
        if (userId) {
          const cleanupKey = `${LOCAL_PROJECTS_CLEANUP_KEY_PREFIX}:${userId}`;
          try {
            if (localStorage.getItem(cleanupKey) !== 'true') {
              void clearIndexedDbProjectsStore()
                .then(() => {
                  try {
                    localStorage.setItem(cleanupKey, 'true');
                  } catch (storageError) {
                    logger.warn(
                      '[useProjects] Failed to persist legacy cleanup flag to localStorage:',
                      storageError
                    );
                  }
                })
                .catch((cleanupError) => {
                  logger.warn('[useProjects] Failed to clear legacy local project store:', cleanupError);
                });
            }
          } catch (storageError) {
            logger.warn('[useProjects] Legacy cleanup flag unavailable in localStorage:', storageError);
          }
        }
      } catch (err) {
        logger.error(`[useProjects] Failed to load ${persistenceMode} projects:`, err);
        if (isMountedRef.current) {
          setError(
            persistenceMode === 'cloud'
              ? 'Failed to load cloud projects. Check your connection and try again.'
              : 'Failed to load projects. Your browser storage may be corrupted or inaccessible.'
          );
          setIsSyncing(false);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsSyncing(false);
        }
      }
    }

    loadProjects();

    return () => {
      isMountedRef.current = false;
    };
  }, [cloudPersistence, localPersistence, persistenceMode, userId]);

  /**
   * Get a full project by ID from persistence.
   * Falls back to in-memory state for local projects when available.
   */
  const getProject = useCallback(
    async (id: string): Promise<Project | undefined> => {
      const inMemoryProject = projects.find((p) => p.id === id);
      if (inMemoryProject && !cloudPersistence) {
        return withSimulationSettings(inMemoryProject);
      }

      // Signed out: local-only.
      if (!cloudPersistence) {
        try {
          if (!localPersistence) {
            return undefined;
          }
          const localProject = await localPersistence.getProject(id);
          return localProject ? withSimulationSettings(localProject) : undefined;
        } catch (err) {
          logger.error('[useProjects] Failed to get local project:', err);
          if (isMountedRef.current) {
            setError('Failed to load project. Please try again.');
          }
          throw err;
        }
      }

      // Signed in: prefer cloud; fall back to user-scoped cached snapshot if needed.
      let cloudError: unknown | null = null;
      try {
        const cloudProject = await cloudPersistence.getProject(id);
        if (cloudProject) {
          return withSimulationSettings(cloudProject);
        }
      } catch (err) {
        cloudError = err;
        logger.error('[useProjects] Failed to get cloud project:', err);
      }

      try {
        const cachedProjects = await loadCachedProjectsSnapshot(userId);
        const cachedProject = cachedProjects?.find((project) => project.id === id);
        if (cachedProject && cloudError && isMountedRef.current) {
          setError('Cloud is unavailable right now. Opened your latest cached project.');
        }
        return cachedProject ? withSimulationSettings(cachedProject) : undefined;
      } catch (err) {
        logger.error('[useProjects] Failed to load cached project fallback:', err);
        if (cloudError) {
          if (isMountedRef.current) {
            setError('Failed to load project. Check your connection and try again.');
          }
          throw cloudError;
        }
        if (isMountedRef.current) {
          setError('Failed to load project. Please try again.');
        }
        throw err;
      }
    },
    [projects, cloudPersistence, localPersistence, userId]
  );

  /**
   * Save a project (create or update).
   * Updates local state immediately, then persists to active backend.
   */
  const saveProject = useCallback(
    async (project: Project): Promise<void> => {
      const previousProject = projects.find((existing) => existing.id === project.id);
      const projectId = project.id;
      const nextSaveToken = (saveTokenByProjectIdRef.current.get(projectId) ?? 0) + 1;
      saveTokenByProjectIdRef.current.set(projectId, nextSaveToken);
      const now = new Date().toISOString();
      const updated: Project = {
        ...project,
        simulationSettings: toSimulationSettings(project.simulationSettings),
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

      // Persist to local first if signed out.
      if (!cloudPersistence) {
        try {
          if (!localPersistence) {
            throw new StorageError('Local persistence unavailable while signed out.');
          }
          await localPersistence.saveProject(updated);
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          logger.error('[useProjects] Failed to save project locally:', err);
          if (isMountedRef.current) {
            setError('Failed to save project. Please try again.');
          }
          throw err;
        }
        return;
      }

      // Signed in: save to cloud only.
      const previousThumbnail =
        previousProject && !isBase64Thumbnail(previousProject.thumbnail)
          ? previousProject.thumbnail
          : undefined;
      const shouldUploadThumbnail = isBase64Thumbnail(updated.thumbnail);
      const projectForCloudSave: Project = {
        ...updated,
        // Never send base64 thumbnail blobs to the projects table.
        thumbnail: shouldUploadThumbnail ? previousThumbnail : updated.thumbnail,
      };

      const saveToCloudWithRetry = async (projectToSave: Project): Promise<void> => {
        try {
          await cloudPersistence.saveProject(projectToSave);
        } catch (firstError) {
          await delay(CLOUD_SAVE_RETRY_DELAY_MS);
          try {
            await cloudPersistence.saveProject(projectToSave);
          } catch {
            throw firstError;
          }
        }
      };

      try {
        await saveToCloudWithRetry(projectForCloudSave);
        if (isMountedRef.current) {
          setError(null);
        }

        if (shouldUploadThumbnail && updated.thumbnail && user?.id) {
          const thumbnailDataUrl = updated.thumbnail;
          void (async () => {
            const uploadResult = await uploadThumbnailToStorage(thumbnailDataUrl, user.id, updated.id);
            if (!uploadResult) {
              return;
            }

            const thumbnailRef = toThumbnailStorageRef(uploadResult.storagePath);
            const projectWithCloudThumbnail: Project = {
              ...updated,
              thumbnail: thumbnailRef,
            };

            try {
              await cloudPersistence.saveProject(projectWithCloudThumbnail);

              if (isMountedRef.current) {
                setProjects((currentProjects) =>
                  currentProjects.map((existingProject) =>
                    existingProject.id === updated.id
                      ? { ...existingProject, thumbnail: thumbnailRef }
                      : existingProject
                  )
                );
              }
            } catch (thumbnailPersistError) {
              logger.warn(
                '[useProjects] Thumbnail uploaded but failed to persist cloud thumbnail reference:',
                thumbnailPersistError
              );
            }
          })();
        }
      } catch (err) {
        logger.error('[useProjects] Failed to save project to cloud:', err);
        // Roll back the optimistic update when no further edits occurred.
        // If the project was saved/edited again since this save began, keep the latest in-memory state.
        setProjects((currentProjects) => {
          const currentIndex = currentProjects.findIndex((p) => p.id === updated.id);
          if (currentIndex === -1) {
            return currentProjects;
          }
          const currentToken = saveTokenByProjectIdRef.current.get(projectId);
          if (currentToken !== nextSaveToken) {
            return currentProjects;
          }

          if (previousProject) {
            const next = [...currentProjects];
            next[currentIndex] = previousProject;
            return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          }

          return currentProjects.filter((p) => p.id !== updated.id);
        });
        if (isMountedRef.current) {
          setError('Failed to save to cloud. Check your connection and try again.');
        }
        throw err;
      }
    },
    [cloudPersistence, localPersistence, projects, user?.id]
  );

  /**
   * Delete a project by ID.
   */
  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      const projectToRestore = projects.find((p) => p.id === id);
      // Update local state immediately
      setProjects((currentProjects) => currentProjects.filter((p) => p.id !== id));

      // Signed out: local-only delete.
      if (!cloudPersistence) {
        try {
          if (!localPersistence) {
            throw new StorageError('Local persistence unavailable while signed out.');
          }
          await localPersistence.deleteProject(id);
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          logger.error('[useProjects] Failed to delete project locally:', err);
          // Restore optimistic removal.
          if (projectToRestore) {
            setProjects((current) => [projectToRestore, ...current]);
          }
          if (isMountedRef.current) {
            setError('Failed to delete project. Please try again.');
          }
          throw err;
        }
        return;
      }

      // Signed in: delete from cloud only.
      try {
        await cloudPersistence.deleteProject(id);
        if (isMountedRef.current) {
          setError(null);
        }
      } catch (err) {
        logger.error('[useProjects] Failed to delete project from cloud:', err);
        // Restore optimistic removal if we can.
        if (projectToRestore) {
          setProjects((current) => [projectToRestore, ...current].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          ));
        }
        if (isMountedRef.current) {
          setError('Failed to delete project. Please try again.');
        }
        throw err;
      }
    },
    [cloudPersistence, localPersistence, projects]
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
      simulationSettings: DEFAULT_SIMULATION_SETTINGS,
    };
    return newProject;
  }, []);

  // Keep the startup snapshot fresh after any successful load/save/delete mutation.
  useEffect(() => {
    if (isLoading) {
      return;
    }

    void saveCachedProjectsSnapshot(projects, userId).catch((cacheError) => {
      logger.warn('[useProjects] Failed to persist project snapshot cache:', cacheError);
    });
  }, [isLoading, projects, userId]);

  return {
    projects,
    isLoading,
    isSyncing,
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
