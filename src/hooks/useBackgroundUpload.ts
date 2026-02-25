import { useCallback, useEffect, useState } from 'react';
import type { SceneBackgroundImage } from '../types/sceneSettings';
import { supabase } from '../lib/supabase';
import {
  isValidBackgroundImageFileType,
  MAX_BACKGROUND_IMAGE_SIZE_BYTES,
  removeBackgroundImageFromStorage,
  toBackgroundImageStorageRef,
  uploadBackgroundImageToStorage,
} from '../utils/backgroundImageUpload';

interface UseBackgroundUploadResult {
  userId?: string;
  isUploading: boolean;
  lastError: string | null;
  uploadBackground: (file: File, projectId: string) => Promise<SceneBackgroundImage>;
  removeBackground: (storageKeyOrRef: string | null | undefined) => Promise<void>;
  clearError: () => void;
}

function validateBackgroundImage(file: File): string | null {
  if (!isValidBackgroundImageFileType(file.type)) {
    return 'Use a JPG, PNG, or WebP image for the 360 background.';
  }
  if (file.size > MAX_BACKGROUND_IMAGE_SIZE_BYTES) {
    return 'Background image must be 25MB or smaller.';
  }
  return null;
}

export function useBackgroundUpload(): UseBackgroundUploadResult {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (isActive) {
        setUserId(data.user?.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) {
        setUserId(session?.user.id);
      }
    });

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const uploadBackground = useCallback(
    async (file: File, projectId: string): Promise<SceneBackgroundImage> => {
      const validationError = validateBackgroundImage(file);
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
      setLastError(null);
      try {
        const result = await uploadBackgroundImageToStorage(file, userId, projectId);
        if (!result) {
          const errorMessage = 'Failed to upload background image. Please try again.';
          setLastError(errorMessage);
          throw new Error(errorMessage);
        }

        return {
          storageKey: toBackgroundImageStorageRef(result.storagePath),
          filename: file.name,
          fileSize: file.size,
          signedUrl: result.signedUrl,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload background image.';
        setLastError(message);
        throw error;
      } finally {
        setIsUploading(false);
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
    isUploading,
    lastError,
    uploadBackground,
    removeBackground,
    clearError,
  };
}
