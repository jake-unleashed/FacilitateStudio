/**
 * Tests for useModelUpload hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { useModelUpload } from './useModelUpload';
import type { AssetMetadata, ImportDiagnostics } from '../types/model';
import type { ModelMetrics, PreprocessedModel } from '../utils/modelPreprocessing';

// Mock dependencies
vi.mock('../utils/modelAssetStore', () => ({
  saveAssetWithTextures: vi.fn(),
  getAsset: vi.fn(),
  getAssetMetadata: vi.fn().mockResolvedValue(null),
  getRecentAssets: vi.fn().mockResolvedValue([]),
  syncAssetToCloud: vi.fn().mockResolvedValue(undefined),
  updateAssetMetadata: vi.fn(),
  deleteAsset: vi.fn().mockResolvedValue(undefined),
  upsertAssetFromBlob: vi.fn(),
  migrateLegacyAssets: vi.fn().mockResolvedValue(0),
  hasLegacyAssets: vi.fn().mockReturnValue(false),
  blobToArrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
}));

vi.mock('../utils/assetSyncReconciler', () => ({
  reconcilePendingSync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('../utils/modelLoaders', () => ({
  loadAndPreprocessModelFromArrayBuffer: vi.fn(),
  extractChildMeshes: vi.fn().mockReturnValue([]),
}));

vi.mock('../utils/modelCache', () => ({
  cachePreprocessedModel: vi.fn(),
  getOrLoadModel: vi.fn(),
}));

vi.mock('./useStarterAssets', () => ({
  useStarterAssets: vi.fn().mockReturnValue({
    assets: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../utils/starterAssets/ensureStarterAssetCached', () => ({
  ensureStarterAssetCached: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/starterAssets/starterAssetEvents', () => ({
  subscribeToStarterAssetsUpdated: vi.fn(() => () => undefined),
}));

// Import mocked modules for assertions
import {
  saveAssetWithTextures,
  getAsset,
  getAssetMetadata,
  getRecentAssets,
  updateAssetMetadata,
  deleteAsset,
  hasLegacyAssets,
  migrateLegacyAssets,
} from '../utils/modelAssetStore';
import { extractChildMeshes, loadAndPreprocessModelFromArrayBuffer } from '../utils/modelLoaders';
import { cachePreprocessedModel, getOrLoadModel } from '../utils/modelCache';

describe('useModelUpload', () => {
  // ===========================================================================
  // Test Data
  // ===========================================================================

  function createMockFile(name: string, size = 1024): File {
    const blob = new Blob(['x'.repeat(size)], { type: 'application/octet-stream' });
    return new File([blob], name, { type: 'application/octet-stream' });
  }

  function createMockMetadata(id = 'asset_123'): AssetMetadata {
    return {
      id,
      name: 'model.obj',
      fileType: 'obj',
      fileSize: 1024,
      uploadDate: new Date().toISOString(),
    };
  }

  function createMockMetrics(): ModelMetrics {
    return {
      boundingBox: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
      center: new THREE.Vector3(0, 0.5, 0),
      size: new THREE.Vector3(1, 1, 1),
      bottomY: 0,
      topY: 1,
      maxDimension: 1,
      triangleCount: 12,
    };
  }

  function createMockPreprocessedModel(): PreprocessedModel {
    const importDiagnostics: ImportDiagnostics = {
      fileType: 'obj',
      warnings: [],
      repairedNormalsMeshCount: 0,
      suspiciousMaterialCount: 0,
      missingTextureDataCount: 0,
    };

    return {
      model: new THREE.Group(),
      metrics: createMockMetrics(),
      originalScale: 1,
      importDiagnostics,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    vi.mocked(getAssetMetadata).mockResolvedValue(null);
    vi.mocked(getRecentAssets).mockResolvedValue([]);
    vi.mocked(hasLegacyAssets).mockReturnValue(false);
    vi.mocked(migrateLegacyAssets).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('initial state', () => {
    it('returns idle upload progress', () => {
      const { result } = renderHook(() => useModelUpload());

      expect(result.current.uploadProgress).toEqual({
        stage: 'idle',
        fileName: null,
        progress: 0,
        error: null,
        warning: null,
      });
    });

    it('returns empty recent assets initially', () => {
      const { result } = renderHook(() => useModelUpload());

      expect(result.current.recentAssets).toEqual([]);
    });

    it('returns isUploading as false initially', () => {
      const { result } = renderHook(() => useModelUpload());

      expect(result.current.isUploading).toBe(false);
    });

    it('provides all expected functions', () => {
      const { result } = renderHook(() => useModelUpload());

      expect(typeof result.current.uploadFile).toBe('function');
      expect(typeof result.current.addRecentAssetToScene).toBe('function');
      expect(typeof result.current.refreshRecentAssets).toBe('function');
      expect(typeof result.current.resetProgress).toBe('function');
    });
  });

  // ===========================================================================
  // Initialization
  // ===========================================================================

  describe('initialization', () => {
    it('loads recent assets on mount', async () => {
      const mockAssets = [createMockMetadata('1'), createMockMetadata('2')];
      vi.mocked(getRecentAssets).mockResolvedValue(mockAssets);

      const { result } = renderHook(() => useModelUpload());

      await waitFor(() => {
        expect(result.current.recentAssets).toEqual(mockAssets);
      });
    });

    it('checks for legacy assets on mount', async () => {
      renderHook(() => useModelUpload());

      await waitFor(() => {
        expect(hasLegacyAssets).toHaveBeenCalled();
      });
    });

    it('migrates legacy assets if present', async () => {
      vi.mocked(hasLegacyAssets).mockReturnValue(true);
      vi.mocked(migrateLegacyAssets).mockResolvedValue(3);

      renderHook(() => useModelUpload());

      await waitFor(() => {
        expect(migrateLegacyAssets).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // refreshRecentAssets
  // ===========================================================================

  describe('refreshRecentAssets', () => {
    it('updates recent assets list', async () => {
      const { result } = renderHook(() => useModelUpload());

      const newAssets = [createMockMetadata('new_1'), createMockMetadata('new_2')];
      vi.mocked(getRecentAssets).mockResolvedValue(newAssets);

      await act(async () => {
        await result.current.refreshRecentAssets();
      });

      expect(result.current.recentAssets).toEqual(newAssets);
    });
  });

  // ===========================================================================
  // resetProgress
  // ===========================================================================

  describe('resetProgress', () => {
    it('resets progress to idle state', async () => {
      const { result } = renderHook(() => useModelUpload());

      // First, trigger an error to change state
      vi.mocked(saveAssetWithTextures).mockRejectedValue(new Error('Test error'));

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // With new behavior, stage resets to 'idle' and error goes to lastError
      expect(result.current.uploadProgress.stage).toBe('idle');
      expect(result.current.lastError).toBe('Test error');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.uploadProgress).toEqual({
        stage: 'idle',
        fileName: null,
        progress: 0,
        error: null,
        warning: null,
      });
      expect(result.current.lastError).toBeNull();
    });
  });

  // ===========================================================================
  // uploadFile - Validation
  // ===========================================================================

  describe('uploadFile - validation', () => {
    it('rejects invalid file types', async () => {
      const { result } = renderHook(() => useModelUpload());

      const file = createMockFile('model.stl');

      await act(async () => {
        await result.current.uploadFile(file, []);
      });

      // With new behavior, stage resets to 'idle' and error goes to lastError
      expect(result.current.uploadProgress.stage).toBe('idle');
      expect(result.current.lastError).toContain('Unsupported file type');
    });

    it('accepts valid file types', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // Should have passed validation
      expect(saveAssetWithTextures).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // uploadFile - Storage
  // ===========================================================================

  describe('uploadFile - storage', () => {
    it('saves file to IndexedDB', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());
      const file = createMockFile('model.obj');

      await act(async () => {
        await result.current.uploadFile(file, []);
      });

      expect(saveAssetWithTextures).toHaveBeenCalledWith(file, [], { extendedSizeLimit: false });
    });

    it('handles storage errors', async () => {
      vi.mocked(saveAssetWithTextures).mockRejectedValue(new Error('Storage quota exceeded'));

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // With new behavior, stage resets to 'idle' and error goes to lastError
      expect(result.current.uploadProgress.stage).toBe('idle');
      expect(result.current.lastError).toContain('Storage quota exceeded');
    });
  });

  // ===========================================================================
  // uploadFile - Processing
  // ===========================================================================

  describe('uploadFile - processing', () => {
    it('processes model after storage', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(loadAndPreprocessModelFromArrayBuffer).toHaveBeenCalled();
    });

    it('caches processed model', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(cachePreprocessedModel).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // uploadFile - Result
  // ===========================================================================

  describe('uploadFile - result', () => {
    it('returns upload result with scene object', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      let uploadResult: Awaited<ReturnType<typeof result.current.uploadFile>> = null;
      await act(async () => {
        uploadResult = await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(uploadResult).not.toBeNull();
      expect(uploadResult!.sceneObject).toBeDefined();
      expect(uploadResult!.sceneObject.type).toBe('mesh');
      expect(uploadResult!.sceneObject.properties.modelAssetId).toBe(metadata.id);
    });

    it('sets complete stage on success', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('complete');
    });
  });

  // ===========================================================================
  // uploadFile - Callbacks
  // ===========================================================================

  describe('uploadFile - callbacks', () => {
    it('calls onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload({ onSuccess }));

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      vi.mocked(saveAssetWithTextures).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useModelUpload({ onError }));

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(onError).toHaveBeenCalledWith('Test error');
    });
  });

  // ===========================================================================
  // addRecentAssetToScene
  // ===========================================================================

  describe('addRecentAssetToScene', () => {
    it('uses cached metrics when available', async () => {
      const metrics = createMockMetrics();
      const metadata = { ...createMockMetadata(), metrics, children: [] };

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.addRecentAssetToScene(metadata, []);
      });

      // Should not need to load and preprocess since metrics are cached
      // (The processAsset function handles this)
      // Note: Progress stage remains 'idle' for recent assets - feedback is
      // shown on the asset card instead of the upload button
      expect(result.current.uploadProgress.stage).toBe('idle');
    });

    it('backfills children when metrics cached but children missing', async () => {
      const metrics = createMockMetrics();
      const metadata = { ...createMockMetadata(), metrics }; // children intentionally missing

      vi.mocked(getOrLoadModel).mockResolvedValue({
        model: new THREE.Group(),
        metrics,
      });

      vi.mocked(extractChildMeshes).mockReturnValueOnce([
        {
          name: 'Child A',
          path: ['Scene', 'ChildA'],
          localTransform: {
            x: 0,
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
          },
        },
      ]);

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.addRecentAssetToScene(metadata, []);
      });

      expect(getOrLoadModel).toHaveBeenCalledWith(metadata.id);
      expect(loadAndPreprocessModelFromArrayBuffer).not.toHaveBeenCalled();
      expect(updateAssetMetadata).toHaveBeenCalledWith(metadata.id, {
        children: expect.any(Array),
        importDiagnostics: undefined,
      });
    });

    it('processes model when metrics not cached', async () => {
      const metadata = createMockMetadata(); // No metrics
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.addRecentAssetToScene(metadata, []);
      });

      expect(loadAndPreprocessModelFromArrayBuffer).toHaveBeenCalled();
    });

    it('returns scene object', async () => {
      const metrics = createMockMetrics();
      const metadata = { ...createMockMetadata(), metrics, children: [] };

      const { result } = renderHook(() => useModelUpload());

      let addResult: Awaited<ReturnType<typeof result.current.addRecentAssetToScene>> = null;
      await act(async () => {
        addResult = await result.current.addRecentAssetToScene(metadata, []);
      });

      expect(addResult).not.toBeNull();
      expect(addResult!.sceneObject).toBeDefined();
      expect(addResult!.sceneObject.properties.modelAssetId).toBe(metadata.id);
    });
  });

  // ===========================================================================
  // isUploading state
  // ===========================================================================

  describe('isUploading', () => {
    it('is true during upload', async () => {
      const metadata = createMockMetadata();

      // Create a delayed promise to keep upload in progress
      let resolveUpload: () => void;
      const uploadPromise = new Promise<typeof metadata>((resolve) => {
        resolveUpload = () => resolve(metadata);
      });

      vi.mocked(saveAssetWithTextures).mockReturnValue(uploadPromise);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      // Start upload but don't await
      act(() => {
        result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // Should be uploading
      expect(result.current.isUploading).toBe(true);

      // Complete the upload
      await act(async () => {
        resolveUpload!();
        await uploadPromise;
      });
    });

    it('is false when idle', () => {
      const { result } = renderHook(() => useModelUpload());
      expect(result.current.isUploading).toBe(false);
    });

    it('is false after error', async () => {
      vi.mocked(saveAssetWithTextures).mockRejectedValue(new Error('Test'));

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.isUploading).toBe(false);
    });
  });

  // ===========================================================================
  // Auto-reset progress after successful upload
  // ===========================================================================

  describe('auto-reset after successful upload', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('automatically resets progress from complete to idle after delay', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      // Complete upload
      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // Should be complete immediately after upload
      expect(result.current.uploadProgress.stage).toBe('complete');

      // Advance time by 2.5 seconds
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Should have reset to idle
      expect(result.current.uploadProgress.stage).toBe('idle');
      expect(result.current.uploadProgress.fileName).toBeNull();
      expect(result.current.uploadProgress.progress).toBe(0);
    });

    it('does not reset if stage changes before timeout', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      // Complete upload
      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('complete');

      // Manually reset progress before timeout
      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.uploadProgress.stage).toBe('idle');

      // Advance time - should not reset again (already reset)
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Should still be idle
      expect(result.current.uploadProgress.stage).toBe('idle');
    });

    it('cancels previous timeout when starting new upload', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      // First upload
      await act(async () => {
        await result.current.uploadFile(createMockFile('model1.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('complete');

      // Start second upload before timeout fires
      await act(async () => {
        vi.advanceTimersByTime(1000); // Only 1 second passed
        await result.current.uploadFile(createMockFile('model2.obj'), []);
      });

      // Should be complete for second upload
      expect(result.current.uploadProgress.stage).toBe('complete');
      expect(result.current.uploadProgress.fileName).toBe('model2.obj');

      // Advance time - should reset for second upload
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Should have reset to idle
      expect(result.current.uploadProgress.stage).toBe('idle');
    });

    it('keeps lastError visible after error (stage is idle, error in toast)', async () => {
      vi.mocked(saveAssetWithTextures).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // With new behavior, stage resets to 'idle' but lastError is set
      expect(result.current.uploadProgress.stage).toBe('idle');
      expect(result.current.lastError).toBe('Test error');

      // Advance time - error should still be visible (not auto-cleared)
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Error should still be in lastError (until user dismisses it)
      expect(result.current.lastError).toBe('Test error');
      expect(result.current.uploadProgress.stage).toBe('idle');
    });

    it('does not reset when stage is idle', async () => {
      const { result } = renderHook(() => useModelUpload());

      expect(result.current.uploadProgress.stage).toBe('idle');

      // Advance time - should not reset
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Should still be idle
      expect(result.current.uploadProgress.stage).toBe('idle');
    });

    it('cleans up timeout on unmount', async () => {
      const metadata = createMockMetadata();
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result, unmount } = renderHook(() => useModelUpload());

      // Complete upload
      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('complete');

      // Unmount before timeout
      unmount();

      // Advance time - should not cause issues
      vi.advanceTimersByTime(2500);

      // No errors should occur (timeout should be cleaned up)
    });
  });

  // ===========================================================================
  // removeAsset
  // ===========================================================================

  describe('removeAsset', () => {
    it('calls deleteAsset with the asset ID', async () => {
      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.removeAsset('asset-123');
      });

      expect(deleteAsset).toHaveBeenCalledWith('asset-123');
    });

    it('refreshes recent assets after removing', async () => {
      const { result } = renderHook(() => useModelUpload());

      // Clear the initial call from initialization
      vi.mocked(getRecentAssets).mockClear();

      await act(async () => {
        await result.current.removeAsset('asset-123');
      });

      expect(getRecentAssets).toHaveBeenCalledTimes(1);
    });

    it('handles errors gracefully', async () => {
      vi.mocked(deleteAsset).mockRejectedValueOnce(new Error('Delete failed'));

      const { result } = renderHook(() => useModelUpload());

      // Should not throw
      await expect(
        act(async () => {
          await result.current.removeAsset('asset-123');
        })
      ).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // uploadFile - failed processing cleanup
  // ===========================================================================

  describe('uploadFile - failed processing cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('deletes asset when processing fails', async () => {
      const metadata = createMockMetadata('asset-to-cleanup');
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      // Simulate processing failure
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockRejectedValue(
        new Error('Invalid model format')
      );

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('invalid-model.obj'), []);
      });

      // deleteAsset should have been called to clean up the stored asset
      expect(deleteAsset).toHaveBeenCalledWith('asset-to-cleanup');
    });

    it('does not delete asset when processing succeeds', async () => {
      const metadata = createMockMetadata('asset-success');
      vi.mocked(saveAssetWithTextures).mockResolvedValue(metadata);
      vi.mocked(getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(loadAndPreprocessModelFromArrayBuffer).mockResolvedValue(
        createMockPreprocessedModel()
      );

      const { result } = renderHook(() => useModelUpload());

      // Clear any previous calls from initialization
      vi.mocked(deleteAsset).mockClear();

      await act(async () => {
        await result.current.uploadFile(createMockFile('valid-model.obj'), []);
      });

      // deleteAsset should NOT have been called
      expect(deleteAsset).not.toHaveBeenCalled();
    });

    it('does not delete asset when storage fails (asset was never stored)', async () => {
      vi.mocked(saveAssetWithTextures).mockRejectedValue(new Error('Storage quota exceeded'));

      const { result } = renderHook(() => useModelUpload());

      // Clear any previous calls
      vi.mocked(deleteAsset).mockClear();

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // deleteAsset should NOT have been called since save failed
      expect(deleteAsset).not.toHaveBeenCalled();
    });
  });
});
