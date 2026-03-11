import { supabase } from '../lib/supabase';
import type { ChildMesh, SceneObject, SimStep } from '../types';
import type { Project } from '../types/project';
import type { ModelFileType, ModelMetrics } from '../types/model';
import type { AssetManifestEntry, PublishedSnapshot, PublishURLResult } from '../types/publish';
import { toSceneSettings, type SceneSettings } from '../types/sceneSettings';
import type { SimulationSettings } from '../types/simulationSettings';
import { toSimulationSettings } from '../types/simulationSettings';
import {
  extractBackgroundImageStoragePath,
  extractStarterBackgroundStoragePath,
  isStarterBackgroundStorageRef,
} from '../utils/backgroundImageUpload';
import { syncAssetToCloud } from '../utils/modelAssetStore';
import { hasPreviewableContent } from '../utils/stepValidation';
import { NotFoundError, StorageError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getPublishedSceneBackgroundUrl, getSceneBackgroundUrl } from '../utils/sceneBackgroundUrl';

const USER_ASSETS_BUCKET = 'user-assets';
const PUBLISHED_ASSETS_BUCKET = 'published-assets';

interface AssetRow {
  id: string;
  owner_id: string;
  storage_key: string;
  filename: string;
  file_type: string;
  metadata: Record<string, unknown> | null;
}

interface ExistingPublishRow {
  id: string;
  share_token: string;
  is_active: boolean;
}

export interface ExistingPublishRecord {
  shareToken: string;
  url: string;
  isActive: boolean;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\]/g, '_');
}

function toOrigin(): string {
  return typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
}

function toPublishedUrl(shareToken: string): string {
  return `${toOrigin()}/published?token=${encodeURIComponent(shareToken)}`;
}

function toModelFileType(value: string): ModelFileType {
  if (value === 'glb' || value === 'fbx' || value === 'obj') return value;
  throw new ValidationError(`Unsupported asset file type "${value}" in publish flow.`);
}

function toMimeType(fileType: ModelFileType): string {
  if (fileType === 'glb') return 'model/gltf-binary';
  if (fileType === 'fbx') return 'application/octet-stream';
  return 'model/obj';
}

function toModelMetrics(value: unknown): ModelMetrics | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  if (!obj.boundingBox || !obj.center || !obj.size) return undefined;
  return value as ModelMetrics;
}

function toChildMeshes(value: unknown): ChildMesh[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const isChildMesh = (item: unknown): item is ChildMesh => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.name === 'string' && Array.isArray(obj.path) && typeof obj.localTransform === 'object';
  };
  const children = value.filter(isChildMesh);
  return children.length > 0 ? children : undefined;
}

function collectProjectAssetIds(project: Project): string[] {
  const ids = new Set<string>();
  for (const object of project.objects) {
    const maybeAssetId = object.properties?.modelAssetId;
    if (typeof maybeAssetId !== 'string' || maybeAssetId.trim().length === 0) continue;
    if (maybeAssetId.startsWith('starter:')) continue;
    ids.add(maybeAssetId);
  }
  return Array.from(ids);
}

async function getAssetRowByAssetId(assetId: string, userId: string): Promise<AssetRow | null> {
  if (isUuid(assetId)) {
    const { data, error } = await supabase
      .from('assets')
      .select('id, owner_id, storage_key, filename, file_type, metadata')
      .eq('id', assetId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw new StorageError(`Failed to query asset "${assetId}": ${error.message}`);
    return toAssetRowOrNull(data, assetId);
  }

  const { data, error } = await supabase
    .from('assets')
    .select('id, owner_id, storage_key, filename, file_type, metadata')
    .eq('owner_id', userId)
    .contains('metadata', { asset_id: assetId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new StorageError(`Failed to query asset "${assetId}": ${error.message}`);
  return toAssetRowOrNull(data, assetId);
}

async function ensureAssetInCloud(assetId: string, userId: string): Promise<AssetRow> {
  let row = await getAssetRowByAssetId(assetId, userId);
  if (row) return row;

  await syncAssetToCloud(assetId, { userId });

  row = await getAssetRowByAssetId(assetId, userId);
  if (row) return row;

  throw new NotFoundError(
    `Asset "${assetId}" could not be found locally or in cloud storage. Try re-uploading the model, then publish again.`
  );
}

async function copyAssetToPublishedBucket(args: {
  projectId: string;
  userId: string;
  assetId: string;
  row: AssetRow;
}): Promise<AssetManifestEntry> {
  const fileType = toModelFileType(args.row.file_type);
  const publishedStoragePath = `${args.userId}/${args.projectId}/${args.assetId}/${sanitizeFilename(args.row.filename)}`;

  const { data: sourceBlob, error: sourceError } = await supabase.storage
    .from(USER_ASSETS_BUCKET)
    .download(args.row.storage_key);
  if (sourceError || !sourceBlob) {
    throw new StorageError(
      `Failed to download source asset "${args.assetId}" from "${args.row.storage_key}": ${sourceError?.message ?? 'Unknown error'}`
    );
  }

  const { error: uploadError } = await supabase.storage.from(PUBLISHED_ASSETS_BUCKET).upload(
    publishedStoragePath,
    sourceBlob,
    {
      upsert: true,
      contentType: toMimeType(fileType),
    }
  );
  if (uploadError) {
    throw new StorageError(
      `Failed to upload published asset "${args.assetId}" to "${publishedStoragePath}": ${uploadError.message}`
    );
  }

  const { data: publicData } = supabase.storage
    .from(PUBLISHED_ASSETS_BUCKET)
    .getPublicUrl(publishedStoragePath);
  const metadata = (args.row.metadata ?? {}) as Record<string, unknown>;

  return {
    url: publicData.publicUrl,
    fileType,
    metrics: toModelMetrics(metadata.metrics),
    children: toChildMeshes(metadata.children),
  };
}

async function copyBackgroundImageToPublishedBucket(args: {
  project: Project;
  projectId: string;
  userId: string;
}): Promise<SceneSettings | undefined> {
  const sceneSettings = toSceneSettings(args.project.sceneSettings);
  const storageKeyOrRef = sceneSettings.backgroundImage?.storageKey;
  if (!storageKeyOrRef) return undefined;

  if (isStarterBackgroundStorageRef(storageKeyOrRef)) {
    const starterPath = extractStarterBackgroundStoragePath(storageKeyOrRef);
    if (!starterPath) return undefined;
    const { data } = supabase.storage.from('starter-assets').getPublicUrl(starterPath);
    return {
      backgroundImage: {
        ...sceneSettings.backgroundImage!,
        signedUrl: data.publicUrl,
      },
    };
  }

  const storagePath = extractBackgroundImageStoragePath(storageKeyOrRef) ?? storageKeyOrRef;
  const filename = storagePath.split('/').pop() ?? 'background.jpg';
  const publishedStoragePath = `${args.userId}/${args.projectId}/background/${sanitizeFilename(filename)}`;

  const { data: sourceBlob, error: sourceError } = await supabase.storage
    .from(USER_ASSETS_BUCKET)
    .download(storagePath);
  if (sourceError || !sourceBlob) {
    throw new StorageError(
      `Failed to download source background image "${storagePath}": ${sourceError?.message ?? 'Unknown error'}`
    );
  }

  const mimeType = sourceBlob.type || 'image/jpeg';
  const { error: uploadError } = await supabase.storage
    .from(PUBLISHED_ASSETS_BUCKET)
    .upload(publishedStoragePath, sourceBlob, {
      upsert: true,
      contentType: mimeType,
    });
  if (uploadError) {
    throw new StorageError(
      `Failed to upload published background image "${publishedStoragePath}": ${uploadError.message}`
    );
  }

  const { data: publicData } = supabase.storage.from(PUBLISHED_ASSETS_BUCKET).getPublicUrl(publishedStoragePath);
  return {
    backgroundImage: {
      ...sceneSettings.backgroundImage!,
      signedUrl: publicData.publicUrl,
    },
  };
}

function toPublishedSnapshot(
  project: Project,
  assetManifest: Record<string, AssetManifestEntry>,
  sceneSettings?: SceneSettings
): PublishedSnapshot {
  const backgroundImageUrl = getSceneBackgroundUrl(sceneSettings);
  return {
    name: project.name,
    objects: project.objects,
    steps: project.steps,
    sceneSettings: sceneSettings
      ? {
          ...sceneSettings,
          backgroundImageUrl,
        }
      : undefined,
    simulationSettings: toSimulationSettings(project.simulationSettings),
    assetManifest,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAssetRow(value: unknown): value is AssetRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.owner_id === 'string' &&
    typeof value.storage_key === 'string' &&
    typeof value.filename === 'string' &&
    typeof value.file_type === 'string'
  );
}

function toAssetRowOrNull(value: unknown, assetId: string): AssetRow | null {
  if (!value) return null;
  if (isAssetRow(value)) return value;
  throw new StorageError(`Received invalid asset row shape while loading "${assetId}".`);
}

function isExistingPublishRow(value: unknown): value is ExistingPublishRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.share_token === 'string' &&
    typeof value.is_active === 'boolean'
  );
}

function isSceneObjectLike(value: unknown): value is SceneObject {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isRecord(value.transform) &&
    isRecord(value.properties)
  );
}

function isSimStepLike(value: unknown): value is SimStep {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string'
  );
}

function isAssetManifestEntry(value: unknown): value is AssetManifestEntry {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    (value.fileType === 'glb' || value.fileType === 'fbx' || value.fileType === 'obj')
  );
}

function parsePublishedSnapshot(value: unknown): PublishedSnapshot {
  if (!isRecord(value)) {
    throw new ValidationError('Invalid published snapshot payload.');
  }
  const name = value.name;
  const objects = value.objects;
  const steps = value.steps;
  const sceneSettings = value.sceneSettings;
  const simulationSettings = value.simulationSettings;
  const assetManifest = value.assetManifest;

  if (typeof name !== 'string') throw new ValidationError('Invalid published snapshot: missing name.');
  if (!Array.isArray(objects)) throw new ValidationError('Invalid published snapshot: missing objects.');
  if (!Array.isArray(steps)) throw new ValidationError('Invalid published snapshot: missing steps.');
  if (!isRecord(assetManifest)) {
    throw new ValidationError('Invalid published snapshot: missing asset manifest.');
  }

  if (!objects.every(isSceneObjectLike)) {
    throw new ValidationError('Invalid published snapshot: malformed objects.');
  }
  if (!steps.every(isSimStepLike)) {
    throw new ValidationError('Invalid published snapshot: malformed steps.');
  }
  if (!Object.values(assetManifest).every(isAssetManifestEntry)) {
    throw new ValidationError('Invalid published snapshot: malformed asset manifest.');
  }
  const validatedAssetManifest = assetManifest as Record<string, AssetManifestEntry>;

  let parsedSceneSettings: PublishedSnapshot['sceneSettings'] | undefined;
  if (isRecord(sceneSettings)) {
    const normalized = toSceneSettings(sceneSettings as Partial<SceneSettings>);
    const maybeBackgroundUrl = getPublishedSceneBackgroundUrl(
      sceneSettings as PublishedSnapshot['sceneSettings']
    );
    parsedSceneSettings = {
      ...normalized,
      backgroundImageUrl: maybeBackgroundUrl,
      backgroundImage: normalized.backgroundImage
        ? {
            ...normalized.backgroundImage,
            signedUrl: normalized.backgroundImage.signedUrl ?? maybeBackgroundUrl,
          }
        : undefined,
    };
  }

  // Best-effort structural validation: we validate top-level shape here, and rely on downstream
  // code to be tolerant of scene/object details while the published flow is still MVP.
  return {
    name,
    objects,
    steps,
    sceneSettings: parsedSceneSettings,
    simulationSettings: toSimulationSettings(
      isRecord(simulationSettings) ? (simulationSettings as Partial<SimulationSettings>) : undefined
    ),
    assetManifest: validatedAssetManifest,
  };
}

function isMissingPublishedSnapshotRpc(error: { code?: string; message: string }): boolean {
  if (error.code === 'PGRST202') return true;
  const message = error.message.toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('could not find the function') ||
    message.includes('get_published_snapshot')
  );
}

async function fetchPublishedSnapshotDirect(shareToken: string): Promise<PublishedSnapshot | null> {
  const { data, error } = await supabase
    .from('published_projects')
    .select('snapshot')
    .eq('share_token', shareToken)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new StorageError(`Failed to load published simulation: ${error.message}`);
  }
  if (!data?.snapshot) return null;

  return parsePublishedSnapshot(data.snapshot);
}

/**
 * Publish a project by creating/updating a backend snapshot and copying user assets to a public bucket.
 * Starter assets (`starter:*`, `starter-bg://`) are not copied; they are resolved from the starter catalog.
 */
export async function publishProject(project: Project, userId: string): Promise<PublishURLResult> {
  if (!project.id?.trim()) {
    throw new ValidationError('Project ID is required to publish.');
  }
  if (!userId?.trim()) {
    throw new ValidationError('Authenticated user ID is required to publish.');
  }
  if (!hasPreviewableContent(project.objects, project.steps)) {
    throw new ValidationError('Add a model or configure a step before publishing.');
  }

  const projectId = project.id.trim();
  const assetIds = collectProjectAssetIds(project);
  const assetManifest: Record<string, AssetManifestEntry> = {};

  // Process assets concurrently (capped at 4 to avoid overwhelming Supabase Storage).
  const CONCURRENCY = 4;
  for (let i = 0; i < assetIds.length; i += CONCURRENCY) {
    const batch = assetIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (assetId) => {
        const row = await ensureAssetInCloud(assetId, userId);
        const entry = await copyAssetToPublishedBucket({
          projectId,
          userId,
          assetId,
          row,
        });
        return { assetId, entry };
      })
    );
    for (const { assetId, entry } of results) {
      assetManifest[assetId] = entry;
    }
  }

  const publishedSceneSettings = await copyBackgroundImageToPublishedBucket({
    project,
    projectId,
    userId,
  });
  const snapshot = toPublishedSnapshot(project, assetManifest, publishedSceneSettings);

  const { data: existing, error: existingError } = await supabase
    .from('published_projects')
    .select('id, share_token, is_active')
    .eq('project_id', projectId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (existingError) {
    throw new StorageError(`Failed to check existing published snapshot: ${existingError.message}`);
  }

  if (existing) {
    if (!isExistingPublishRow(existing)) {
      throw new StorageError('Received invalid published snapshot row shape from database.');
    }
    const existingRow = existing;
    const { error: updateError } = await supabase
      .from('published_projects')
      .update({
        snapshot,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id)
      .eq('owner_id', userId);
    if (updateError) {
      throw new StorageError(`Failed to update published snapshot: ${updateError.message}`);
    }

    return {
      shareToken: existingRow.share_token,
      url: toPublishedUrl(existingRow.share_token),
    };
  }

  const shareToken = crypto.randomUUID();
  const { error: insertError } = await supabase.from('published_projects').insert({
    project_id: projectId,
    owner_id: userId,
    share_token: shareToken,
    snapshot,
    is_active: true,
  });
  if (insertError) {
    throw new StorageError(`Failed to create published snapshot: ${insertError.message}`);
  }

  return {
    shareToken,
    url: toPublishedUrl(shareToken),
  };
}

/**
 * Fetch existing publish state for a project (owner-only).
 */
export async function getExistingPublish(
  projectId: string,
  userId: string
): Promise<ExistingPublishRecord | null> {
  if (!projectId?.trim() || !userId?.trim()) return null;

  const { data, error } = await supabase
    .from('published_projects')
    .select('share_token, is_active')
    .eq('project_id', projectId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) {
    throw new StorageError(`Failed to load existing publish state: ${error.message}`);
  }
  if (!data) return null;

  const token = typeof data.share_token === 'string' ? data.share_token : null;
  if (!token) {
    throw new StorageError('Received invalid publish token shape from database.');
  }
  return {
    shareToken: token,
    url: toPublishedUrl(token),
    isActive: Boolean(data.is_active),
  };
}

/**
 * Disable an existing published link for a project (owner-only).
 * Also removes copied assets from the published-assets bucket to free storage.
 */
export async function unpublishProject(projectId: string, userId: string): Promise<void> {
  if (!projectId?.trim()) {
    throw new ValidationError('Project ID is required to unpublish.');
  }
  if (!userId?.trim()) {
    throw new ValidationError('Authenticated user ID is required to unpublish.');
  }

  const { error } = await supabase
    .from('published_projects')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('owner_id', userId);
  if (error) {
    throw new StorageError(`Failed to unpublish project: ${error.message}`);
  }

  // Best-effort cleanup: remove copied assets from the published-assets bucket.
  // Files are stored as {userId}/{projectId}/{assetId}/{filename}, so we need to
  // list the asset-ID sub-folders first, then list/remove files inside each.
  try {
    const projectPrefix = `${userId}/${projectId}`;
    const { data: assetFolders } = await supabase.storage
      .from(PUBLISHED_ASSETS_BUCKET)
      .list(projectPrefix, { limit: 200 });

    if (assetFolders && assetFolders.length > 0) {
      const pathsToRemove: string[] = [];
      for (const folder of assetFolders) {
        const folderPath = `${projectPrefix}/${folder.name}`;
        const { data: files } = await supabase.storage
          .from(PUBLISHED_ASSETS_BUCKET)
          .list(folderPath, { limit: 100 });
        if (files) {
          for (const file of files) {
            pathsToRemove.push(`${folderPath}/${file.name}`);
          }
        }
      }
      if (pathsToRemove.length > 0) {
        await supabase.storage.from(PUBLISHED_ASSETS_BUCKET).remove(pathsToRemove);
      }
    }
  } catch (cleanupError) {
    // Non-critical: published assets are publicly readable but won't be linked
    // after the snapshot is deactivated. Log and continue.
    logger.warn('[publishService] Failed to clean up published assets:', cleanupError);
  }
}

/**
 * Public lookup: resolve a share token to a published snapshot.
 *
 * Note: public access is routed through a narrow RPC to avoid broad anon
 * table reads while still allowing token-based published viewing.
 */
export async function fetchPublishedSnapshotByToken(shareToken: string): Promise<PublishedSnapshot | null> {
  if (!shareToken?.trim()) return null;
  const trimmedToken = shareToken.trim();

  const { data, error } = await supabase.rpc('get_published_snapshot', {
    p_share_token: trimmedToken,
  });

  if (error) {
    if (isMissingPublishedSnapshotRpc(error)) {
      logger.warn(
        '[publishService] get_published_snapshot RPC missing from schema cache; falling back to direct lookup. Apply migration 006.'
      );
      return fetchPublishedSnapshotDirect(trimmedToken);
    }
    throw new StorageError(`Failed to load published simulation: ${error.message}`);
  }
  if (!data) return null;

  return parsePublishedSnapshot(data);
}
