import type React from 'react';
import type { Project } from '../../types/project';
import type { SceneObject, SimStep } from '../../types';
import { hasSerializedChanged, serializeSnapshot, toError, withTimeout, type SaveDataSnapshot, type SerializedSnapshot } from './utils';

export function createRunSave({
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
}: {
  latestRef: React.MutableRefObject<{
    project: Project | null;
    name: string;
    objects: SceneObject[];
    steps: SimStep[];
  }>;
  saveProjectRef: React.MutableRefObject<(project: Project) => Promise<void>>;
  captureThumbnailRef: React.MutableRefObject<(() => Promise<string | undefined>) | undefined>;
  buildProject: (base: Project, data: SaveDataSnapshot, thumbnail?: string) => Project;
  computeCurrentData: (override?: SaveDataSnapshot) => SaveDataSnapshot;
  inFlightSaveRef: React.MutableRefObject<Promise<void> | null>;
  lastSavedDataRef: React.MutableRefObject<SaveDataSnapshot | null>;
  lastSavedSerializedRef: React.MutableRefObject<SerializedSnapshot | null>;
  hasBaselineRef: React.MutableRefObject<boolean>;
  isMountedRef: React.MutableRefObject<boolean>;
  setStatus: React.Dispatch<React.SetStateAction<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>>;
  setLastError: React.Dispatch<React.SetStateAction<Error | null>>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<number | null>>;
}): (opts: { includeThumbnail: boolean; thumbnailTimeoutMs?: number; dataOverride?: SaveDataSnapshot }) => Promise<void> {
  return async (opts) => {
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

      let preferredThumbnail: string | undefined;
      if (opts.includeThumbnail && captureThumbnailRef.current && opts.thumbnailTimeoutMs != null) {
        try {
          preferredThumbnail = await withTimeout(captureThumbnailRef.current(), opts.thumbnailTimeoutMs);
        } catch {
          preferredThumbnail = undefined;
        }
      }

      const updated = buildProject(base, data, preferredThumbnail ?? base.thumbnail);

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

      if (opts.includeThumbnail && captureThumbnailRef.current && opts.thumbnailTimeoutMs == null) {
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

    inFlightSaveRef.current = next;
    void next
      .finally(() => {
        if (inFlightSaveRef.current === next) {
          inFlightSaveRef.current = null;
        }
      })
      .catch(() => {});

    return next;
  };
}

