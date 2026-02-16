import { supabase } from '../lib/supabase';
import type { AssetMetadata, ModelFileType } from '../types/model';
import type { ModelMetrics } from '../types/model';
import type { ChildMesh } from '../types';
import { STORAGE_CONFIG } from '../types/model';
import { StorageError, ValidationError } from './errors';
import { logger } from './logger';

const USER_ASSETS_BUCKET = 'user-assets';
const FALLBACK_PROJECT_SEGMENT = 'library';

interface AssetRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  storage_key: string;
  filename: string;
  file_type: string;
  file_size: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface CloudUploadMetadata {
  filename: string;
  fileType: ModelFileType;
  fileSize: number;
  projectId?: string;
  /**
   * Optional additional JSON-serializable metadata.
   * This is stored in the `assets.metadata` jsonb column.
   */
  extra?: Record<string, unknown>;
}

export interface CloudAssetRecord {
  assetId: string;
  storageKey: string;
  metadata: AssetMetadata;
  createdAt: string;
}

interface CloudAssetMetadataJson {
  asset_id?: unknown;
  upload_date?: unknown;
  metrics?: unknown;
  children?: unknown;
  thumbnail?: unknown;
  thumbnail_updated_at?: unknown;
  [key: string]: unknown;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\]/g, '_');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toIsoString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toChildMeshes(value: unknown): ChildMesh[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // Best-effort structural check; consumers must be tolerant.
  const isChildMesh = (item: unknown): item is ChildMesh => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.name === 'string' && Array.isArray(obj.path) && typeof obj.localTransform === 'object';
  };
  const filtered = value.filter(isChildMesh);
  return filtered.length > 0 ? filtered : undefined;
}

function toModelMetrics(value: unknown): ModelMetrics | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  // Minimal guard: boundingBox + center + size should exist for our serialized metrics.
  if (!obj.boundingBox || !obj.center || !obj.size) return undefined;
  return value as ModelMetrics;
}

function toMimeType(fileType: ModelFileType): string {
  if (fileType === 'glb') return 'model/gltf-binary';
  if (fileType === 'fbx') return 'application/octet-stream';
  return 'model/obj';
}

function mapRowToCloudRecord(row: AssetRow): CloudAssetRecord {
  const metadata = (row.metadata ?? {}) as CloudAssetMetadataJson;
  const assetIdFromMetadata = toStringOrUndefined(metadata.asset_id);
  const assetId = assetIdFromMetadata && assetIdFromMetadata.trim().length > 0 ? assetIdFromMetadata : row.id;
  const uploadDate = toIsoString(metadata.upload_date, row.created_at);
  const fileType =
    row.file_type === 'glb' || row.file_type === 'fbx' || row.file_type === 'obj'
      ? row.file_type
      : 'glb';

  return {
    assetId,
    storageKey: row.storage_key,
    createdAt: row.created_at,
    metadata: {
      id: assetId,
      name: row.filename,
      fileType,
      fileSize: Number(row.file_size),
      uploadDate,
      metrics: toModelMetrics(metadata.metrics),
      children: toChildMeshes(metadata.children),
      thumbnail: toStringOrUndefined(metadata.thumbnail),
      thumbnailUpdatedAt: toIsoString(metadata.thumbnail_updated_at, uploadDate),
    },
  };
}

async function getExistingCloudRowByAssetId(assetId: string, userId: string): Promise<AssetRow | null> {
  // Preferred path: if assetId is a UUID, we store it as the row PK for fast lookups.
  if (isUuid(assetId)) {
    const { data, error } = await supabase
      .from('assets')
      .select('id, owner_id, project_id, storage_key, filename, file_type, file_size, metadata, created_at')
      .eq('id', assetId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) {
      throw new StorageError(`Failed to query cloud asset: ${error.message}`);
    }
    return (data as AssetRow | null) ?? null;
  }

  const { data, error } = await supabase
    .from('assets')
    .select('id, owner_id, project_id, storage_key, filename, file_type, file_size, metadata, created_at')
    .eq('owner_id', userId)
    .contains('metadata', { asset_id: assetId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new StorageError(`Failed to query existing cloud asset: ${error.message}`);
  }

  return (data as AssetRow | null) ?? null;
}

function buildStorageKey(args: { userId: string; projectId?: string; assetId: string; filename: string }): string {
  const safeFilename = sanitizeFilename(args.filename);
  const projectSegment = args.projectId ? args.projectId : FALLBACK_PROJECT_SEGMENT;
  return `${args.userId}/${projectSegment}/${args.assetId}/${safeFilename}`;
}

export async function uploadAssetToCloud(
  file: File | Blob,
  userId: string,
  assetId: string,
  metadata: CloudUploadMetadata
): Promise<{ storageKey: string }> {
  if (metadata.fileSize > STORAGE_CONFIG.MAX_FILE_SIZE) {
    throw new ValidationError('File exceeds maximum upload size of 100MB.');
  }
  if (metadata.fileType !== 'glb' && metadata.fileType !== 'fbx' && metadata.fileType !== 'obj') {
    throw new ValidationError('Unsupported model file type.');
  }

  const storageKey = buildStorageKey({
    userId,
    projectId: metadata.projectId,
    assetId,
    filename: metadata.filename,
  });

  const { error: uploadError } = await supabase.storage
    .from(USER_ASSETS_BUCKET)
    .upload(storageKey, file, {
      upsert: true,
      contentType: toMimeType(metadata.fileType),
    });

  if (uploadError) {
    throw new StorageError(`Failed to upload model to cloud storage: ${uploadError.message}`);
  }

  const uploadDate = new Date().toISOString();
  const rowPayload = {
    ...(isUuid(assetId) ? { id: assetId } : {}),
    owner_id: userId,
    project_id: metadata.projectId && isUuid(metadata.projectId) ? metadata.projectId : null,
    storage_key: storageKey,
    filename: metadata.filename,
    file_type: metadata.fileType,
    file_size: metadata.fileSize,
    metadata: {
      asset_id: assetId,
      upload_date: uploadDate,
      ...(metadata.extra ?? {}),
    },
  };

  // If this is a UUID asset id, we can do a direct upsert on PK.
  if (isUuid(assetId)) {
    const { error: upsertError } = await supabase.from('assets').upsert(rowPayload, { onConflict: 'id' });
    if (upsertError) {
      throw new StorageError(`Failed to save cloud asset metadata: ${upsertError.message}`);
    }
  } else {
    const existing = await getExistingCloudRowByAssetId(assetId, userId);
    if (existing) {
      const { error: updateError } = await supabase
        .from('assets')
        .update(rowPayload)
        .eq('id', existing.id)
        .eq('owner_id', userId);
      if (updateError) {
        throw new StorageError(`Failed to update cloud asset metadata: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase.from('assets').insert(rowPayload);
      if (insertError) {
        throw new StorageError(`Failed to save cloud asset metadata: ${insertError.message}`);
      }
    }
  }

  return { storageKey };
}

export async function downloadAssetFromCloud(storageKey: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(USER_ASSETS_BUCKET).download(storageKey);
  if (error || !data) {
    throw new StorageError(`Failed to download cloud asset: ${error?.message ?? 'Unknown error'}`);
  }
  return data;
}

export async function getAssetSignedUrl(storageKey: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(USER_ASSETS_BUCKET)
    .createSignedUrl(storageKey, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new StorageError(`Failed to create asset signed URL: ${error?.message ?? 'Unknown error'}`);
  }
  return data.signedUrl;
}

export async function getCloudAssetById(
  assetId: string,
  userId: string
): Promise<CloudAssetRecord | null> {
  const row = await getExistingCloudRowByAssetId(assetId, userId);
  if (!row) return null;
  return mapRowToCloudRecord(row);
}

export async function deleteCloudAsset(
  storageKey: string,
  assetId: string,
  userId?: string
): Promise<void> {
  // Delete the metadata row FIRST, then the storage object.
  // If storage deletion fails afterward, we get an orphaned file (harmless, recoverable).
  // The opposite order (storage first) would leave a metadata row pointing to nothing,
  // which causes errors on subsequent reads.
  let query = supabase.from('assets').delete().eq('storage_key', storageKey);
  if (userId) query = query.eq('owner_id', userId);
  // If we know the UUID assetId, also target the row PK (faster + safer).
  if (isUuid(assetId)) {
    query = query.eq('id', assetId);
  } else {
    query = query.contains('metadata', { asset_id: assetId });
  }

  const { error: rowDeleteError } = await query;
  if (rowDeleteError) {
    throw new StorageError(`Failed to delete cloud asset metadata: ${rowDeleteError.message}`);
  }

  const { error: storageError } = await supabase.storage.from(USER_ASSETS_BUCKET).remove([storageKey]);
  if (storageError) {
    // Log but don't throw — the metadata is already gone, so the asset is logically deleted.
    // The orphaned storage object will not be referenced by any row.
    logger.warn(`[cloudAssetStore] Orphaned storage object after metadata deletion: ${storageError.message}`);
  }
}

export async function listUserAssets(userId: string, limit = 100): Promise<CloudAssetRecord[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, owner_id, project_id, storage_key, filename, file_type, file_size, metadata, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new StorageError(`Failed to load cloud assets: ${error.message}`);
  }

  const rows = (data as AssetRow[] | null) ?? [];
  return rows.map(mapRowToCloudRecord);
}
