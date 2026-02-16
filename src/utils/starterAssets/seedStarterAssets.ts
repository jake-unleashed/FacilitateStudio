/**
 * Starter Assets Seeding
 *
 * Seeds discovered starter assets into IndexedDB on first run or when the library version changes.
 * Ensures starter assets are always available without requiring upload.
 */

import { upsertAssetFromBlob } from '../modelAssetStore';
import { discoverStarterAssets, type StarterAssetDescriptor } from './discoverStarterAssets';
import { logger } from '../logger';

/**
 * Library version identifier.
 * Increment this when adding/removing/changing starter assets to trigger reseeding.
 * Also increment to force thumbnail regeneration with updated lighting/rendering.
 */
export const STARTER_LIBRARY_VERSION = '4';

/**
 * LocalStorage key for tracking the seeded library version.
 */
const LIBRARY_VERSION_KEY = 'facilitate-starter-library-version';

/**
 * Get the currently seeded library version from localStorage.
 * Returns null if localStorage is unavailable (e.g. SSR, private browsing).
 */
function getSeededLibraryVersion(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LIBRARY_VERSION_KEY);
}

/**
 * Mark the library as seeded with the current version.
 */
function markLibrarySeeded(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LIBRARY_VERSION_KEY, STARTER_LIBRARY_VERSION);
}

/**
 * Check if the starter library needs reseeding.
 * Returns true if:
 * - Never seeded before
 * - Library version has changed
 */
export function shouldReseedLibrary(): boolean {
  const seededVersion = getSeededLibraryVersion();
  return seededVersion !== STARTER_LIBRARY_VERSION;
}

/**
 * Fetch a starter asset from its URL and convert to Blob.
 *
 * @param asset - The starter asset descriptor
 * @returns The fetched blob
 */
async function fetchAssetBlob(asset: StarterAssetDescriptor): Promise<Blob> {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${asset.name}: ${response.statusText}`);
  }
  return response.blob();
}

/**
 * Seed a single starter asset into IndexedDB.
 * Clears any existing thumbnail to force regeneration with updated rendering.
 *
 * @param asset - The starter asset descriptor
 * @returns The created asset metadata
 */
async function seedStarterAsset(asset: StarterAssetDescriptor): Promise<void> {
  logger.log(`[seedStarterAssets] Seeding ${asset.id} (${asset.name})`);

  // Fetch the asset blob
  const blob = await fetchAssetBlob(asset);

  // Store in IndexedDB with the deterministic ID
  // Note: metadataOverrides with thumbnail: undefined ensures old thumbnails are cleared
  await upsertAssetFromBlob({
    id: asset.id,
    name: asset.name,
    fileType: asset.fileType,
    uploadDate: new Date().toISOString(),
    blob,
    metadataOverrides: {
      // Clear thumbnail to force regeneration with updated lighting
      thumbnail: undefined,
      thumbnailUpdatedAt: undefined,
    },
  });
}

/**
 * Seed all discovered starter assets into IndexedDB.
 * When library version changes, re-seeds all assets and clears thumbnails for regeneration.
 *
 * @returns Number of assets seeded
 */
export async function seedStarterAssets(): Promise<number> {
  const assets = discoverStarterAssets();

  if (assets.length === 0) {
    logger.log('[seedStarterAssets] No starter assets found');
    return 0;
  }

  logger.log(`[seedStarterAssets] Found ${assets.length} starter asset(s)`);

  let seededCount = 0;

  // When version changes, re-seed all assets to clear cached thumbnails
  // This ensures thumbnails regenerate with updated lighting/rendering
  for (const asset of assets) {
    try {
      await seedStarterAsset(asset);
      seededCount++;
    } catch (error) {
      logger.error(`[seedStarterAssets] Failed to seed ${asset.id}:`, error);
      // Continue with other assets even if one fails
    }
  }

  // Mark library as seeded with current version
  markLibrarySeeded();

  logger.log(`[seedStarterAssets] Seeded ${seededCount} asset(s)`);
  return seededCount;
}

/**
 * Get list of starter asset IDs that should exist.
 * Useful for filtering the full asset list to show only starters.
 */
export function getStarterAssetIds(): string[] {
  return discoverStarterAssets().map((a) => a.id);
}
