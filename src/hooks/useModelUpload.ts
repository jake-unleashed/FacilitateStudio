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

import { useCallback, useState, useRef, useEffect } from 'react';
import { SceneObject } from '../types';
import {
  AssetMetadata,
  ModelMetrics,
  UploadProgress,
  INITIAL_UPLOAD_PROGRESS,
  validateModelFile,
} from '../types/model';
import {
  saveAsset,
  getAsset,
  getRecentAssets,
  updateAssetMetadata,
  migrateLegacyAssets,
  hasLegacyAssets,
  blobToArrayBuffer,
} from '../utils/modelAssetStore';
import { loadAndPreprocessModelFromArrayBuffer, extractChildMeshes } from '../utils/modelLoaders';
import { cachePreprocessedModel } from '../utils/modelCache';
import { ChildMesh } from '../types';
import { MODEL_POSITION_SPACING } from '../constants';

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
  /** Upload a file and create a scene object */
  uploadFile: (file: File, existingObjects: SceneObject[]) => Promise<UploadResult | null>;
  /** Add an existing asset to the scene */
  addRecentAssetToScene: (
    asset: AssetMetadata,
    existingObjects: SceneObject[]
  ) => Promise<UploadResult | null>;
  /** Refresh the recent assets list */
  refreshRecentAssets: () => Promise<void>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Reset progress to idle state */
  resetProgress: () => void;
}

// =============================================================================
// Positioning Utilities
// =============================================================================

/**
 * Calculate optimal position for a new model to avoid overlapping existing objects.
 * Uses a spiral pattern to find an empty spot.
 */
function calculateOptimalPosition(
  modelMetrics: ModelMetrics,
  existingObjects: SceneObject[]
): { x: number; y: number; z: number } {
  if (existingObjects.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const spacing = Math.max(MODEL_POSITION_SPACING, modelMetrics.maxDimension * 1.5);

  // Spiral outward to find non-overlapping position
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = attempt * 0.5 * Math.PI;
    const radius = spacing * (1 + Math.floor(attempt / 4));
    const x = Math.round(Math.cos(angle) * radius * 100) / 100;
    const z = Math.round(Math.sin(angle) * radius * 100) / 100;

    const hasOverlap = existingObjects.some((obj) => {
      const dx = obj.transform.x / 100 - x;
      const dz = obj.transform.z / 100 - z;
      return Math.sqrt(dx * dx + dz * dz) < spacing;
    });

    if (!hasOverlap) {
      return { x, y: 0, z };
    }
  }

  // Fallback: return last calculated position
  return { x: spacing * 5, y: 0, z: spacing * 5 };
}

/**
 * Generate a unique name for the model, avoiding duplicates.
 */
function generateUniqueName(baseName: string, existingObjects: SceneObject[]): string {
  // Sanitize: remove extension, special chars, trim
  let name = baseName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .trim()
    .substring(0, 50);

  if (!name) name = 'Uploaded Model';

  const existingNames = new Set(existingObjects.map((obj) => obj.name));

  if (!existingNames.has(name)) return name;

  // Append incrementing number
  let counter = 2;
  while (existingNames.has(`${name} ${counter}`)) {
    counter++;
  }

  return `${name} ${counter}`;
}

/**
 * Create a SceneObject from asset metadata and metrics.
 */
function createSceneObject(
  assetId: string,
  name: string,
  position: { x: number; y: number; z: number },
  children?: ChildMesh[]
): SceneObject {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'mesh',
    transform: {
      x: Math.round(position.x * 100),
      y: Math.round(position.y * 100),
      z: Math.round(position.z * 100),
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    properties: {
      visible: true,
      modelAssetId: assetId,
    },
    children: children && children.length > 0 ? children : undefined,
  };
}

/**
 * Serialize THREE.js metrics to plain JSON objects.
 */
function serializeMetrics(metrics: {
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  bottomY: number;
  topY: number;
  maxDimension: number;
  triangleCount?: number;
}): ModelMetrics {
  return {
    boundingBox: {
      min: {
        x: metrics.boundingBox.min.x,
        y: metrics.boundingBox.min.y,
        z: metrics.boundingBox.min.z,
      },
      max: {
        x: metrics.boundingBox.max.x,
        y: metrics.boundingBox.max.y,
        z: metrics.boundingBox.max.z,
      },
    },
    center: { x: metrics.center.x, y: metrics.center.y, z: metrics.center.z },
    size: { x: metrics.size.x, y: metrics.size.y, z: metrics.size.z },
    bottomY: metrics.bottomY,
    topY: metrics.topY,
    maxDimension: metrics.maxDimension,
    triangleCount: metrics.triangleCount,
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useModelUpload(options: UseModelUploadOptions = {}): UseModelUploadReturn {
  const { onSuccess, onError } = options;

  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(INITIAL_UPLOAD_PROGRESS);
  const [recentAssets, setRecentAssets] = useState<AssetMetadata[]>([]);
  const hasMigratedRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Initialization: Migrate legacy assets and load recent assets
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const init = async () => {
      // Run migration once
      if (!hasMigratedRef.current && hasLegacyAssets()) {
        hasMigratedRef.current = true;
        try {
          const count = await migrateLegacyAssets();
          if (count > 0) {
            console.log(`[useModelUpload] Migrated ${count} legacy assets`);
          }
        } catch (error) {
          console.error('[useModelUpload] Migration failed:', error);
        }
      }

      // Load recent assets
      try {
        setRecentAssets(await getRecentAssets(20));
      } catch (error) {
        console.error('[useModelUpload] Failed to load recent assets:', error);
      }
    };

    init();
  }, []);

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
    (fileName: string, error: string) => {
      setUploadProgress({
        stage: 'error',
        fileName,
        progress: 0,
        error,
        warning: null,
      });
      onError?.(error);
    },
    [onError]
  );

  const resetProgress = useCallback(() => {
    setUploadProgress(INITIAL_UPLOAD_PROGRESS);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-reset progress after successful upload
  // ---------------------------------------------------------------------------

  // Auto-reset delay: Time to show "Added to scene" message before resetting to "Upload Asset"
  const AUTO_RESET_DELAY_MS = 2500;

  useEffect(() => {
    // Clear any existing timeout when stage changes
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    // If upload completes successfully, auto-reset after delay
    if (uploadProgress.stage === 'complete') {
      resetTimeoutRef.current = setTimeout(() => {
        resetProgress();
        resetTimeoutRef.current = null;
      }, AUTO_RESET_DELAY_MS);
    }

    // Cleanup: clear timeout on unmount or when stage changes
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [uploadProgress.stage, resetProgress]);

  // ---------------------------------------------------------------------------
  // Refresh Recent Assets
  // ---------------------------------------------------------------------------

  const refreshRecentAssets = useCallback(async () => {
    try {
      setRecentAssets(await getRecentAssets(20));
    } catch (error) {
      console.error('[useModelUpload] Failed to refresh recent assets:', error);
    }
  }, []);

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
      existingChildren?: ChildMesh[]
    ): Promise<UploadResult | null> => {
      // Get metrics (compute if not provided)
      let metrics = existingMetrics;
      let children = existingChildren;

      if (!metrics) {
        setProgress('processing', 50, { fileName: assetName });

        const assetData = await getAsset(assetId);
        if (!assetData) {
          setError(assetName, 'Asset not found');
          return null;
        }

        try {
          // Use ArrayBuffer for proper embedded texture support in GLB/FBX
          const arrayBuffer = await blobToArrayBuffer(assetData.blob);
          const preprocessed = await loadAndPreprocessModelFromArrayBuffer(arrayBuffer, fileType);
          metrics = serializeMetrics(preprocessed.metrics);

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
      }

      // Create scene object
      setProgress('adding', 85, { fileName: assetName });

      const position = calculateOptimalPosition(metrics, existingObjects);
      const uniqueName = generateUniqueName(assetName, existingObjects);
      const sceneObject = createSceneObject(assetId, uniqueName, position, children);

      // Complete
      setProgress('complete', 100, { fileName: assetName });

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
    [onSuccess, setProgress, setError]
  );

  // ---------------------------------------------------------------------------
  // Upload File
  // ---------------------------------------------------------------------------

  const uploadFile = useCallback(
    async (file: File, existingObjects: SceneObject[]): Promise<UploadResult | null> => {
      try {
        // Stage 1: Validate
        setProgress('validating', 10, { fileName: file.name, warning: null });

        const validation = validateModelFile(file);
        if (!validation.valid) {
          setError(file.name, validation.error ?? 'Invalid file');
          return null;
        }

        // Stage 2: Store in IndexedDB
        setProgress('storing', 25, { fileName: file.name, warning: validation.warning ?? null });

        let metadata: AssetMetadata;
        try {
          metadata = await saveAsset(file);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to store file';
          setError(file.name, msg);
          return null;
        }

        // Stage 3-4: Process and add to scene
        const result = await processAsset(
          metadata.id,
          file.name,
          metadata.fileType,
          existingObjects
        );

        if (result) {
          await refreshRecentAssets();
        }

        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Upload failed';
        setError(file.name, msg);
        return null;
      }
    },
    [processAsset, refreshRecentAssets, setProgress, setError]
  );

  // ---------------------------------------------------------------------------
  // Add Recent Asset to Scene
  // ---------------------------------------------------------------------------

  const addRecentAssetToScene = useCallback(
    async (asset: AssetMetadata, existingObjects: SceneObject[]): Promise<UploadResult | null> => {
      try {
        // Pass cached metrics AND children from asset metadata
        // This avoids re-extraction when adding from recent assets
        return await processAsset(
          asset.id,
          asset.name,
          asset.fileType,
          existingObjects,
          asset.metrics,
          asset.children
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
  // Derived State
  // ---------------------------------------------------------------------------

  const isUploading =
    uploadProgress.stage !== 'idle' &&
    uploadProgress.stage !== 'complete' &&
    uploadProgress.stage !== 'error';

  return {
    uploadProgress,
    recentAssets,
    uploadFile,
    addRecentAssetToScene,
    refreshRecentAssets,
    isUploading,
    resetProgress,
  };
}
