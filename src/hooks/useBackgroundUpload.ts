import { useCallback, useState } from 'react';
import type { SceneBackgroundImage } from '../types/sceneSettings';
import {
  removeBackgroundImageFromStorage,
  toBackgroundImageStorageRef,
  uploadBackgroundImageToStorage,
  validateBackgroundImageFile,
} from '../utils/backgroundImageUpload';
import { optimizeBackgroundImage } from '../utils/backgroundImageOptimize';
import { useSupabaseUserId } from './useSupabaseUserId';

interface UseBackgroundUploadResult {
  userId?: string;
  stage: 'idle' | 'optimizing' | 'uploading';
  isUploading: boolean;
  statusText: string | null;
  lastError: string | null;
  uploadBackground: (file: File, projectId: string) => Promise<SceneBackgroundImage>;
  removeBackground: (storageKeyOrRef: string | null | undefined) => Promise<void>;
  clearError: () => void;
}

export function useBackgroundUpload(): UseBackgroundUploadResult {
  const userId = useSupabaseUserId();
  const [stage, setStage] = useState<'idle' | 'optimizing' | 'uploading'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setLastError(null);
    setStatusText(null);
    setStage('idle');
  }, []);

  const uploadBackground = useCallback(
    async (file: File, projectId: string): Promise<SceneBackgroundImage> => {
      const validationError = validateBackgroundImageFile(file);
      if (validationError) {
        setLastError(validationError);
        throw new Error(validationError);
      }
      if (!projectId) {
        const errorMessage = 'Save your project before adding a 360 background image.';
        setLastError(errorMessage);
        throw new Error(errorMessage);
      }
      if (!userId) {
        const errorMessage = 'Sign in to upload 360 background images.';
        setLastError(errorMessage);
        throw new Error(errorMessage);
      }

      setIsUploading(true);
      setStage('optimizing');
      setStatusText('Optimizing image...');
      setLastError(null);

      // Yield two animation frames so the browser paints the loading indicator
      // before heavy image processing (decode + JPEG encode) begins. Without this,
      // React's state update is committed to the DOM but the browser never gets a
      // paint cycle until after the synchronous work completes.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      try {
        const uploadFile = await optimizeBackgroundImage(file);
        setStage('uploading');
        setStatusText('Uploading...');
        const result = await uploadBackgroundImageToStorage(uploadFile, userId, projectId);

        return {
          storageKey: toBackgroundImageStorageRef(result.storagePath),
          filename: file.name,
          fileSize: uploadFile.size,
          signedUrl: result.signedUrl,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload background image.';
        setLastError(message);
        throw error;
      } finally {
        setIsUploading(false);
        setStatusText(null);
        setStage('idle');
      }
    },
    [userId]
  );

  const removeBackground = useCallback(async (storageKeyOrRef: string | null | undefined): Promise<void> => {
    try {
      await removeBackgroundImageFromStorage(storageKeyOrRef);
    } catch {
      // Best effort cleanup; removing local project state is still the source of truth.
    }
  }, []);

  return {
    userId,
    stage,
    isUploading,
    statusText,
    lastError,
    uploadBackground,
    removeBackground,
    clearError,
  };
}
