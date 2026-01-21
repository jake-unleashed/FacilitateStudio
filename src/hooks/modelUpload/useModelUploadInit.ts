import { useEffect } from 'react';

import type { AssetMetadata } from '../../types/model';
import {
  getRecentAssets,
  hasLegacyAssets,
  migrateLegacyAssets,
} from '../../utils/modelAssetStore';

export function useModelUploadInit({
  setRecentAssets,
  hasMigratedRef,
}: {
  setRecentAssets: React.Dispatch<React.SetStateAction<AssetMetadata[]>>;
  hasMigratedRef: React.MutableRefObject<boolean>;
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

      // Load recent assets
      try {
        setRecentAssets(await getRecentAssets(20));
      } catch (error) {
        console.error('[useModelUpload] Failed to load recent assets:', error);
      }
    };

    init();
  }, [setRecentAssets, hasMigratedRef]);
}

