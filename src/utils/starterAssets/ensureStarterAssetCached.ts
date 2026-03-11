import type { StarterAssetCatalogEntry } from '../../services/starterAssetService';
import type { ModelFileType } from '../../types/model';
import { getAsset, upsertAssetFromBlob } from '../modelAssetStore';
import { emitStarterAssetsUpdated } from './starterAssetEvents';

const inFlightStarterAssetCaches = new Map<string, Promise<void>>();
const STARTER_ASSET_FETCH_TIMEOUT_MS = 30_000;

function toModelFileType(fileType: string): ModelFileType | null {
  if (fileType === 'glb' || fileType === 'fbx' || fileType === 'obj') {
    return fileType;
  }
  return null;
}

/**
 * Ensures a starter model exists in local IndexedDB storage before the editor uses it.
 *
 * This helper is intentionally model-only. Background starter assets are resolved directly by URL.
 * Concurrent calls for the same starter asset are deduplicated to avoid duplicate network fetches.
 */
export async function ensureStarterAssetCached(asset: StarterAssetCatalogEntry): Promise<void> {
  if (!asset.id.startsWith('starter:') || asset.type !== 'model') return;

  const existing = await getAsset(asset.id);
  if (existing) return;

  const activeRequest = inFlightStarterAssetCaches.get(asset.id);
  if (activeRequest) {
    return activeRequest;
  }

  const request = (async () => {
    const fileType = toModelFileType(asset.fileType);
    if (!fileType) {
      throw new Error(`Unsupported starter model type: ${asset.fileType}`);
    }

    let response: Response;
    try {
      response = await fetch(asset.publicUrl, {
        signal: AbortSignal.timeout(STARTER_ASSET_FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new Error(`Timed out while downloading starter asset "${asset.name}".`);
      }
      throw error;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch starter asset: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const cachedAt = new Date().toISOString();

    await upsertAssetFromBlob({
      id: asset.id,
      name: asset.name,
      fileType,
      uploadDate: cachedAt,
      blob,
      metadataOverrides: {
        thumbnail: asset.thumbnailUrl,
        thumbnailUpdatedAt: asset.thumbnailUrl ? cachedAt : undefined,
      },
    });

    emitStarterAssetsUpdated([asset.id]);
  })().finally(() => {
    inFlightStarterAssetCaches.delete(asset.id);
  });

  inFlightStarterAssetCaches.set(asset.id, request);
  return request;
}
