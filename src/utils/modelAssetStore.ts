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
  ModelMetrics,
  ModelFileType,
  STORAGE_CONFIG,
  parseFileType,
  validateModelFile,
} from '../types/model';

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
    dbPromise = openDB<ModelAssetDB>(
      STORAGE_CONFIG.DB_NAME,
      STORAGE_CONFIG.DB_VERSION,
      {
        upgrade(db) {
          const store = db.createObjectStore('assets', { keyPath: 'id' });
          store.createIndex('by-date', 'metadata.uploadDate');
        },
      }
    ).then((db) => {
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
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `asset_${timestamp}_${random}`;
}

/**
 * Save a new asset to IndexedDB.
 *
 * @param file - The file to save
 * @returns The created asset metadata
 * @throws Error if validation fails or storage quota is exceeded
 */
export async function saveAsset(file: File): Promise<AssetMetadata> {
  const validation = validateModelFile(file);
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
  };

  try {
    await db.put('assets', storedAsset);
    return metadata;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error(
        'Storage quota exceeded. Please delete some assets to free up space.'
      );
    }
    throw error;
  }
}

/**
 * Get an asset's blob and metadata by ID.
 *
 * @param assetId - The asset ID to retrieve
 * @returns The asset data or null if not found
 */
export async function getAsset(
  assetId: string
): Promise<{ blob: Blob; metadata: AssetMetadata } | null> {
  const db = await getDB();
  const stored = await db.get('assets', assetId);

  if (!stored) return null;

  return {
    blob: stored.blob,
    metadata: stored.metadata,
  };
}

/**
 * Get just the metadata for an asset (faster than full asset).
 */
export async function getAssetMetadata(
  assetId: string
): Promise<AssetMetadata | null> {
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
    console.warn(`[modelAssetStore] Asset not found: ${assetId}`);
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
export async function deleteAsset(assetId: string): Promise<void> {
  const db = await getDB();
  await db.delete('assets', assetId);
}

/**
 * Get recent assets sorted by upload date (most recent first).
 *
 * @param limit - Maximum number of assets to return
 */
export async function getRecentAssets(limit = 20): Promise<AssetMetadata[]> {
  const db = await getDB();
  const allAssets = await db.getAll('assets');

  return allAssets
    .map((a) => a.metadata)
    .sort(
      (a, b) =>
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    )
    .slice(0, limit);
}

/**
 * Get all asset metadata.
 */
export async function getAllAssets(): Promise<AssetMetadata[]> {
  const db = await getDB();
  const allAssets = await db.getAll('assets');
  return allAssets.map((a) => a.metadata);
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

  const totalSizeBytes = allAssets.reduce(
    (sum, asset) => sum + asset.metadata.fileSize,
    0
  );

  const sorted = allAssets
    .map((a) => a.metadata)
    .sort(
      (a, b) =>
        new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
    );

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
 * Used for passing data to Three.js loaders.
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
        const base64Data = localStorage.getItem(
          `${LEGACY_KEYS.ASSET_PREFIX}${meta.id}`
        );
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
        console.error(`[migration] Failed to migrate asset ${meta.id}:`, error);
      }
    }

    // Clear old metadata if all assets migrated
    if (migratedCount === oldMetadata.length) {
      localStorage.removeItem(LEGACY_KEYS.METADATA);
    }

    localStorage.setItem(LEGACY_KEYS.MIGRATION_COMPLETE, 'true');
    console.log(
      `[migration] Migrated ${migratedCount}/${oldMetadata.length} assets`
    );

    return migratedCount;
  } catch (error) {
    console.error('[migration] Migration failed:', error);
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
