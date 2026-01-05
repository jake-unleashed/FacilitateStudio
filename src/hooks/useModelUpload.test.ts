/**
 * Tests for useModelUpload hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useModelUpload } from './useModelUpload';
import type { AssetMetadata, ModelMetrics } from '../types/model';

// Mock dependencies
vi.mock('../utils/modelAssetStore', () => ({
  saveAsset: vi.fn(),
  getAsset: vi.fn(),
  getRecentAssets: vi.fn().mockResolvedValue([]),
  updateAssetMetadata: vi.fn(),
  migrateLegacyAssets: vi.fn().mockResolvedValue(0),
  hasLegacyAssets: vi.fn().mockReturnValue(false),
  blobToBase64: vi.fn().mockResolvedValue('base64data'),
}));

vi.mock('../utils/modelLoaders', () => ({
  loadAndPreprocessModel: vi.fn(),
}));

vi.mock('../utils/modelCache', () => ({
  cachePreprocessedModel: vi.fn(),
}));

// Import mocked modules for assertions
import * as modelAssetStore from '../utils/modelAssetStore';
import * as modelLoaders from '../utils/modelLoaders';
import * as modelCache from '../utils/modelCache';

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
      boundingBox: {
        min: { x: -0.5, y: 0, z: -0.5 },
        max: { x: 0.5, y: 1, z: 0.5 },
      },
      center: { x: 0, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      bottomY: 0,
      topY: 1,
      maxDimension: 1,
      triangleCount: 12,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    vi.mocked(modelAssetStore.getRecentAssets).mockResolvedValue([]);
    vi.mocked(modelAssetStore.hasLegacyAssets).mockReturnValue(false);
    vi.mocked(modelAssetStore.migrateLegacyAssets).mockResolvedValue(0);
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
      vi.mocked(modelAssetStore.getRecentAssets).mockResolvedValue(mockAssets);

      const { result } = renderHook(() => useModelUpload());

      await waitFor(() => {
        expect(result.current.recentAssets).toEqual(mockAssets);
      });
    });

    it('checks for legacy assets on mount', async () => {
      renderHook(() => useModelUpload());

      await waitFor(() => {
        expect(modelAssetStore.hasLegacyAssets).toHaveBeenCalled();
      });
    });

    it('migrates legacy assets if present', async () => {
      vi.mocked(modelAssetStore.hasLegacyAssets).mockReturnValue(true);
      vi.mocked(modelAssetStore.migrateLegacyAssets).mockResolvedValue(3);

      renderHook(() => useModelUpload());

      await waitFor(() => {
        expect(modelAssetStore.migrateLegacyAssets).toHaveBeenCalled();
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
      vi.mocked(modelAssetStore.getRecentAssets).mockResolvedValue(newAssets);

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
      vi.mocked(modelAssetStore.saveAsset).mockRejectedValue(new Error('Test error'));

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('error');

      // Reset
      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.uploadProgress).toEqual({
        stage: 'idle',
        fileName: null,
        progress: 0,
        error: null,
        warning: null,
      });
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

      expect(result.current.uploadProgress.stage).toBe('error');
      expect(result.current.uploadProgress.error).toContain('Unsupported file type');
    });

    it('accepts valid file types', async () => {
      const metadata = createMockMetadata();
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      // Should have passed validation
      expect(modelAssetStore.saveAsset).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // uploadFile - Storage
  // ===========================================================================

  describe('uploadFile - storage', () => {
    it('saves file to IndexedDB', async () => {
      const metadata = createMockMetadata();
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload());
      const file = createMockFile('model.obj');

      await act(async () => {
        await result.current.uploadFile(file, []);
      });

      expect(modelAssetStore.saveAsset).toHaveBeenCalledWith(file);
    });

    it('handles storage errors', async () => {
      vi.mocked(modelAssetStore.saveAsset).mockRejectedValue(new Error('Storage quota exceeded'));

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('error');
      expect(result.current.uploadProgress.error).toContain('Storage quota exceeded');
    });
  });

  // ===========================================================================
  // uploadFile - Processing
  // ===========================================================================

  describe('uploadFile - processing', () => {
    it('processes model after storage', async () => {
      const metadata = createMockMetadata();
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(modelLoaders.loadAndPreprocessModel).toHaveBeenCalled();
    });

    it('caches processed model', async () => {
      const metadata = createMockMetadata();
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(modelCache.cachePreprocessedModel).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // uploadFile - Result
  // ===========================================================================

  describe('uploadFile - result', () => {
    it('returns upload result with scene object', async () => {
      const metadata = createMockMetadata();
      const metrics = createMockMetrics();
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics,
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload());

      let uploadResult: Awaited<ReturnType<typeof result.current.uploadFile>>;
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
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

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
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload({ onSuccess }));

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      vi.mocked(modelAssetStore.saveAsset).mockRejectedValue(new Error('Test error'));

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
      const metadata = { ...createMockMetadata(), metrics };

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.addRecentAssetToScene(metadata, []);
      });

      // Should not need to load and preprocess since metrics are cached
      // (The processAsset function handles this)
      expect(result.current.uploadProgress.stage).toBe('complete');
    });

    it('processes model when metrics not cached', async () => {
      const metadata = createMockMetadata(); // No metrics
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.addRecentAssetToScene(metadata, []);
      });

      expect(modelLoaders.loadAndPreprocessModel).toHaveBeenCalled();
    });

    it('returns scene object', async () => {
      const metrics = createMockMetrics();
      const metadata = { ...createMockMetadata(), metrics };

      const { result } = renderHook(() => useModelUpload());

      let addResult: Awaited<ReturnType<typeof result.current.addRecentAssetToScene>>;
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

      vi.mocked(modelAssetStore.saveAsset).mockReturnValue(uploadPromise);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

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
      vi.mocked(modelAssetStore.saveAsset).mockRejectedValue(new Error('Test'));

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
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

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
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

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
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

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

    it('does not reset when stage is error', async () => {
      vi.mocked(modelAssetStore.saveAsset).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useModelUpload());

      await act(async () => {
        await result.current.uploadFile(createMockFile('model.obj'), []);
      });

      expect(result.current.uploadProgress.stage).toBe('error');

      // Advance time - should not reset
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Should still be error
      expect(result.current.uploadProgress.stage).toBe('error');
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
      vi.mocked(modelAssetStore.saveAsset).mockResolvedValue(metadata);
      vi.mocked(modelAssetStore.getAsset).mockResolvedValue({
        blob: new Blob(['test']),
        metadata,
      });
      vi.mocked(modelLoaders.loadAndPreprocessModel).mockResolvedValue({
        model: {} as THREE.Object3D,
        metrics: createMockMetrics(),
        originalScale: 1,
      });

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
});

// Type declaration for THREE
declare global {
  namespace THREE {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Object3D {}
  }
}
