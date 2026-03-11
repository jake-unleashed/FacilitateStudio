import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { SceneWorldEnvironment } from '../types/sceneSettings';
import type { WorldEnvironmentFlowPhase } from '../types/worldEnvironment';
import {
  fetchWorldEnvironmentStatus,
  startWorldEnvironmentGeneration,
} from '../services/worldEnvironmentService';
import { getErrorMessage } from '../utils/errors';

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

/**
 * Manage the upload, polling, cancellation, and readiness lifecycle for
 * generated 3D environments created from a source image.
 */
export function useWorldEnvironmentFlow(): UseWorldEnvironmentFlowResult {
  const [currentEnvironment, setCurrentEnvironment] = useState<SceneWorldEnvironment | null>(null);
  const [phase, setPhase] = useState<WorldEnvironmentFlowPhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const pollTokenRef = useRef(0);
  const isRendererLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  const setCurrentEnvironmentSafe = useCallback(
    (value: SetStateAction<SceneWorldEnvironment | null>) => {
      if (!isMountedRef.current) return;
      setCurrentEnvironment(value);
    },
    []
  );
  const setPhaseSafe = useCallback((value: WorldEnvironmentFlowPhase) => {
    if (!isMountedRef.current) return;
    setPhase(value);
  }, []);
  const setProgressSafe = useCallback((value: number | null) => {
    if (!isMountedRef.current) return;
    setProgress(value);
  }, []);
  const setErrorSafe = useCallback((value: string | null) => {
    if (!isMountedRef.current) return;
    setError(value);
  }, []);
  const setElapsedMsSafe = useCallback((value: number) => {
    if (!isMountedRef.current) return;
    setElapsedMs(value);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedMsSafe(Date.now() - startedAtRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, setElapsedMsSafe]);

  const beginWork = useCallback((nextPhase: WorldEnvironmentFlowPhase) => {
    setErrorSafe(null);
    setPhaseSafe(nextPhase);
    setProgressSafe(null);
    startedAtRef.current = Date.now();
    setElapsedMsSafe(0);
    pollTokenRef.current += 1;
    return pollTokenRef.current;
  }, [setElapsedMsSafe, setErrorSafe, setPhaseSafe, setProgressSafe]);

  const waitForNextPoll = useCallback(async (pollToken: number) => {
    const stepMs = 500;
    let remainingMs = POLL_INTERVAL_MS;
    while (remainingMs > 0) {
      if (!isMountedRef.current || pollTokenRef.current !== pollToken) {
        throw new Error('Generation cancelled');
      }
      const currentDelay = Math.min(stepMs, remainingMs);
      await delay(currentDelay);
      remainingMs -= currentDelay;
    }
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
          setProgressSafe(latestProgress);
          await waitForNextPoll(pollToken);
          continue;
        }

        if (!status.result) {
          throw new Error('World generation completed without a usable result');
        }

        isRendererLoadingRef.current = true;
        setProgressSafe(100);
        setPhaseSafe('loading');
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
        setCurrentEnvironmentSafe(readyEnvironment);
        return readyEnvironment;
      }
    },
    [setCurrentEnvironmentSafe, setPhaseSafe, setProgressSafe, waitForNextPoll]
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
        setCurrentEnvironmentSafe(pendingEnvironment);

        setPhaseSafe('generating');
        setProgressSafe(0);
        return await pollUntilFinished(created.operationId, file.name, pollToken);
      } catch (nextError) {
        const message = getErrorMessage(nextError, 'Failed to generate world environment');
        if (message === 'Generation cancelled') {
          throw nextError instanceof Error ? nextError : new Error(message);
        }
        setCurrentEnvironmentSafe((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
                errorMessage: message,
              }
            : prev
        );
        setErrorSafe(message);
        setPhaseSafe('error');
        throw nextError instanceof Error ? nextError : new Error(message);
      }
    },
    [beginWork, pollUntilFinished, setCurrentEnvironmentSafe, setErrorSafe, setPhaseSafe, setProgressSafe]
  );

  const resumePolling = useCallback(
    async (worldEnvironment: SceneWorldEnvironment): Promise<SceneWorldEnvironment | null> => {
      if (worldEnvironment.status !== 'generating') return null;
      const pollToken = beginWork('generating');
      setCurrentEnvironmentSafe(worldEnvironment);
      try {
        setProgressSafe(0);
        return await pollUntilFinished(
          worldEnvironment.operationId,
          worldEnvironment.sourceImageFilename,
          pollToken
        );
      } catch (nextError) {
        const message = getErrorMessage(nextError, 'Failed to resume world environment generation');
        const erroredEnvironment = {
          ...worldEnvironment,
          status: 'error' as const,
          errorMessage: message,
        };
        if (message === 'Generation cancelled') {
          return null;
        }
        setCurrentEnvironmentSafe(erroredEnvironment);
        setErrorSafe(message);
        setPhaseSafe('error');
        return erroredEnvironment;
      }
    },
    [beginWork, pollUntilFinished, setCurrentEnvironmentSafe, setErrorSafe, setPhaseSafe, setProgressSafe]
  );

  const cancelGeneration = useCallback(() => {
    pollTokenRef.current += 1;
    isRendererLoadingRef.current = false;
    setCurrentEnvironmentSafe(null);
    setPhaseSafe('idle');
    setProgressSafe(null);
    setElapsedMsSafe(0);
    startedAtRef.current = null;
  }, [setCurrentEnvironmentSafe, setElapsedMsSafe, setPhaseSafe, setProgressSafe]);

  const markEnvironmentReady = useCallback((ready: boolean, errorMessage?: string) => {
    if (!isRendererLoadingRef.current) return;
    if (!ready) {
      if (errorMessage) {
        setCurrentEnvironmentSafe((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
                errorMessage,
              }
            : prev
        );
        setErrorSafe(errorMessage);
        setPhaseSafe('error');
        isRendererLoadingRef.current = false;
      } else {
        setPhaseSafe('loading');
      }
      return;
    }

    isRendererLoadingRef.current = false;
    setCurrentEnvironmentSafe((prev) => (prev ? { ...prev, status: 'ready', errorMessage: undefined } : prev));
    setPhaseSafe('ready');
  }, [setCurrentEnvironmentSafe, setErrorSafe, setPhaseSafe]);

  const clearError = useCallback(() => {
    setErrorSafe(null);
    if (phase === 'error') {
      setPhaseSafe('idle');
    }
  }, [phase, setErrorSafe, setPhaseSafe]);

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
