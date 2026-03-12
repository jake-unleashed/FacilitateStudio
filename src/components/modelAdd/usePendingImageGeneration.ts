import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GenerationTask } from '../../types/modelGeneration';

interface PendingImageGeneration {
  id: string;
  name: string;
  previewUrl: string;
  queuedAt: string;
}

interface UsePendingImageGenerationResult {
  displayGenerations: GenerationTask[];
  queuePendingImageGeneration: (imageFile: File) => void;
  clearPendingImageGeneration: () => void;
}

function createPendingGenerationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createPreviewUrl(file: File): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }
  return URL.createObjectURL(file);
}

function buildPendingGenerationTask(pending: PendingImageGeneration): GenerationTask {
  return {
    id: pending.id,
    taskId: '',
    name: pending.name,
    imagePreviewDataUrl: pending.previewUrl,
    provider: 'meshy',
    stage: 'uploading',
    progress: 5,
    status: 'pending',
    error: null,
    createdAt: pending.queuedAt,
  };
}

/**
 * Shows an optimistic image-generation card immediately after file selection
 * while the real generation task is still being created.
 */
export function usePendingImageGeneration(
  generations: GenerationTask[]
): UsePendingImageGenerationResult {
  const [pendingImageGeneration, setPendingImageGeneration] = useState<PendingImageGeneration | null>(
    null
  );
  const pendingImagePreviewUrlRef = useRef<string | null>(null);

  const hasMatchingPersistedGeneration = useCallback(
    (pending: PendingImageGeneration): boolean =>
      generations.some(
        (generation) =>
          generation.name === pending.name &&
          new Date(generation.createdAt).getTime() >= new Date(pending.queuedAt).getTime()
      ),
    [generations]
  );

  const clearPendingImageGeneration = useCallback(() => {
    if (
      pendingImagePreviewUrlRef.current &&
      typeof URL !== 'undefined' &&
      typeof URL.revokeObjectURL === 'function'
    ) {
      URL.revokeObjectURL(pendingImagePreviewUrlRef.current);
    }
    pendingImagePreviewUrlRef.current = null;
    setPendingImageGeneration(null);
  }, []);

  const queuePendingImageGeneration = useCallback(
    (imageFile: File) => {
      clearPendingImageGeneration();
      const previewUrl = createPreviewUrl(imageFile);
      pendingImagePreviewUrlRef.current = previewUrl;
      setPendingImageGeneration({
        id: createPendingGenerationId(),
        name: imageFile.name,
        previewUrl,
        queuedAt: new Date().toISOString(),
      });
    },
    [clearPendingImageGeneration]
  );

  useEffect(() => clearPendingImageGeneration, [clearPendingImageGeneration]);

  useEffect(() => {
    if (!pendingImageGeneration) return;
    if (hasMatchingPersistedGeneration(pendingImageGeneration)) {
      clearPendingImageGeneration();
    }
  }, [clearPendingImageGeneration, hasMatchingPersistedGeneration, pendingImageGeneration]);

  const displayGenerations = useMemo(() => {
    if (!pendingImageGeneration) return generations;
    if (hasMatchingPersistedGeneration(pendingImageGeneration)) {
      return generations;
    }
    return [buildPendingGenerationTask(pendingImageGeneration), ...generations];
  }, [generations, hasMatchingPersistedGeneration, pendingImageGeneration]);

  return {
    displayGenerations,
    queuePendingImageGeneration,
    clearPendingImageGeneration,
  };
}
