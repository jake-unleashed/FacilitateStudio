import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types/project';
import type { SceneObject, SimStep } from '../types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseProjectAutoSaveArgs {
  project: Project | null;
  name: string;
  objects: SceneObject[];
  steps: SimStep[];
  saveProject: (project: Project) => void;
  captureThumbnail?: () => Promise<string | undefined>;
  debounceMs?: number;
}

export interface UseProjectAutoSaveResult {
  status: SaveStatus;
  isDirty: boolean;
  lastError: Error | null;
  lastSavedAt: number | null;
  /** Call this after initial hydration to establish "saved" baseline */
  setBaseline: () => void;
  /** Immediately flush any pending save (for exit/navigation) */
  flushSave: (opts?: { includeThumbnail?: boolean; thumbnailTimeoutMs?: number }) => Promise<void>;
  /** Best-effort synchronous flush (for beforeunload) */
  flushSaveNow: () => void;
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : 'Unknown save error');
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Simple deep comparison for save-relevant data.
 * Returns true if the data has changed since the last saved state.
 */
function hasDataChanged(
  current: { name: string; objects: SceneObject[]; steps: SimStep[] },
  saved: { name: string; objects: SceneObject[]; steps: SimStep[] } | null
): boolean {
  if (!saved) return false; // No baseline yet
  if (current.name !== saved.name) return true;
  if (current.objects.length !== saved.objects.length) return true;
  if (current.steps.length !== saved.steps.length) return true;
  // Deep compare objects and steps using JSON (simple but effective for our data)
  if (JSON.stringify(current.objects) !== JSON.stringify(saved.objects)) return true;
  if (JSON.stringify(current.steps) !== JSON.stringify(saved.steps)) return true;
  return false;
}

export function useProjectAutoSave({
  project,
  name,
  objects,
  steps,
  saveProject,
  captureThumbnail,
  debounceMs = 1000,
}: UseProjectAutoSaveArgs): UseProjectAutoSaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastError, setLastError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track the last saved state to detect actual changes
  const lastSavedDataRef = useRef<{
    name: string;
    objects: SceneObject[];
    steps: SimStep[];
  } | null>(null);

  // Track if we have a baseline (initial load complete)
  const hasBaselineRef = useRef(false);

  // Keep latest values in refs so callbacks don't need to depend on them
  const latestRef = useRef({ project, name, objects, steps });
  useEffect(() => {
    latestRef.current = { project, name, objects, steps };
  }, [project, name, objects, steps]);

  // Keep saveProject in a ref to avoid callback chain recreation
  const saveProjectRef = useRef(saveProject);
  useEffect(() => {
    saveProjectRef.current = saveProject;
  }, [saveProject]);

  // Keep captureThumbnail in a ref
  const captureThumbnailRef = useRef(captureThumbnail);
  useEffect(() => {
    captureThumbnailRef.current = captureThumbnail;
  }, [captureThumbnail]);

  const cancelScheduledSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const buildProject = useCallback((base: Project, thumbnail?: string): Project => {
    return {
      ...base,
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
      thumbnail,
      updatedAt: new Date().toISOString(),
    };
  }, []);

  const saveCore = useCallback(
    (thumbnail?: string) => {
      const base = latestRef.current.project;
      if (!base) return;
      const updated = buildProject(base, thumbnail ?? base.thumbnail);
      saveProjectRef.current(updated);
      // Update last saved data
      lastSavedDataRef.current = {
        name: latestRef.current.name,
        objects: latestRef.current.objects,
        steps: latestRef.current.steps,
      };
    },
    [buildProject]
  );

  const runSave = useCallback(
    async (opts: { includeThumbnail: boolean; thumbnailTimeoutMs?: number }) => {
      const base = latestRef.current.project;
      if (!base) return;

      if (isMountedRef.current) {
        setStatus('saving');
        setLastError(null);
      }

      // Capture thumbnail if requested with timeout
      let preferredThumbnail: string | undefined;
      if (opts.includeThumbnail && captureThumbnailRef.current && opts.thumbnailTimeoutMs != null) {
        try {
          preferredThumbnail = await withTimeout(
            captureThumbnailRef.current(),
            opts.thumbnailTimeoutMs
          );
        } catch {
          preferredThumbnail = undefined;
        }
      }

      // Save core data
      try {
        saveCore(preferredThumbnail);
      } catch (err) {
        const e = toError(err);
        if (isMountedRef.current) {
          setStatus('error');
          setLastError(e);
        }
        throw e;
      }

      // For background autosave, capture thumbnail after core save (non-blocking)
      if (opts.includeThumbnail && captureThumbnailRef.current && opts.thumbnailTimeoutMs == null) {
        try {
          const captured = await captureThumbnailRef.current();
          if (captured) saveCore(captured);
        } catch {
          // Ignore thumbnail errors
        }
      }

      if (isMountedRef.current) {
        setStatus('saved');
        setLastSavedAt(Date.now());
      }
    },
    [saveCore]
  );

  const flushSave = useCallback(
    async (opts?: { includeThumbnail?: boolean; thumbnailTimeoutMs?: number }) => {
      cancelScheduledSave();
      await runSave({
        includeThumbnail: opts?.includeThumbnail ?? false,
        thumbnailTimeoutMs: opts?.thumbnailTimeoutMs,
      });
    },
    [cancelScheduledSave, runSave]
  );

  const flushSaveNow = useCallback(() => {
    cancelScheduledSave();
    const base = latestRef.current.project;
    if (!base) return;
    // Check if there are actually unsaved changes
    const currentData = {
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
    };
    if (!hasDataChanged(currentData, lastSavedDataRef.current)) return;
    try {
      const updated = buildProject(base, base.thumbnail);
      saveProjectRef.current(updated);
      lastSavedDataRef.current = currentData;
    } catch {
      // Best-effort only
    }
  }, [buildProject, cancelScheduledSave]);

  const setBaseline = useCallback(() => {
    cancelScheduledSave();
    hasBaselineRef.current = true;
    lastSavedDataRef.current = {
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
    };
    setStatus('saved');
    setLastError(null);
  }, [cancelScheduledSave]);

  // Watch for actual data changes and trigger autosave
  useEffect(() => {
    // Don't do anything until we have a baseline
    if (!hasBaselineRef.current) return;
    if (!latestRef.current.project) return;

    const currentData = { name, objects, steps };

    // Check if data actually changed from last saved state
    if (!hasDataChanged(currentData, lastSavedDataRef.current)) {
      return; // No actual change, don't mark dirty
    }

    // Data has actually changed - mark dirty and schedule save
    if (isMountedRef.current) {
      setStatus('dirty');
    }

    // Schedule debounced save
    cancelScheduledSave();
    timeoutRef.current = setTimeout(() => {
      void runSave({ includeThumbnail: true });
    }, debounceMs);

    return () => {
      // Don't cancel on cleanup - we want the save to complete
    };
  }, [name, objects, steps, debounceMs, cancelScheduledSave, runSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Best-effort flush if there are unsaved changes
      const currentData = {
        name: latestRef.current.name,
        objects: latestRef.current.objects,
        steps: latestRef.current.steps,
      };
      if (hasDataChanged(currentData, lastSavedDataRef.current)) {
        const base = latestRef.current.project;
        if (base) {
          try {
            const updated = {
              ...base,
              name: currentData.name,
              objects: currentData.objects,
              steps: currentData.steps,
              updatedAt: new Date().toISOString(),
            };
            saveProjectRef.current(updated);
          } catch {
            // Best-effort
          }
        }
      }
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!hasBaselineRef.current) return false;
    const currentData = { name, objects, steps };
    return hasDataChanged(currentData, lastSavedDataRef.current);
  }, [name, objects, steps]);

  return useMemo(
    () => ({
      status,
      isDirty,
      lastError,
      lastSavedAt,
      setBaseline,
      flushSave,
      flushSaveNow,
    }),
    [status, isDirty, lastError, lastSavedAt, setBaseline, flushSave, flushSaveNow]
  );
}
