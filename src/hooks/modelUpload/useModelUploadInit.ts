import { useEffect } from 'react';

import type { AssetMetadata } from '../../types/model';
import {
  getRecentAssets,
  hasLegacyAssets,
  migrateLegacyAssets,
} from '../../utils/modelAssetStore';
import { reconcilePendingSync } from '../../utils/assetSyncReconciler';

const LEGACY_STARTER_LIBRARY_VERSION_KEY = 'facilitate-starter-library-version';

export function useModelUploadInit({
  setRecentAssets,
  hasMigratedRef,
  userId,
}: {
  setRecentAssets: React.Dispatch<React.SetStateAction<AssetMetadata[]>>;
  hasMigratedRef: React.MutableRefObject<boolean>;
  userId?: string;
}): void {
  useEffect(() => {
    const init = async () => {
      // Run migration once
      if (!hasMigratedRef.current && hasLegacyAssets()) {
        hasMigratedRef.current = true;
        try {
          const count = await migrateLegacyAssets();
          if (count > 0) {
            console.log(`[useModelUpload] Migrated ${count} legacy assets`);
          }
        } catch (error) {
          console.error('[useModelUpload] Migration failed:', error);
        }
      }

      // One-time cleanup from legacy bundled starter model system.
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LEGACY_STARTER_LIBRARY_VERSION_KEY);
      }

      // Load recent assets
      try {
        setRecentAssets(await (userId ? getRecentAssets(20, { userId }) : getRecentAssets(20)));
      } catch (error) {
        console.error('[useModelUpload] Failed to load recent assets:', error);
      }

      if (userId) {
        reconcilePendingSync(userId).catch((error) => {
          console.warn('[useModelUploadInit] Background sync reconciliation failed:', error);
        });
      }
    };

    init();
  }, [setRecentAssets, hasMigratedRef, userId]);
}

