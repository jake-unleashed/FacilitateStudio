import { supabase } from '../lib/supabase';

export type StarterAssetType = 'model' | 'background';

interface StarterAssetRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  category: string | null;
  storage_key: string;
  thumbnail_url: string | null;
  file_type: string;
  file_size: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface StarterAssetCatalogEntry {
  id: string;
  type: StarterAssetType;
  name: string;
  description?: string;
  category?: string;
  storageKey: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize?: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  publicUrl: string;
}

const STARTER_ASSETS_BUCKET = 'starter-assets';

function isStarterAssetType(value: string): value is StarterAssetType {
  return value === 'model' || value === 'background';
}

/**
 * Builds the public URL for a starter asset stored in the shared starter-assets bucket.
 */
export function getStarterAssetPublicUrl(storageKey: string): string {
  return supabase.storage.from(STARTER_ASSETS_BUCKET).getPublicUrl(storageKey).data.publicUrl;
}

function toCatalogEntry(row: StarterAssetRow): StarterAssetCatalogEntry | null {
  if (!isStarterAssetType(row.type)) return null;
  if (!row.id || !row.storage_key || !row.name || !row.file_type) return null;

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    storageKey: row.storage_key,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    fileType: row.file_type,
    fileSize: row.file_size ?? undefined,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active,
    createdAt: row.created_at,
    publicUrl: getStarterAssetPublicUrl(row.storage_key),
  };
}

/**
 * Fetches all active starter assets for a single asset type from Supabase.
 */
export async function fetchStarterAssets(type: StarterAssetType): Promise<StarterAssetCatalogEntry[]> {
  const { data, error } = await supabase
    .from('starter_assets')
    .select(
      'id, type, name, description, category, storage_key, thumbnail_url, file_type, file_size, sort_order, is_active, created_at'
    )
    .eq('type', type)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load starter assets: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => toCatalogEntry(row as StarterAssetRow))
    .filter((entry): entry is StarterAssetCatalogEntry => entry !== null);
}

/**
 * Looks up a single active starter asset by ID.
 */
export async function getStarterAssetById(assetId: string): Promise<StarterAssetCatalogEntry | null> {
  if (!assetId) return null;

  const { data, error } = await supabase
    .from('starter_assets')
    .select(
      'id, type, name, description, category, storage_key, thumbnail_url, file_type, file_size, sort_order, is_active, created_at'
    )
    .eq('id', assetId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load starter asset "${assetId}": ${error.message}`);
  }
  if (!data) return null;
  return toCatalogEntry(data as StarterAssetRow);
}
