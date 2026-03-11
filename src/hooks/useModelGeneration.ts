import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneObject } from '../types';
import type { AssetMetadata, ModelMetrics } from '../types/model';
import type { GenerationTask, GenerationUiStage } from '../types/modelGeneration';
import {
  downloadGeneratedModel,
  pollGenerationStatus,
  submitGeneration,
} from '../services/modelGenerationService';
import { saveAsset, syncAssetToCloud } from '../utils/modelAssetStore';
import { processModelBuffer } from './modelUpload/processBuffer';
import { getErrorMessage } from '../utils/errors';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'facilitate:model-generation:tasks';
const POLL_INTERVAL_MS = 5000;
const CLOUD_SYNC_PENDING_MESSAGE =
  'Model saved locally, but cloud sync failed. It will sync automatically on next launch.';

export interface GenerationResult {
  assetMetadata: AssetMetadata;
  sceneObject: SceneObject;
  metrics: ModelMetrics;
}

interface UseModelGenerationOptions {
  getExistingObjects: () => SceneObject[];
  userId?: string;
  onComplete?: (result: GenerationResult) => void;
  onError?: (error: string) => void;
  refreshRecentAssets?: () => Promise<void>;
}

interface UseModelGenerationReturn {
  generations: GenerationTask[];
  activeGenerations: GenerationTask[];
  startGeneration: (imageFile: File) => Promise<void>;
  cancelGeneration: (generationId: string) => void;
  retryGeneration: (generationId: string) => Promise<void>;
  clearCompletedGenerations: () => void;
}

function createGenerationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isTerminalStage(stage: GenerationUiStage): boolean {
  return stage === 'complete' || stage === 'failed' || stage === 'cancelled';
}

function isTerminalStatus(status: GenerationTask['status']): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function deriveModelName(imageName: string): string {
  const withoutExt = imageName.replace(/\.[^/.]+$/, '');
  const base = withoutExt.trim() || 'generated-model';
  return `${base}.glb`;
}

/**
 * Submit model generations, resume polling for active tasks, and finalize
 * successful results into saved assets plus scene objects.
 */
export function useModelGeneration(options: UseModelGenerationOptions): UseModelGenerationReturn {
  const { getExistingObjects, userId, onComplete, onError, refreshRecentAssets } = options;
  const [generations, setGenerations] = useState<GenerationTask[]>([]);
  const generationsRef = useRef<GenerationTask[]>([]);
  const cancelledTaskIdsRef = useRef<Set<string>>(new Set());
  const pollingByGenerationIdRef = useRef<Set<string>>(new Set());
  const getExistingObjectsRef = useRef(getExistingObjects);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const refreshRecentAssetsRef = useRef(refreshRecentAssets);
  const isMountedRef = useRef(true);

  getExistingObjectsRef.current = getExistingObjects;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  refreshRecentAssetsRef.current = refreshRecentAssets;
  generationsRef.current = generations;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const delayWithUnmountGuard = useCallback(async (ms: number) => {
    const stepMs = 250;
    let remainingMs = ms;
    while (remainingMs > 0) {
      if (!isMountedRef.current) {
        throw new Error('Generation cancelled');
      }
      const currentDelay = Math.min(stepMs, remainingMs);
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      remainingMs -= currentDelay;
    }
  }, []);

  const updateGeneration = useCallback((generationId: string, updates: Partial<GenerationTask>) => {
    if (!isMountedRef.current) return;
    setGenerations((prev) =>
      prev.map((task) => (task.id === generationId ? { ...task, ...updates } : task))
    );
  }, []);

  const persistGenerations = useCallback((nextGenerations: GenerationTask[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGenerations));
    } catch (error) {
      logger.warn('[useModelGeneration] Failed to persist generation state:', error);
    }
  }, []);

  useEffect(() => {
    persistGenerations(generations);
  }, [generations, persistGenerations]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as GenerationTask[];
      if (Array.isArray(parsed)) {
        setGenerations(parsed);
      }
    } catch (error) {
      logger.warn('[useModelGeneration] Failed to restore generation state:', error);
    }
  }, []);

  const runCompletion = useCallback(
    async (generation: GenerationTask, imageName: string) => {
      if (cancelledTaskIdsRef.current.has(generation.id)) {
        updateGeneration(generation.id, {
          stage: 'cancelled',
          status: 'cancelled',
          error: null,
        });
        return;
      }
      updateGeneration(generation.id, {
        stage: 'downloading',
        progress: 90,
        status: 'processing',
        error: null,
      });

      const arrayBuffer = await downloadGeneratedModel(generation.taskId);
      if (cancelledTaskIdsRef.current.has(generation.id)) {
        updateGeneration(generation.id, {
          stage: 'cancelled',
          status: 'cancelled',
          error: null,
        });
        return;
      }
      updateGeneration(generation.id, {
        stage: 'processing',
        progress: 95,
        status: 'processing',
      });

      const glbName = deriveModelName(imageName);
      const modelFile = new File([arrayBuffer], glbName, { type: 'model/gltf-binary' });
      const metadata = await saveAsset(modelFile);
      if (cancelledTaskIdsRef.current.has(generation.id)) {
        updateGeneration(generation.id, {
          stage: 'cancelled',
          status: 'cancelled',
          error: null,
        });
        return;
      }
      if (userId) {
        void syncAssetToCloud(metadata.id, { userId }).catch((cloudError) => {
          logger.warn(
            '[useModelGeneration] Cloud upload failed; keeping local copy. ' +
              CLOUD_SYNC_PENDING_MESSAGE,
            cloudError
          );
        });
      }
      const processed = await processModelBuffer({
        assetId: metadata.id,
        assetName: metadata.name,
        fileType: metadata.fileType,
        arrayBuffer,
        existingObjects: getExistingObjectsRef.current(),
      });
      if (cancelledTaskIdsRef.current.has(generation.id)) {
        updateGeneration(generation.id, {
          stage: 'cancelled',
          status: 'cancelled',
          error: null,
        });
        return;
      }

      await refreshRecentAssetsRef.current?.();
      if (!isMountedRef.current) {
        throw new Error('Generation cancelled');
      }

      const result: GenerationResult = {
        assetMetadata: {
          ...metadata,
          metrics: processed.metrics,
          children: processed.children,
          importDiagnostics: processed.importDiagnostics,
        },
        sceneObject: processed.sceneObject,
        metrics: processed.metrics,
      };
      if (isMountedRef.current) {
        onCompleteRef.current?.(result);
      }

      updateGeneration(generation.id, {
        stage: 'complete',
        progress: 100,
        status: 'succeeded',
        error: null,
      });
    },
    [updateGeneration, userId]
  );

  const setGenerationFailure = useCallback(
    (generationId: string, message: string) => {
      updateGeneration(generationId, {
        stage: 'failed',
        status: 'failed',
        error: message,
        progress: 0,
      });
      onErrorRef.current?.(message);
    },
    [updateGeneration]
  );

  const pollUntilComplete = useCallback(
    async (generation: GenerationTask, imageName: string) => {
      if (pollingByGenerationIdRef.current.has(generation.id)) return;
      pollingByGenerationIdRef.current.add(generation.id);

      try {
        let keepPolling = true;
        while (keepPolling) {
          if (!isMountedRef.current) {
            throw new Error('Generation cancelled');
          }
          if (cancelledTaskIdsRef.current.has(generation.id)) {
            updateGeneration(generation.id, {
              stage: 'cancelled',
              status: 'cancelled',
              error: null,
            });
            break;
          }

          const status = await pollGenerationStatus(generation.taskId);
          if (!isMountedRef.current) {
            throw new Error('Generation cancelled');
          }
          if (status.status === 'failed' || status.status === 'cancelled') {
            updateGeneration(generation.id, {
              stage: status.status === 'cancelled' ? 'cancelled' : 'failed',
              status: status.status,
              progress: status.progress,
              error: status.error ?? 'Model generation failed',
            });
            onErrorRef.current?.(status.error ?? 'Model generation failed');
            break;
          }

          if (status.status === 'succeeded') {
            if (cancelledTaskIdsRef.current.has(generation.id)) {
              updateGeneration(generation.id, {
                stage: 'cancelled',
                status: 'cancelled',
                error: null,
              });
              break;
            }
            await runCompletion(generation, imageName);
            break;
          }

          updateGeneration(generation.id, {
            stage: 'generating',
            status: status.status,
            progress: Math.min(89, Math.max(10, status.progress || 10)),
            error: null,
          });

          await delayWithUnmountGuard(POLL_INTERVAL_MS);
          keepPolling = !isTerminalStatus(status.status);
        }
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to generate model');
        if (message === 'Generation cancelled') {
          return;
        }
        updateGeneration(generation.id, {
          stage: 'failed',
          status: 'failed',
          error: message,
        });
        onErrorRef.current?.(message);
      } finally {
        pollingByGenerationIdRef.current.delete(generation.id);
      }
    },
    [delayWithUnmountGuard, runCompletion, updateGeneration]
  );

  const requestTaskStart = useCallback(
    async (generation: GenerationTask, imageName: string) => {
      const created = await submitGeneration({
        imageDataUrl: generation.imagePreviewDataUrl,
        imageName,
      });
      const startedTask: GenerationTask = {
        ...generation,
        taskId: created.taskId,
        provider: created.provider,
        stage: 'generating',
        progress: 10,
        status: 'processing',
        error: null,
      };
      updateGeneration(generation.id, startedTask);
      void pollUntilComplete(startedTask, imageName);
    },
    [pollUntilComplete, updateGeneration]
  );

  const startGeneration = useCallback(
    async (imageFile: File) => {
      const imageDataUrl = await toDataUrl(imageFile);

      const generation: GenerationTask = {
        id: createGenerationId(),
        taskId: '',
        name: imageFile.name,
        imagePreviewDataUrl: imageDataUrl,
        provider: 'meshy',
        stage: 'uploading',
        progress: 5,
        status: 'pending',
        error: null,
        createdAt: new Date().toISOString(),
      };

      if (!isMountedRef.current) return;
      setGenerations((prev) => [generation, ...prev]);

      try {
        await requestTaskStart(generation, imageFile.name);
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to start model generation');
        setGenerationFailure(generation.id, message);
      }
    },
    [requestTaskStart, setGenerationFailure]
  );

  const retryGeneration = useCallback(
    async (generationId: string) => {
      const existing = generationsRef.current.find((task) => task.id === generationId);
      if (!existing) return;

      // Reset any cancellation state.
      cancelledTaskIdsRef.current.delete(generationId);

      updateGeneration(generationId, {
        taskId: '',
        stage: 'uploading',
        progress: 5,
        status: 'pending',
        error: null,
      });

      try {
        await requestTaskStart(existing, existing.name);
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to restart model generation');
        setGenerationFailure(generationId, message);
      }
    },
    [requestTaskStart, setGenerationFailure, updateGeneration]
  );

  const cancelGeneration = useCallback(
    (generationId: string) => {
      cancelledTaskIdsRef.current.add(generationId);
      updateGeneration(generationId, {
        stage: 'cancelled',
        status: 'cancelled',
        error: null,
      });
    },
    [updateGeneration]
  );

  const clearCompletedGenerations = useCallback(() => {
    setGenerations((prev) => prev.filter((task) => !isTerminalStage(task.stage)));
  }, []);

  useEffect(() => {
    generations.forEach((generation) => {
      if (generation.taskId && generation.stage === 'generating') {
        void pollUntilComplete(generation, generation.name);
      }
    });
  }, [generations, pollUntilComplete]);

  const activeGenerations = useMemo(
    () => generations.filter((task) => !isTerminalStage(task.stage)),
    [generations]
  );

  return {
    generations,
    activeGenerations,
    startGeneration,
    cancelGeneration,
    retryGeneration,
    clearCompletedGenerations,
  };
}
