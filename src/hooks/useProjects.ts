import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Project, ProjectMetadata } from '../types/project';
import {
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

const CLOUD_SAVE_RETRY_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
 * - When signed out: use local IndexedDB persistence
 * - When signed in: prefer cloud projects, but keep local projects available as a fallback
 *   until a dedicated migration flow is implemented.
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
  const persistenceMode = useMemo(() => (userId ? 'cloud' : 'local'), [userId]);

  // Local persistence is always available for fallback / offline usage.
  const localPersistence = useMemo(() => createProjectPersistence(), []);
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
        console.warn('[useProjects] Failed to read cached project snapshot:', cacheError);
      }

      if (!hasCachedProjects && isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        if (!cloudPersistence) {
          const loaded = await localPersistence.loadProjects();
          if (isMountedRef.current) {
            setProjects(loaded);
            setError(null);
            setIsSyncing(false);
          }
          void saveCachedProjectsSnapshot(loaded, userId).catch((cacheError) => {
            console.warn('[useProjects] Failed to update project snapshot cache:', cacheError);
          });
          return;
        }

        const [cloudResult, localResult] = await Promise.allSettled([
          cloudPersistence.loadProjects(),
          localPersistence.loadProjects(),
        ]);

        const cloudProjects = cloudResult.status === 'fulfilled' ? cloudResult.value : [];
        const localProjects = localResult.status === 'fulfilled' ? localResult.value : [];

        // Merge by ID, preferring cloud versions.
        const mergedById = new Map<string, Project>();
        for (const project of cloudProjects) {
          mergedById.set(project.id, project);
        }
        for (const project of localProjects) {
          if (!mergedById.has(project.id)) {
            mergedById.set(project.id, project);
          }
        }

        const merged = Array.from(mergedById.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        if (isMountedRef.current) {
          setProjects(merged);
          if (cloudResult.status === 'rejected' && localResult.status === 'fulfilled') {
            setError('Cloud is unavailable right now. Showing projects saved on this device.');
          } else if (cloudResult.status === 'rejected') {
            setError('Failed to load cloud projects. Check your connection and try again.');
          } else if (localResult.status === 'rejected') {
            // Cloud load succeeded; local fallback isn't essential, but log for debugging.
            console.warn('[useProjects] Local project cache unavailable:', localResult.reason);
            setError(null);
          } else {
            setError(null);
          }
          setIsSyncing(false);
        }
        void saveCachedProjectsSnapshot(merged, userId).catch((cacheError) => {
          console.warn('[useProjects] Failed to update project snapshot cache:', cacheError);
        });
      } catch (err) {
        console.error(`[useProjects] Failed to load ${persistenceMode} projects:`, err);
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
        return inMemoryProject;
      }

      // Signed out: local-only.
      if (!cloudPersistence) {
        try {
          return await localPersistence.getProject(id);
        } catch (err) {
          console.error('[useProjects] Failed to get local project:', err);
          if (isMountedRef.current) {
            setError('Failed to load project. Please try again.');
          }
          throw err;
        }
      }

      // Signed in: prefer cloud; fall back to local if missing or cloud fails.
      let cloudError: unknown | null = null;
      try {
        const cloudProject = await cloudPersistence.getProject(id);
        if (cloudProject) {
          return cloudProject;
        }
      } catch (err) {
        cloudError = err;
        console.error('[useProjects] Failed to get cloud project:', err);
      }

      try {
        const localProject = await localPersistence.getProject(id);
        if (localProject && cloudError && isMountedRef.current) {
          setError('Cloud is unavailable right now. Opened a project saved on this device.');
        }
        return localProject;
      } catch (err) {
        console.error('[useProjects] Failed to get local fallback project:', err);
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
    [projects, cloudPersistence, localPersistence]
  );

  /**
   * Save a project (create or update).
   * Updates local state immediately, then persists to active backend.
   */
  const saveProject = useCallback(
    async (project: Project): Promise<void> => {
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

      // Persist to local first if signed out.
      if (!cloudPersistence) {
        try {
          await localPersistence.saveProject(updated);
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          console.error('[useProjects] Failed to save project locally:', err);
          if (isMountedRef.current) {
            setError('Failed to save project. Please try again.');
          }
          throw err;
        }
        return;
      }

      // Signed in: save to cloud; keep a local copy best-effort for fallback/offline.
      const previousProject = projects.find((existing) => existing.id === updated.id);
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
        void localPersistence.saveProject(updated).catch((localErr) => {
          console.warn('[useProjects] Failed to save local fallback copy:', localErr);
        });

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
              void localPersistence.saveProject(projectWithCloudThumbnail).catch((localErr) => {
                console.warn('[useProjects] Failed to cache uploaded thumbnail ref locally:', localErr);
              });

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
              console.warn(
                '[useProjects] Thumbnail uploaded but failed to persist cloud thumbnail reference:',
                thumbnailPersistError
              );
            }
          })();
        }
      } catch (err) {
        console.error('[useProjects] Failed to save project to cloud:', err);
        // Ensure the user's work is still persisted locally.
        try {
          await localPersistence.saveProject(updated);
        } catch (localErr) {
          console.error('[useProjects] Additionally failed to save local fallback copy:', localErr);
        }
        if (isMountedRef.current) {
          setError('Failed to save to cloud. Your changes were saved on this device.');
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
          await localPersistence.deleteProject(id);
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          console.error('[useProjects] Failed to delete project locally:', err);
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

      // Signed in: delete from cloud, and best-effort delete local fallback copy.
      try {
        await cloudPersistence.deleteProject(id);
        if (isMountedRef.current) {
          setError(null);
        }
        void localPersistence.deleteProject(id).catch((localErr) => {
          console.warn('[useProjects] Failed to delete local fallback copy:', localErr);
        });
      } catch (err) {
        console.error('[useProjects] Failed to delete project from cloud:', err);
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
    };
    return newProject;
  }, []);

  // Keep the startup snapshot fresh after any successful load/save/delete mutation.
  useEffect(() => {
    if (isLoading) {
      return;
    }

    void saveCachedProjectsSnapshot(projects, userId).catch((cacheError) => {
      console.warn('[useProjects] Failed to persist project snapshot cache:', cacheError);
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
