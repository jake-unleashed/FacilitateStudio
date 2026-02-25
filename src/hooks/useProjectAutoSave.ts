import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types/project';
import type { SceneObject, SimStep } from '../types';
import type { SceneSettings } from '../types/sceneSettings';
import { toSceneSettings } from '../types/sceneSettings';
import type { SimulationSettings } from '../types/simulationSettings';
import { toSimulationSettings } from '../types/simulationSettings';
import { hasSerializedChanged, serializeSnapshot, type SaveDataSnapshot, type SerializedSnapshot } from './projectAutoSave/utils';
import { createRunSave } from './projectAutoSave/createRunSave';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseProjectAutoSaveArgs {
  project: Project | null;
  name: string;
  objects: SceneObject[];
  steps: SimStep[];
  sceneSettings?: SceneSettings;
  simulationSettings?: SimulationSettings;
  saveProject: (project: Project) => Promise<void>;
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
  flushSave: (opts?: {
    includeThumbnail?: boolean;
    thumbnailTimeoutMs?: number;
    /** Use this data snapshot as source of truth for the save (e.g., undo/redo ref) */
    dataOverride?: SaveDataSnapshot;
  }) => Promise<void>;
  /** Best-effort synchronous flush (for beforeunload) */
  flushSaveNow: () => void;
}

export function useProjectAutoSave({
  project,
  name,
  objects,
  steps,
  sceneSettings,
  simulationSettings,
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
  const latestRef = useRef({
    project,
    name,
    objects,
    steps,
    sceneSettings: toSceneSettings(sceneSettings),
    simulationSettings: toSimulationSettings(simulationSettings),
  });
  useEffect(() => {
    latestRef.current = {
      project,
      name,
      objects,
      steps,
      sceneSettings: toSceneSettings(sceneSettings),
      simulationSettings: toSimulationSettings(simulationSettings),
    };
  }, [project, name, objects, sceneSettings, simulationSettings, steps]);

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
      sceneSettings: data.sceneSettings ?? base.sceneSettings,
      simulationSettings: data.simulationSettings ?? base.simulationSettings,
      thumbnail,
      updatedAt: new Date().toISOString(),
    };
  }, []);

  // Serialize saves so flushSave can reliably wait.
  const inFlightSaveRef = useRef<Promise<void> | null>(null);

  const computeCurrentData = useCallback((override?: SaveDataSnapshot): SaveDataSnapshot => {
    if (override) {
      return {
        ...override,
        sceneSettings: override.sceneSettings ?? toSceneSettings(latestRef.current.sceneSettings),
        simulationSettings: override.simulationSettings ?? toSimulationSettings(latestRef.current.simulationSettings),
      };
    }
    return {
      name: latestRef.current.name,
      objects: latestRef.current.objects,
      steps: latestRef.current.steps,
      sceneSettings: toSceneSettings(latestRef.current.sceneSettings),
      simulationSettings: toSimulationSettings(latestRef.current.simulationSettings),
    };
  }, []);

  const currentSerialized = useMemo(
    () =>
      serializeSnapshot({
        name,
        objects,
        steps,
        sceneSettings: toSceneSettings(sceneSettings),
        simulationSettings: toSimulationSettings(simulationSettings),
      }),
    [name, objects, sceneSettings, simulationSettings, steps]
  );

  const runSave = useMemo(() => {
    return createRunSave({
      latestRef,
      saveProjectRef,
      captureThumbnailRef,
      buildProject,
      computeCurrentData,
      inFlightSaveRef,
      lastSavedDataRef,
      lastSavedSerializedRef,
      hasBaselineRef,
      isMountedRef,
      setStatus,
      setLastError,
      setLastSavedAt,
    });
  }, [buildProject, computeCurrentData]);

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
      sceneSettings: toSceneSettings(latestRef.current.sceneSettings),
      simulationSettings: toSimulationSettings(latestRef.current.simulationSettings),
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
      sceneSettings: toSceneSettings(latestRef.current.sceneSettings),
      simulationSettings: toSimulationSettings(latestRef.current.simulationSettings),
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
      void runSave({ includeThumbnail: true }).catch((error: unknown) => {
        console.error('[useProjectAutoSave] Background autosave failed:', error);
      });
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
