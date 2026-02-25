import { listUserAssets } from './cloudAssetStore';
import { getRecentAssets, syncAssetToCloud } from './modelAssetStore';

const MAX_RECONCILE_ASSETS = 500;
const CONCURRENCY = 3;
const reconciledUsers = new Set<string>();

function isStarterAsset(assetId: string): boolean {
  return assetId.startsWith('starter:');
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });

  await Promise.allSettled(runners);
}

/**
 * Backfill local-only assets to cloud for the current user.
 * Runs as a best-effort background reconciliation pass and is safe to call repeatedly.
 */
export async function reconcilePendingSync(userId: string): Promise<void> {
  if (!userId || reconciledUsers.has(userId)) return;
  reconciledUsers.add(userId);

  try {
    const [localAssets, cloudAssets] = await Promise.all([
      getRecentAssets(MAX_RECONCILE_ASSETS),
      listUserAssets(userId, MAX_RECONCILE_ASSETS),
    ]);

    const cloudAssetIds = new Set(cloudAssets.map((asset) => asset.assetId));
    const unsyncedAssetIds = localAssets
      .filter((asset) => !isStarterAsset(asset.id))
      .filter((asset) => !cloudAssetIds.has(asset.id))
      .map((asset) => asset.id);

    let syncedCount = 0;

    await runWithConcurrency(unsyncedAssetIds, CONCURRENCY, async (assetId) => {
      try {
        await syncAssetToCloud(assetId, { userId });
        syncedCount += 1;
      } catch (error) {
        console.warn(`[assetSyncReconciler] Failed to sync local asset ${assetId}:`, error);
      }
    });

    if (unsyncedAssetIds.length > 0) {
      console.log(
        `[assetSyncReconciler] Synced ${syncedCount}/${unsyncedAssetIds.length} local-only assets to cloud.`
      );
    }
  } catch (error) {
    // Allow retry next session if reconciliation itself fails before completion.
    reconciledUsers.delete(userId);
    throw error;
  }
}

