import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types/project';
import type { SceneObject, SimStep } from '../types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseProjectAutoSaveArgs {
  project: Project | null;
  name: string;
  objects: SceneObject[];
  steps: SimStep[];
  saveProject: (project: Project) => Promise<void>;
  captureThumbnail?: () => Promise<string | undefined>;
  debounceMs?: number;
}

interface SaveDataSnapshot {
  name: string;
  objects: SceneObject[];
  steps: SimStep[];
}

export interface UseProjectAutoSaveResult {
  status: SaveStatus;
  isDirty: boolean;
  lastError: Error | null;
  lastSavedAt: number | null;
  /** Call this after initial hydration to establish "saved" baseline */
  setBaseline: () => void;
  /** Immediately flush any pending save (for exit/navigation) */
  flushSave: (opts?: {
    includeThumbnail?: boolean;
    thumbnailTimeoutMs?: number;
    /** Use this data snapshot as source of truth for the save (e.g., undo/redo ref) */
    dataOverride?: SaveDataSnapshot;
  }) => Promise<void>;
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
 * Pre-serialized snapshot for efficient comparisons.
 *
 * We store the JSON strings so we don't repeatedly `JSON.stringify` the saved baseline
 * when checking for dirty state.
 */
interface SerializedSnapshot {
  name: string;
  objectsLen: number;
  stepsLen: number;
  objectsJson: string;
  stepsJson: string;
}

function serializeSnapshot(data: SaveDataSnapshot): SerializedSnapshot {
  return {
    name: data.name,
    objectsLen: data.objects.length,
    stepsLen: data.steps.length,
    objectsJson: JSON.stringify(data.objects),
    stepsJson: JSON.stringify(data.steps),
  };
}

function hasSerializedChanged(current: SerializedSnapshot, saved: SerializedSnapshot | null): boolean {
  if (!saved) return false; // No baseline yet
  if (current.name !== saved.name) return true;
  if (current.objectsLen !== saved.objectsLen) return true;
  if (current.stepsLen !== saved.stepsLen) return true;
  if (current.objectsJson !== saved.objectsJson) return true;
  if (current.stepsJson !== saved.stepsJson) return true;
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
  const lastSavedDataRef = useRef<SaveDataSnapshot | null>(null);
  const lastSavedSerializedRef = useRef<SerializedSnapshot | null>(null);

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

  const buildProject = useCallback((base: Project, data: SaveDataSnapshot, thumbnail?: string): Project => {
    return {
      ...base,
      name: data.name,
      objects: data.objects,
      steps: data.steps,
      thumbnail,
      updatedAt: new Date().toISOString(),
    };
  }, []);

  // Serialize saves so flushSave can reliably wait.
  const inFlightSaveRef = useRef<Promise<void> | null>(null);

  const computeCurrentData = useCallback((override?: SaveDataSnapshot): SaveDataSnapshot => {
    if (override) return override;
    return {
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
    };
  }, []);

  const currentSerialized = useMemo(
    () => serializeSnapshot({ name, objects, steps }),
    [name, objects, steps]
  );

  const runSave = useCallback(
    async (opts: {
      includeThumbnail: boolean;
      thumbnailTimeoutMs?: number;
      dataOverride?: SaveDataSnapshot;
    }) => {
      const queueOn = inFlightSaveRef.current ?? Promise.resolve();

      const next = queueOn.then(async () => {
        const base = latestRef.current.project;
        if (!base) return;

        const data = computeCurrentData(opts.dataOverride);
        const serialized = serializeSnapshot(data);
        if (hasBaselineRef.current && !hasSerializedChanged(serialized, lastSavedSerializedRef.current)) {
          if (isMountedRef.current) {
            setStatus('saved');
            setLastError(null);
          }
          return;
        }

        if (isMountedRef.current) {
          setStatus('saving');
          setLastError(null);
        }

        // Capture thumbnail if requested with timeout
        let preferredThumbnail: string | undefined;
        if (
          opts.includeThumbnail &&
          captureThumbnailRef.current &&
          opts.thumbnailTimeoutMs != null
        ) {
          try {
            preferredThumbnail = await withTimeout(
              captureThumbnailRef.current(),
              opts.thumbnailTimeoutMs
            );
          } catch {
            preferredThumbnail = undefined;
          }
        }

        const updated = buildProject(base, data, preferredThumbnail ?? base.thumbnail);

        // Save core data (awaitable)
        try {
          await saveProjectRef.current(updated);
          lastSavedDataRef.current = data;
          lastSavedSerializedRef.current = serialized;
        } catch (err) {
          const e = toError(err);
          if (isMountedRef.current) {
            setStatus('error');
            setLastError(e);
          }
          throw e;
        }

        // For background autosave, capture thumbnail after core save (non-blocking)
        if (
          opts.includeThumbnail &&
          captureThumbnailRef.current &&
          opts.thumbnailTimeoutMs == null
        ) {
          try {
            const captured = await captureThumbnailRef.current();
            if (captured) {
              const updatedWithThumb = buildProject(base, data, captured);
              await saveProjectRef.current(updatedWithThumb);
            }
          } catch {
            // Ignore thumbnail errors
          }
        }

        if (isMountedRef.current) {
          setStatus('saved');
          setLastSavedAt(Date.now());
        }
      });

      // Track the in-flight save so subsequent saves can queue behind it.
      inFlightSaveRef.current = next;
      // Always clear the ref after completion. Ensure we never leak an unhandled rejection
      // from the `.finally()` wrapper when `next` rejects.
      void next
        .finally(() => {
          if (inFlightSaveRef.current === next) {
            inFlightSaveRef.current = null;
          }
        })
        .catch(() => {});

      return next;
    },
    [buildProject, computeCurrentData]
  );

  const flushSave = useCallback(
    async (opts?: {
      includeThumbnail?: boolean;
      thumbnailTimeoutMs?: number;
      dataOverride?: SaveDataSnapshot;
    }) => {
      cancelScheduledSave();
      await runSave({
        includeThumbnail: opts?.includeThumbnail ?? false,
        thumbnailTimeoutMs: opts?.thumbnailTimeoutMs,
        dataOverride: opts?.dataOverride,
      });
    },
    [cancelScheduledSave, runSave]
  );

  const flushSaveNow = useCallback(() => {
    cancelScheduledSave();
    const base = latestRef.current.project;
    if (!base) return;
    // Check if there are actually unsaved changes
    const currentData: SaveDataSnapshot = {
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
    };
    const serialized = serializeSnapshot(currentData);
    if (!hasSerializedChanged(serialized, lastSavedSerializedRef.current)) return;
    try {
      const updated = buildProject(base, currentData, base.thumbnail);
      // Best-effort only; cannot await in unload handlers.
      void saveProjectRef.current(updated).catch(() => {});
      lastSavedDataRef.current = currentData;
      lastSavedSerializedRef.current = serialized;
    } catch {
      // Best-effort only
    }
  }, [buildProject, cancelScheduledSave]);

  const setBaseline = useCallback(() => {
    cancelScheduledSave();
    hasBaselineRef.current = true;
    const data: SaveDataSnapshot = {
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
    };
    lastSavedDataRef.current = data;
    lastSavedSerializedRef.current = serializeSnapshot(data);
    setStatus('saved');
    setLastError(null);
  }, [cancelScheduledSave]);

  // Watch for actual data changes and trigger autosave
  useEffect(() => {
    // Don't do anything until we have a baseline
    if (!hasBaselineRef.current) return;
    if (!latestRef.current.project) return;

    // Check if data actually changed from last saved state
    if (!hasSerializedChanged(currentSerialized, lastSavedSerializedRef.current)) {
      return; // No actual change, don't mark dirty
    }

    // Data has actually changed - mark dirty and schedule save
    if (isMountedRef.current) {
      setStatus('dirty');
    }

    // Schedule debounced save
    cancelScheduledSave();
    timeoutRef.current = setTimeout(() => {
      // Never allow unhandled rejections from background autosave
      void runSave({ includeThumbnail: true }).catch(() => {});
    }, debounceMs);

    return () => {
      // Don't cancel on cleanup - we want the save to complete
    };
  }, [currentSerialized, debounceMs, cancelScheduledSave, runSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!hasBaselineRef.current) return false;
    return hasSerializedChanged(currentSerialized, lastSavedSerializedRef.current);
  }, [currentSerialized]);

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
