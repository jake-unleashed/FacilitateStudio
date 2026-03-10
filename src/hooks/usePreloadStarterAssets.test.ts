import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarterAssetCatalogEntry } from '../services/starterAssetService';

vi.mock('../utils/modelCache', () => ({
  preloadModel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/starterAssets/ensureStarterAssetCached', () => ({
  ensureStarterAssetCached: vi.fn().mockResolvedValue(undefined),
}));

import { preloadModel } from '../utils/modelCache';
import { ensureStarterAssetCached } from '../utils/starterAssets/ensureStarterAssetCached';
import { usePreloadStarterAssets } from './usePreloadStarterAssets';

const starterModel: StarterAssetCatalogEntry = {
  id: 'starter:test-model',
  type: 'model',
  name: 'Test Model',
  storageKey: 'models/test.glb',
  fileType: 'glb',
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  publicUrl: 'https://example.com/models/test.glb',
};

describe('usePreloadStarterAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preloads unseen starter models and skips non-model assets', async () => {
    const backgroundAsset: StarterAssetCatalogEntry = {
      ...starterModel,
      id: 'starter:bg-desert',
      type: 'background',
      fileType: 'jpg',
      publicUrl: 'https://example.com/backgrounds/desert.jpg',
    };

    const { rerender } = renderHook(
      ({ assets }) => usePreloadStarterAssets(assets),
      { initialProps: { assets: [starterModel, backgroundAsset] } }
    );

    await waitFor(() => {
      expect(ensureStarterAssetCached).toHaveBeenCalledTimes(1);
      expect(preloadModel).toHaveBeenCalledTimes(1);
    });

    expect(ensureStarterAssetCached).toHaveBeenCalledWith(starterModel);
    expect(preloadModel).toHaveBeenCalledWith(starterModel.id);

    rerender({ assets: [starterModel, backgroundAsset] });

    await waitFor(() => {
      expect(ensureStarterAssetCached).toHaveBeenCalledTimes(1);
      expect(preloadModel).toHaveBeenCalledTimes(1);
    });
  });
});
