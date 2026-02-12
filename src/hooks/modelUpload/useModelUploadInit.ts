import { useEffect } from 'react';

import type { AssetMetadata } from '../../types/model';
import {
  getRecentAssets,
  hasLegacyAssets,
  migrateLegacyAssets,
} from '../../utils/modelAssetStore';
import { seedStarterAssets, shouldReseedLibrary } from '../../utils/starterAssets/seedStarterAssets';

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

      // Seed starter assets if needed (first run or version change)
      if (shouldReseedLibrary()) {
        try {
          const seeded = await seedStarterAssets();
          if (seeded > 0) {
            console.log(`[useModelUpload] Seeded ${seeded} starter asset(s)`);
          }
        } catch (error) {
          console.error('[useModelUpload] Starter asset seeding failed:', error);
        }
      }

      // Load recent assets
      try {
        setRecentAssets(await (userId ? getRecentAssets(20, { userId }) : getRecentAssets(20)));
      } catch (error) {
        console.error('[useModelUpload] Failed to load recent assets:', error);
      }
    };

    init();
  }, [setRecentAssets, hasMigratedRef, userId]);
}

