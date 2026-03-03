import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneWorldEnvironment } from '../types/sceneSettings';
import type { WorldEnvironmentFlowPhase } from '../types/worldEnvironment';
import {
  fetchWorldEnvironmentStatus,
  startWorldEnvironmentGeneration,
} from '../services/worldEnvironmentService';

const POLL_INTERVAL_MS = 10_000;

interface UseWorldEnvironmentFlowResult {
  currentEnvironment: SceneWorldEnvironment | null;
  phase: WorldEnvironmentFlowPhase;
  progress: number | null;
  statusText: string | null;
  error: string | null;
  isWorking: boolean;
  generateEnvironment: (file: File) => Promise<SceneWorldEnvironment>;
  resumePolling: (worldEnvironment: SceneWorldEnvironment) => Promise<SceneWorldEnvironment | null>;
  cancelGeneration: () => void;
  markEnvironmentReady: (ready: boolean, errorMessage?: string) => void;
  clearError: () => void;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useWorldEnvironmentFlow(): UseWorldEnvironmentFlowResult {
  const [currentEnvironment, setCurrentEnvironment] = useState<SceneWorldEnvironment | null>(null);
  const [phase, setPhase] = useState<WorldEnvironmentFlowPhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const pollTokenRef = useRef(0);
  const isRendererLoadingRef = useRef(false);

  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const beginWork = useCallback((nextPhase: WorldEnvironmentFlowPhase) => {
    setError(null);
    setPhase(nextPhase);
    setProgress(null);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    pollTokenRef.current += 1;
    return pollTokenRef.current;
  }, []);

  const pollUntilFinished = useCallback(
    async (
      operationId: string,
      sourceImageFilename: string,
      pollToken: number
    ): Promise<SceneWorldEnvironment> => {
      let latestProgress = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (pollTokenRef.current !== pollToken) {
          throw new Error('Generation cancelled');
        }

        const status = await fetchWorldEnvironmentStatus(operationId);
        if (pollTokenRef.current !== pollToken) {
          throw new Error('Generation cancelled');
        }

        if (status.error) {
          throw new Error(status.error);
        }

        if (!status.done) {
          latestProgress = status.progress ?? latestProgress;
          setProgress(latestProgress);
          await delay(POLL_INTERVAL_MS);
          continue;
        }

        if (!status.result) {
          throw new Error('World generation completed without a usable result');
        }

        isRendererLoadingRef.current = true;
        setProgress(100);
        setPhase('loading');
        const readyEnvironment: SceneWorldEnvironment = {
          worldId: status.result.worldId,
          operationId,
          status: 'ready',
          sourceImageFilename,
          spzUrl: status.result.spzUrl,
          spzUrls: status.result.spzUrls,
          thumbnailUrl: status.result.thumbnailUrl,
          worldMarbleUrl: status.result.worldMarbleUrl,
          createdAt: new Date().toISOString(),
        };
        setCurrentEnvironment(readyEnvironment);
        return readyEnvironment;
      }
    },
    []
  );

  const generateEnvironment = useCallback(
    async (file: File): Promise<SceneWorldEnvironment> => {
      const pollToken = beginWork('uploading');
      try {
        const imageDataUrl = await toDataUrl(file);
        if (pollTokenRef.current !== pollToken) {
          throw new Error('Generation cancelled');
        }

        const created = await startWorldEnvironmentGeneration({
          imageDataUrl,
          imageName: file.name,
        });
        if (pollTokenRef.current !== pollToken) {
          throw new Error('Generation cancelled');
        }

        const pendingEnvironment: SceneWorldEnvironment = {
          worldId: `pending:${created.operationId}`,
          operationId: created.operationId,
          status: 'generating',
          sourceImageFilename: file.name,
          createdAt: new Date().toISOString(),
        };
        setCurrentEnvironment(pendingEnvironment);

        setPhase('generating');
        setProgress(0);
        return await pollUntilFinished(created.operationId, file.name, pollToken);
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'Failed to generate world environment';
        setCurrentEnvironment((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
                errorMessage: message,
              }
            : prev
        );
        setError(message);
        setPhase('error');
        throw nextError instanceof Error ? nextError : new Error(message);
      }
    },
    [beginWork, pollUntilFinished]
  );

  const resumePolling = useCallback(
    async (worldEnvironment: SceneWorldEnvironment): Promise<SceneWorldEnvironment | null> => {
      if (worldEnvironment.status !== 'generating') return null;
      const pollToken = beginWork('generating');
      setCurrentEnvironment(worldEnvironment);
      try {
        setProgress(0);
        return await pollUntilFinished(
          worldEnvironment.operationId,
          worldEnvironment.sourceImageFilename,
          pollToken
        );
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : 'Failed to resume world environment generation';
        const erroredEnvironment = {
          ...worldEnvironment,
          status: 'error' as const,
          errorMessage: message,
        };
        setCurrentEnvironment(erroredEnvironment);
        setError(message);
        setPhase('error');
        return erroredEnvironment;
      }
    },
    [beginWork, pollUntilFinished]
  );

  const cancelGeneration = useCallback(() => {
    pollTokenRef.current += 1;
    isRendererLoadingRef.current = false;
    setCurrentEnvironment(null);
    setPhase('idle');
    setProgress(null);
    setElapsedMs(0);
    startedAtRef.current = null;
  }, []);

  const markEnvironmentReady = useCallback((ready: boolean, errorMessage?: string) => {
    if (!isRendererLoadingRef.current) return;
    if (!ready) {
      if (errorMessage) {
        setCurrentEnvironment((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
                errorMessage,
              }
            : prev
        );
        setError(errorMessage);
        setPhase('error');
        isRendererLoadingRef.current = false;
      } else {
        setPhase('loading');
      }
      return;
    }

    isRendererLoadingRef.current = false;
    setCurrentEnvironment((prev) => (prev ? { ...prev, status: 'ready', errorMessage: undefined } : prev));
    setPhase('ready');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (phase === 'error') {
      setPhase('idle');
    }
  }, [phase]);

  const statusText = useMemo(() => {
    if (phase === 'uploading') return 'Uploading image...';
    if (phase === 'generating') {
      const seconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      const elapsed = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      const progressSuffix = progress !== null && progress > 0 ? ` (${progress}%)` : '';
      return `Generating 3D environment... ${elapsed}${progressSuffix}`;
    }
    if (phase === 'loading') return 'Loading environment...';
    if (phase === 'error') return error ?? 'Something went wrong';
    return null;
  }, [elapsedMs, error, phase, progress]);

  return {
    currentEnvironment,
    phase,
    progress,
    statusText,
    error,
    isWorking: phase === 'uploading' || phase === 'generating' || phase === 'loading',
    generateEnvironment,
    resumePolling,
    cancelGeneration,
    markEnvironmentReady,
    clearError,
  };
}
