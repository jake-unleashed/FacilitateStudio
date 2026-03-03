/**
 * Model Asset Store
 *
 * IndexedDB-based storage for 3D model assets. Provides GB-scale storage
 * with efficient binary blob storage (no base64 encoding overhead).
 *
 * Architecture:
 * - Assets are stored as binary Blobs directly in IndexedDB
 * - Metadata is stored alongside for quick queries
 * - Supports migration from legacy localStorage-based storage
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  AssetMetadata,
  ModelValidationOptions,
  ModelMetrics,
  ModelFileType,
  STORAGE_CONFIG,
  parseFileType,
  validateModelFile,
} from '../types/model';
import {
  deleteCloudAsset,
  downloadAssetFromCloud,
  getCloudAssetById,
  listUserAssets,
  uploadAssetToCloud,
} from './cloudAssetStore';
import { logger } from './logger';

// Re-export types for convenience
export type { AssetMetadata, ModelMetrics };
export { parseFileType as getFileTypeFromName, validateModelFile as validateFile };
export { formatFileSize, STORAGE_CONFIG as RECOMMENDED_MAX_FILE_SIZE } from '../types/model';

// =============================================================================
// Internal Types
// =============================================================================

interface StoredAsset {
  id: string;
  metadata: AssetMetadata;
  blob: Blob;
  textures?: AssetTextureMap;
}

export type AssetTextureMap = Record<string, Blob>;

interface CloudAssetOptions {
  userId?: string;
  projectId?: string;
}

interface ModelAssetDB extends DBSchema {
  assets: {
    key: string;
    value: StoredAsset;
    indexes: { 'by-date': string };
  };
}

// =============================================================================
// Database Connection (Singleton)
// =============================================================================

let dbInstance: IDBPDatabase<ModelAssetDB> | null = null;
let dbPromise: Promise<IDBPDatabase<ModelAssetDB>> | null = null;

/**
 * Get or create the database connection.
 * Uses a singleton pattern to prevent multiple connections.
 */
async function getDB(): Promise<IDBPDatabase<ModelAssetDB>> {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = openDB<ModelAssetDB>(STORAGE_CONFIG.DB_NAME, STORAGE_CONFIG.DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('assets', { keyPath: 'id' });
        store.createIndex('by-date', 'metadata.uploadDate');
      },
    }).then((db) => {
      dbInstance = db;
      return db;
    });
  }

  return dbPromise;
}

// =============================================================================
// Asset Operations
// =============================================================================

/**
 * Generate a unique asset ID.
 */
function generateAssetId(): string {
  // `crypto.randomUUID()` is supported in modern browsers, but can be missing in
  // some test environments. Fall back to a low-collision ID when unavailable.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `asset_${timestamp}_${random}`;
}

function isStarterAsset(assetId: string): boolean {
  return assetId.startsWith('starter:');
}

/**
 * Save a new asset to IndexedDB.
 *
 * @param file - The file to save
 * @returns The created asset metadata
 * @throws Error if validation fails or storage quota is exceeded
 */
export async function saveAsset(file: File): Promise<AssetMetadata> {
  return saveAssetWithTextures(file, []);
}

/**
 * Save a new asset and optional texture files to IndexedDB.
 *
 * Texture files are keyed by lowercase filename so they can be matched against
 * material references during model loading.
 */
export async function saveAssetWithTextures(
  file: File,
  textureFiles: File[] = [],
  options?: ModelValidationOptions
): Promise<AssetMetadata> {
  const validation = validateModelFile(file, options);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid file');
  }

  const db = await getDB();
  const id = generateAssetId();
  const fileType = parseFileType(file.name);

  const metadata: AssetMetadata = {
    id,
    name: file.name,
    fileType,
    fileSize: file.size,
    uploadDate: new Date().toISOString(),
  };

  const storedAsset: StoredAsset = {
    id,
    metadata,
    blob: file,
    textures: buildTextureMap(textureFiles),
  };

  try {
    await db.put('assets', storedAsset);
    return metadata;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete some assets to free up space.');
    }
    throw error;
  }
}

/**
 * Best-effort cloud sync for a locally stored asset.
 * Local persistence remains the source of truth for immediate UX.
 */
export async function syncAssetToCloud(
  assetId: string,
  options: CloudAssetOptions
): Promise<void> {
  const userId = options.userId;
  if (!userId || isStarterAsset(assetId)) {
    return;
  }

  const localAsset = await getAsset(assetId);
  if (!localAsset) {
    return;
  }

  await uploadAssetToCloud(localAsset.blob, userId, assetId, {
    filename: localAsset.metadata.name,
    fileType: localAsset.metadata.fileType,
    fileSize: localAsset.metadata.fileSize,
    projectId: options.projectId,
    extra: {
      metrics: localAsset.metadata.metrics,
      children: localAsset.metadata.children,
      thumbnail: localAsset.metadata.thumbnail,
      thumbnail_updated_at: localAsset.metadata.thumbnailUpdatedAt,
    },
  });
}

/**
 * Upsert an asset with a caller-supplied ID (for seeding starter assets).
 * Unlike saveAsset(), this allows deterministic IDs for reproducible seeding.
 *
 * @param options - Asset creation options
 * @returns The created/updated asset metadata
 * @throws Error if storage quota is exceeded
 */
export async function upsertAssetFromBlob(options: {
  id: string;
  name: string;
  fileType: ModelFileType;
  uploadDate: string;
  blob: Blob;
  textures?: AssetTextureMap;
  metadataOverrides?: Partial<AssetMetadata>;
}): Promise<AssetMetadata> {
  const db = await getDB();

  const metadata: AssetMetadata = {
    id: options.id,
    name: options.name,
    fileType: options.fileType,
    fileSize: options.blob.size,
    uploadDate: options.uploadDate,
    ...options.metadataOverrides,
  };

  const storedAsset: StoredAsset = {
    id: options.id,
    metadata,
    blob: options.blob,
    textures: options.textures,
  };

  try {
    await db.put('assets', storedAsset);
    return metadata;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete some assets to free up space.');
    }
    throw error;
  }
}

/**
 * Check if an asset exists in the store.
 *
 * @param assetId - The asset ID to check
 * @returns True if the asset exists, false otherwise
 */
export async function assetExists(assetId: string): Promise<boolean> {
  const metadata = await getAssetMetadata(assetId);
  return metadata !== null;
}

/**
 * Get an asset's blob and metadata by ID.
 *
 * @param assetId - The asset ID to retrieve
 * @returns The asset data or null if not found
 */
export async function getAsset(
  assetId: string,
  options?: CloudAssetOptions
): Promise<{ blob: Blob; metadata: AssetMetadata; textures?: AssetTextureMap } | null> {
  const db = await getDB();
  const stored = await db.get('assets', assetId);

  if (stored) {
    return {
      blob: stored.blob,
      metadata: stored.metadata,
      textures: stored.textures,
    };
  }

  if (!options?.userId || isStarterAsset(assetId)) {
    return null;
  }

  try {
    const cloudAsset = await getCloudAssetById(assetId, options.userId);
    if (!cloudAsset) {
      return null;
    }

    const blob = await downloadAssetFromCloud(cloudAsset.storageKey);
    await upsertAssetFromBlob({
      id: assetId,
      name: cloudAsset.metadata.name,
      fileType: cloudAsset.metadata.fileType,
      uploadDate: cloudAsset.metadata.uploadDate,
      blob,
      metadataOverrides: {
        metrics: cloudAsset.metadata.metrics,
        children: cloudAsset.metadata.children,
        thumbnail: cloudAsset.metadata.thumbnail,
        thumbnailUpdatedAt: cloudAsset.metadata.thumbnailUpdatedAt,
      },
    });

    return {
      blob,
      metadata: cloudAsset.metadata,
      textures: undefined,
    };
  } catch (error) {
    logger.warn(`[modelAssetStore] Cloud fallback failed for asset ${assetId}:`, error);
    return null;
  }
}

/**
 * Get just the metadata for an asset (faster than full asset).
 */
export async function getAssetMetadata(assetId: string): Promise<AssetMetadata | null> {
  const db = await getDB();
  const stored = await db.get('assets', assetId);
  return stored?.metadata ?? null;
}

/**
 * Update asset metadata (e.g., to add computed metrics).
 *
 * @param assetId - The asset ID to update
 * @param updates - Partial metadata to merge
 */
export async function updateAssetMetadata(
  assetId: string,
  updates: Partial<AssetMetadata>
): Promise<void> {
  const db = await getDB();
  const stored = await db.get('assets', assetId);

  if (!stored) {
    logger.warn(`[modelAssetStore] Asset not found: ${assetId}`);
    return;
  }

  const updatedAsset: StoredAsset = {
    ...stored,
    metadata: {
      ...stored.metadata,
      ...updates,
      id: stored.metadata.id, // Prevent ID changes
    },
  };

  await db.put('assets', updatedAsset);
}

/**
 * Delete an asset by ID.
 */
export async function deleteAsset(assetId: string, options?: CloudAssetOptions): Promise<void> {
  const userId = options?.userId;
  if (userId && !isStarterAsset(assetId)) {
    try {
      const cloudAsset = await getCloudAssetById(assetId, userId);
      if (cloudAsset) {
        await deleteCloudAsset(cloudAsset.storageKey, assetId, userId);
      }
    } catch (error) {
      logger.warn(`[modelAssetStore] Failed to delete cloud copy for asset ${assetId}:`, error);
    }
  }

  const db = await getDB();
  await db.delete('assets', assetId);
}

/**
 * Get recent assets sorted by upload date (most recent first).
 *
 * @param limit - Maximum number of assets to return
 */
export async function getRecentAssets(limit = 20, options?: CloudAssetOptions): Promise<AssetMetadata[]> {
  const db = await getDB();
  const localAssets = (await db.getAll('assets')).map((a) => a.metadata);
  const userId = options?.userId;
  if (!userId) {
    return localAssets
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
      .slice(0, limit);
  }

  try {
    const cloudAssets = await listUserAssets(userId, Math.max(limit, 50));
    const merged = new Map<string, AssetMetadata>();

    for (const cloudAsset of cloudAssets) {
      merged.set(cloudAsset.assetId, cloudAsset.metadata);
    }
    for (const local of localAssets) {
      if (!merged.has(local.id) || isStarterAsset(local.id)) {
        merged.set(local.id, local);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
      .slice(0, limit);
  } catch (error) {
    logger.warn('[modelAssetStore] Failed to load cloud recent assets, using local cache only:', error);
    return localAssets
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
      .slice(0, limit);
  }
}

/**
 * Get all asset metadata.
 */
export async function getAllAssets(options?: CloudAssetOptions): Promise<AssetMetadata[]> {
  const db = await getDB();
  const localAssets = (await db.getAll('assets')).map((a) => a.metadata);
  const userId = options?.userId;
  if (!userId) {
    return localAssets;
  }

  try {
    const cloudAssets = await listUserAssets(userId, 500);
    const merged = new Map<string, AssetMetadata>();
    for (const cloudAsset of cloudAssets) {
      merged.set(cloudAsset.assetId, cloudAsset.metadata);
    }
    for (const local of localAssets) {
      if (!merged.has(local.id) || isStarterAsset(local.id)) {
        merged.set(local.id, local);
      }
    }
    return Array.from(merged.values());
  } catch (error) {
    logger.warn('[modelAssetStore] Failed to load cloud asset list, using local cache only:', error);
    return localAssets;
  }
}

/**
 * Get total count of stored assets.
 */
export async function getAssetCount(): Promise<number> {
  const db = await getDB();
  return db.count('assets');
}

// =============================================================================
// Storage Statistics
// =============================================================================

export interface StorageStats {
  totalAssets: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  oldestAsset: AssetMetadata | null;
  newestAsset: AssetMetadata | null;
}

/**
 * Get storage statistics.
 */
export async function getStorageStats(): Promise<StorageStats> {
  const db = await getDB();
  const allAssets = await db.getAll('assets');

  const totalSizeBytes = allAssets.reduce((sum, asset) => sum + asset.metadata.fileSize, 0);

  const sorted = allAssets
    .map((a) => a.metadata)
    .sort((a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());

  return {
    totalAssets: allAssets.length,
    totalSizeBytes,
    totalSizeMB: totalSizeBytes / (1024 * 1024),
    oldestAsset: sorted[0] ?? null,
    newestAsset: sorted[sorted.length - 1] ?? null,
  };
}

// =============================================================================
// Blob Utilities
// =============================================================================

/**
 * Convert a Blob to a base64 string.
 * Used for passing data to Three.js loaders (legacy, prefer ArrayBuffer).
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a Blob to an ArrayBuffer.
 * Preferred method for Three.js loaders as it:
 * - Avoids base64 encoding overhead
 * - Works directly with loader.parse() methods
 * - Properly handles embedded textures in GLB/FBX files
 */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

function buildTextureMap(textureFiles: File[]): AssetTextureMap | undefined {
  if (!textureFiles.length) {
    return undefined;
  }

  const textures: AssetTextureMap = {};
  for (const textureFile of textureFiles) {
    const key = textureFile.name.toLowerCase();
    textures[key] = textureFile;
  }

  return Object.keys(textures).length > 0 ? textures : undefined;
}

// =============================================================================
// Legacy Migration
// =============================================================================

const LEGACY_KEYS = {
  ASSET_PREFIX: 'facilitate_asset_',
  METADATA: 'facilitate_asset_metadata',
  MIGRATION_COMPLETE: 'facilitate_indexeddb_migration_complete',
} as const;

/**
 * Check if there are legacy assets in localStorage that need migration.
 */
export function hasLegacyAssets(): boolean {
  if (localStorage.getItem(LEGACY_KEYS.MIGRATION_COMPLETE)) {
    return false;
  }

  const metadata = localStorage.getItem(LEGACY_KEYS.METADATA);
  if (!metadata) return false;

  try {
    const parsed = JSON.parse(metadata);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrate assets from localStorage to IndexedDB.
 *
 * @returns Number of successfully migrated assets
 */
export async function migrateLegacyAssets(): Promise<number> {
  if (!hasLegacyAssets()) return 0;

  const db = await getDB();
  let migratedCount = 0;

  try {
    const metadataJson = localStorage.getItem(LEGACY_KEYS.METADATA);
    if (!metadataJson) return 0;

    const oldMetadata: Array<{
      id: string;
      name: string;
      fileType: ModelFileType;
      fileSize: number;
      uploadDate: string;
      metrics?: ModelMetrics;
    }> = JSON.parse(metadataJson);

    for (const meta of oldMetadata) {
      try {
        const base64Data = localStorage.getItem(`${LEGACY_KEYS.ASSET_PREFIX}${meta.id}`);
        if (!base64Data) continue;

        // Convert base64 to blob
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray]);

        const storedAsset: StoredAsset = {
          id: meta.id,
          metadata: {
            id: meta.id,
            name: meta.name,
            fileType: meta.fileType,
            fileSize: meta.fileSize,
            uploadDate: meta.uploadDate,
            metrics: meta.metrics,
          },
          blob,
        };

        await db.put('assets', storedAsset);
        migratedCount++;

        // Remove from localStorage after successful migration
        localStorage.removeItem(`${LEGACY_KEYS.ASSET_PREFIX}${meta.id}`);
      } catch (error) {
        logger.error(`[migration] Failed to migrate asset ${meta.id}:`, error);
      }
    }

    // Clear old metadata if all assets migrated
    if (migratedCount === oldMetadata.length) {
      localStorage.removeItem(LEGACY_KEYS.METADATA);
    }

    localStorage.setItem(LEGACY_KEYS.MIGRATION_COMPLETE, 'true');
    logger.log(`[migration] Migrated ${migratedCount}/${oldMetadata.length} assets`);

    return migratedCount;
  } catch (error) {
    logger.error('[migration] Migration failed:', error);
    return migratedCount;
  }
}

/**
 * Clear all legacy localStorage data.
 */
export function clearLegacyStorage(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LEGACY_KEYS.ASSET_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(LEGACY_KEYS.METADATA);
}
