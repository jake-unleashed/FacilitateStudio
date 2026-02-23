/**
 * useModelUpload Hook
 *
 * Manages the complete model upload lifecycle:
 * - File validation and storage in IndexedDB
 * - Model preprocessing and caching
 * - Scene object creation with optimal positioning
 * - Progress tracking for UI feedback
 *
 * Designed for clean separation between storage/processing and scene logic.
 */

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import type { SceneObject } from '../types';
import {
  AssetMetadata,
  ModelMetrics,
  UploadProgress,
  INITIAL_UPLOAD_PROGRESS,
  validateModelFile,
} from '../types/model';
import {
  saveAssetWithTextures,
  getAsset,
  getRecentAssets,
  syncAssetToCloud,
  updateAssetMetadata,
  deleteAsset,
  blobToArrayBuffer,
} from '../utils/modelAssetStore';
import { loadAndPreprocessModelFromArrayBuffer, extractChildMeshes } from '../utils/modelLoaders';
import { cachePreprocessedModel, getOrLoadModel } from '../utils/modelCache';
import { ChildMesh } from '../types';
import { calculateOptimalPosition, generateUniqueName } from './modelUpload/positioning';
import { createSceneObject } from './modelUpload/sceneObject';
import { serializeMetrics } from './modelUpload/metrics';
import { useModelUploadInit } from './modelUpload/useModelUploadInit';
import { useAutoResetProgress } from './modelUpload/useAutoResetProgress';
import { getStarterAssetIds } from '../utils/starterAssets/seedStarterAssets';
import { supabase } from '../lib/supabase';

// Re-export types for convenience
export type { UploadProgress };
export type { UploadStage } from '../types/model';

// =============================================================================
// Types
// =============================================================================

export interface UploadResult {
  assetMetadata: AssetMetadata;
  sceneObject: SceneObject;
  metrics: ModelMetrics;
}

interface UseModelUploadOptions {
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

interface UseModelUploadReturn {
  /** Current upload progress for UI feedback */
  uploadProgress: UploadProgress;
  /** List of recent assets for the library */
  recentAssets: AssetMetadata[];
  /** List of starter assets (seeded from app) */
  starterAssets: AssetMetadata[];
  /** Upload a file and optional textures, then create a scene object */
  uploadFile: (
    file: File,
    existingObjects: SceneObject[],
    textureFiles?: File[]
  ) => Promise<UploadResult | null>;
  /** Add an existing asset to the scene */
  addRecentAssetToScene: (
    asset: AssetMetadata,
    existingObjects: SceneObject[]
  ) => Promise<UploadResult | null>;
  /** Remove an asset from storage */
  removeAsset: (assetId: string) => Promise<void>;
  /** Refresh the recent assets list */
  refreshRecentAssets: () => Promise<void>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Reset progress to idle state */
  resetProgress: () => void;
  /** Last error that occurred (shown in toast, independent of upload stage) */
  lastError: string | null;
  /** Clear the last error (dismiss the toast) */
  clearError: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useModelUpload(options: UseModelUploadOptions = {}): UseModelUploadReturn {
  const { onSuccess, onError } = options;
  const [userId, setUserId] = useState<string | undefined>(undefined);

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

  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(INITIAL_UPLOAD_PROGRESS);
  const [recentAssets, setRecentAssets] = useState<AssetMetadata[]>([]);
  // Separate error state for toast display - independent from upload stage
  // This allows the button to stay usable while showing the error
  const [lastError, setLastError] = useState<string | null>(null);
  const hasMigratedRef = useRef(false);
  useModelUploadInit({ setRecentAssets, hasMigratedRef, userId });

  // Separate starter assets from recent uploads
  const starterAssetIds = useMemo(() => new Set(getStarterAssetIds()), []);
  
  const starterAssets = useMemo(
    () => recentAssets.filter((asset) => starterAssetIds.has(asset.id)),
    [recentAssets, starterAssetIds]
  );

  const userRecentAssets = useMemo(
    () => recentAssets.filter((asset) => !starterAssetIds.has(asset.id)),
    [recentAssets, starterAssetIds]
  );

  // (init behavior extracted to useModelUploadInit)

  // ---------------------------------------------------------------------------
  // Progress Helpers
  // ---------------------------------------------------------------------------

  const setProgress = useCallback(
    (stage: UploadProgress['stage'], progress: number, overrides: Partial<UploadProgress> = {}) => {
      setUploadProgress((prev) => ({
        ...prev,
        stage,
        progress,
        error: null,
        ...overrides,
      }));
    },
    []
  );

  const setError = useCallback(
    (_fileName: string, error: string) => {
      // Set the error for toast display
      setLastError(error);
      // Reset the upload progress to idle so the button stays usable
      // The error is shown in a separate toast, not in the button
      setUploadProgress(INITIAL_UPLOAD_PROGRESS);
      onError?.(error);
    },
    [onError]
  );

  const resetProgress = useCallback(() => {
    setUploadProgress(INITIAL_UPLOAD_PROGRESS);
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-reset progress after successful upload
  // ---------------------------------------------------------------------------

  useAutoResetProgress({ stage: uploadProgress.stage, resetProgress });

  // ---------------------------------------------------------------------------
  // Refresh Recent Assets
  // ---------------------------------------------------------------------------

  const refreshRecentAssets = useCallback(async () => {
    try {
      setRecentAssets(await (userId ? getRecentAssets(20, { userId }) : getRecentAssets(20)));
    } catch (error) {
      console.error('[useModelUpload] Failed to refresh recent assets:', error);
      // Non-critical error - don't show popup, but set error for toast display
      setLastError('Failed to load asset library. Try refreshing the page.');
    }
  }, [userId]);

  // ---------------------------------------------------------------------------
  // Core: Process Asset (shared between upload and add-from-library)
  // ---------------------------------------------------------------------------

  const processAsset = useCallback(
    async (
      assetId: string,
      assetName: string,
      fileType: AssetMetadata['fileType'],
      existingObjects: SceneObject[],
      existingMetrics?: ModelMetrics,
      existingChildren?: ChildMesh[],
      /** Skip progress updates (used for recent assets where feedback is shown on the card) */
      skipProgressUpdates?: boolean
    ): Promise<UploadResult | null> => {
      // Get metrics (compute if not provided)
      let metrics = existingMetrics;
      let children = existingChildren;

      if (!metrics) {
        if (!skipProgressUpdates) {
          setProgress('processing', 50, { fileName: assetName });
        }

        const assetData = await (userId ? getAsset(assetId, { userId }) : getAsset(assetId));
        if (!assetData) {
          setError(assetName, 'Asset not found');
          return null;
        }

        try {
          // Use ArrayBuffer for proper embedded texture support in GLB/FBX
          const arrayBuffer = await blobToArrayBuffer(assetData.blob);
          const preprocessed = await loadAndPreprocessModelFromArrayBuffer(
            arrayBuffer,
            fileType,
            undefined,
            assetData.textures
          );
          // Include originalScale from preprocessing to track the normalization factor
          metrics = serializeMetrics(preprocessed.metrics, preprocessed.originalScale);

          // Extract child meshes from the model hierarchy
          children = extractChildMeshes(preprocessed.model);

          // Cache the model
          cachePreprocessedModel(assetId, preprocessed.model, metrics);

          // Persist metrics AND children to asset metadata for reuse
          await updateAssetMetadata(assetId, { metrics, children });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to process model';
          setError(assetName, `Invalid model: ${msg}`);
          return null;
        }
      } else if (children === undefined) {
        try {
          const { model } = await getOrLoadModel(assetId);
          children = extractChildMeshes(model);
          await updateAssetMetadata(assetId, { children });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to extract model children';
          setError(assetName, `Invalid model: ${msg}`);
          return null;
        }
      }

      // Create scene object
      if (!skipProgressUpdates) {
        setProgress('adding', 85, { fileName: assetName });
      }

      const position = calculateOptimalPosition(metrics, existingObjects);
      const uniqueName = generateUniqueName(assetName, existingObjects);
      const sceneObject = createSceneObject(assetId, uniqueName, position, metrics, children);

      // Complete (only update progress for actual uploads, not recent assets)
      if (!skipProgressUpdates) {
        setProgress('complete', 100, { fileName: assetName });
      }

      const result: UploadResult = {
        assetMetadata: {
          id: assetId,
          name: assetName,
          fileType,
          fileSize: 0, // Not needed for result
          uploadDate: new Date().toISOString(),
          metrics,
        },
        sceneObject,
        metrics,
      };

      onSuccess?.(result);
      return result;
    },
    [onSuccess, setProgress, setError, userId]
  );

  // ---------------------------------------------------------------------------
  // Upload File
  // ---------------------------------------------------------------------------

  const uploadFile = useCallback(
    async (
      file: File,
      existingObjects: SceneObject[],
      textureFiles: File[] = []
    ): Promise<UploadResult | null> => {
      try {
        const textureCount = textureFiles.length;
        const uploadDisplayName =
          textureCount > 0 ? `${file.name} + ${textureCount} texture${textureCount === 1 ? '' : 's'}` : file.name;

        // Stage 1: Validate
        setProgress('validating', 10, { fileName: uploadDisplayName, warning: null });

        const validation = validateModelFile(file);
        if (!validation.valid) {
          setError(file.name, validation.error ?? 'Invalid file');
          return null;
        }

        // Stage 2: Store in IndexedDB
        setProgress('storing', 25, {
          fileName: uploadDisplayName,
          warning: validation.warning ?? null,
        });

        let metadata: AssetMetadata;
        try {
          metadata = await saveAssetWithTextures(file, textureFiles);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to store file';
          setError(file.name, msg);
          return null;
        }
        if (userId && !starterAssetIds.has(metadata.id)) {
          void syncAssetToCloud(metadata.id, { userId }).catch((cloudError) => {
            console.warn('[useModelUpload] Cloud upload failed; keeping local copy:', cloudError);
            setLastError('Model saved locally, but cloud sync failed. We will retry on next upload.');
          });
        }

        // Stage 3-4: Process and add to scene
        const result = await processAsset(
          metadata.id,
          uploadDisplayName,
          metadata.fileType,
          existingObjects
        );

        if (result) {
          await refreshRecentAssets();
        } else {
          // Processing failed - clean up the stored asset so it doesn't appear in recent list
          await deleteAsset(metadata.id);
        }

        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Upload failed';
        setError(file.name, msg);
        return null;
      }
    },
    [
      processAsset,
      refreshRecentAssets,
      setProgress,
      setError,
      setLastError,
      starterAssetIds,
      userId,
    ]
  );

  // ---------------------------------------------------------------------------
  // Add Recent Asset to Scene
  // ---------------------------------------------------------------------------

  const addRecentAssetToScene = useCallback(
    async (asset: AssetMetadata, existingObjects: SceneObject[]): Promise<UploadResult | null> => {
      try {
        // Pass cached metrics AND children from asset metadata
        // This avoids re-extraction when adding from recent assets
        // Skip progress updates - feedback is shown on the asset card instead
        return await processAsset(
          asset.id,
          asset.name,
          asset.fileType,
          existingObjects,
          asset.metrics,
          asset.children,
          true // skipProgressUpdates - recent asset cards handle their own feedback
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to add asset';
        setError(asset.name, msg);
        return null;
      }
    },
    [processAsset, setError]
  );

  // ---------------------------------------------------------------------------
  // Remove Asset
  // ---------------------------------------------------------------------------

  const removeAsset = useCallback(
    async (assetId: string): Promise<void> => {
      try {
        const hasUserId = typeof userId === 'string' && userId.length > 0;
        if (hasUserId) {
          await deleteAsset(assetId, { userId });
        } else {
          await deleteAsset(assetId);
        }
        await refreshRecentAssets();
      } catch (error) {
        console.error('[useModelUpload] Failed to remove asset:', error);
        setError(
          assetId,
          error instanceof Error ? error.message : 'Failed to remove asset. Please try again.'
        );
      }
    },
    [refreshRecentAssets, setError, userId]
  );

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const isUploading =
    uploadProgress.stage !== 'idle' &&
    uploadProgress.stage !== 'complete' &&
    uploadProgress.stage !== 'error';

  return {
    uploadProgress,
    recentAssets: userRecentAssets,
    starterAssets,
    uploadFile,
    addRecentAssetToScene,
    removeAsset,
    refreshRecentAssets,
    isUploading,
    resetProgress,
    lastError,
    clearError,
  };
}
