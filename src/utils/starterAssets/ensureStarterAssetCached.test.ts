import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarterAssetCatalogEntry } from '../../services/starterAssetService';

vi.mock('../modelAssetStore', () => ({
  getAsset: vi.fn(),
  upsertAssetFromBlob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./starterAssetEvents', () => ({
  emitStarterAssetsUpdated: vi.fn(),
}));

import { getAsset, upsertAssetFromBlob } from '../modelAssetStore';
import { emitStarterAssetsUpdated } from './starterAssetEvents';
import { ensureStarterAssetCached } from './ensureStarterAssetCached';

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

describe('ensureStarterAssetCached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(getAsset).mockResolvedValue(null);
  });

  it('ignores non-model starter assets', async () => {
    await ensureStarterAssetCached({
      ...starterModel,
      id: 'starter:bg-desert',
      type: 'background',
      fileType: 'jpg',
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(upsertAssetFromBlob).not.toHaveBeenCalled();
    expect(emitStarterAssetsUpdated).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent cache requests for the same starter asset', async () => {
    const blob = new Blob(['glb'], { type: 'model/gltf-binary' });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response);

    await Promise.all([ensureStarterAssetCached(starterModel), ensureStarterAssetCached(starterModel)]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      starterModel.publicUrl,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(upsertAssetFromBlob).toHaveBeenCalledTimes(1);
    expect(upsertAssetFromBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: starterModel.id,
        name: starterModel.name,
        fileType: 'glb',
        blob,
      })
    );
    expect(emitStarterAssetsUpdated).toHaveBeenCalledWith([starterModel.id]);
  });
});
