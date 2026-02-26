import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneBackgroundImage } from '../types/sceneSettings';
import { useBackgroundUpload } from './useBackgroundUpload';

export type BackgroundImageFlowPhase =
  | 'idle'
  | 'optimizing'
  | 'uploading'
  | 'preparingScene'
  | 'ready'
  | 'error';

interface UseBackgroundImageFlowResult {
  userId?: string;
  phase: BackgroundImageFlowPhase;
  isUploadingBackground: boolean;
  isBackgroundTextureLoading: boolean;
  backgroundUploadStatusText: string | null;
  backgroundUploadError: string | null;
  uploadBackgroundAndPrepare: (file: File, projectId: string) => Promise<SceneBackgroundImage>;
  removeBackground: (storageKeyOrRef: string | null | undefined) => Promise<void>;
  handleBackgroundReadyChange: (ready: boolean, imageUrl?: string, errorMessage?: string) => void;
  syncBackgroundImageUrl: (imageUrl?: string) => void;
  clearError: () => void;
}

/**
 * Unified controller for the 360 background image UX.
 *
 * It composes the upload/optimize/storage pipeline with the Three.js texture readiness
 * callbacks, producing a single phase model so the sidebar never shows a “limbo” state.
 */
export function useBackgroundImageFlow(): UseBackgroundImageFlowResult {
  const {
    userId,
    stage,
    isUploading,
    statusText,
    lastError,
    uploadBackground,
    removeBackground,
    clearError: clearUploadError,
  } = useBackgroundUpload();

  const [phase, setPhase] = useState<BackgroundImageFlowPhase>('idle');
  const [textureLoadError, setTextureLoadError] = useState<string | null>(null);
  const expectedTextureUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isUploading) return;
    if (stage === 'optimizing') setPhase('optimizing');
    if (stage === 'uploading') setPhase('uploading');
  }, [isUploading, stage]);

  useEffect(() => {
    if (!lastError) return;
    setPhase('error');
  }, [lastError]);

  const uploadBackgroundAndPrepare = useCallback(
    async (file: File, projectId: string): Promise<SceneBackgroundImage> => {
      setTextureLoadError(null);
      const uploadedBackground = await uploadBackground(file, projectId);
      expectedTextureUrlRef.current = uploadedBackground.signedUrl;
      setPhase('preparingScene');
      return uploadedBackground;
    },
    [uploadBackground]
  );

  const handleBackgroundReadyChange = useCallback((ready: boolean, imageUrl?: string, errorMessage?: string) => {
    const expectedTextureUrl = expectedTextureUrlRef.current;
    if (errorMessage) {
      if (!expectedTextureUrl || !imageUrl || imageUrl === expectedTextureUrl) {
        setTextureLoadError(errorMessage);
        setPhase('error');
      }
      return;
    }
    if (!ready) {
      if (!expectedTextureUrl || !imageUrl || imageUrl === expectedTextureUrl) {
        setPhase('preparingScene');
      }
      return;
    }

    if (expectedTextureUrl && imageUrl && imageUrl !== expectedTextureUrl) {
      return;
    }
    expectedTextureUrlRef.current = undefined;
    setPhase('ready');
  }, []);

  const syncBackgroundImageUrl = useCallback(
    (imageUrl?: string) => {
      if (isUploading) return;
      if (!imageUrl) {
        expectedTextureUrlRef.current = undefined;
        setTextureLoadError(null);
        setPhase((prev) => (prev === 'error' ? prev : 'idle'));
      }
    },
    [isUploading]
  );

  const clearError = useCallback(() => {
    clearUploadError();
    setTextureLoadError(null);
    setPhase('idle');
  }, [clearUploadError]);

  const removeBackgroundWithPhaseReset = useCallback(
    async (storageKeyOrRef: string | null | undefined): Promise<void> => {
      expectedTextureUrlRef.current = undefined;
      setTextureLoadError(null);
      await removeBackground(storageKeyOrRef);
      setPhase('idle');
    },
    [removeBackground]
  );

  const backgroundUploadStatusText = useMemo(() => {
    if (phase === 'optimizing') return statusText ?? 'Optimizing image...';
    if (phase === 'uploading') return statusText ?? 'Uploading...';
    if (phase === 'preparingScene') return 'Preparing scene...';
    return null;
  }, [phase, statusText]);

  return {
    userId,
    phase,
    isUploadingBackground: phase === 'optimizing' || phase === 'uploading',
    isBackgroundTextureLoading: phase === 'preparingScene',
    backgroundUploadStatusText,
    backgroundUploadError: lastError ?? textureLoadError,
    uploadBackgroundAndPrepare,
    removeBackground: removeBackgroundWithPhaseReset,
    handleBackgroundReadyChange,
    syncBackgroundImageUrl,
    clearError,
  };
}
