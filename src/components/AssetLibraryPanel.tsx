/**
 * AssetLibraryPanel Component
 *
 * Unified library view showing both starter models and recent uploads.
 * Features collapsible sections and automatic thumbnail generation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AssetMetadata } from '../types/model';
import { RecentAssetsList } from './RecentAssetsList';
import { ensureAssetThumbnail } from '../utils/assetThumbnails/ensureAssetThumbnail';
import { HelpIcon } from './HelpIcon';

interface AssetLibraryPanelProps {
  /** Starter assets (seeded from app) */
  starterAssets: AssetMetadata[];
  /** Recent user uploads */
  recentAssets: AssetMetadata[];
  /** Called when an asset is clicked to add to scene */
  onAddAsset: (asset: AssetMetadata) => void;
  /** Called when a recent asset is removed (optional - omit for starter assets) */
  onRemoveRecent?: (assetId: string) => void;
}

/**
 * LocalStorage key for tracking starter section open/closed state.
 */
const STARTER_SECTION_OPEN_KEY = 'facilitate-starter-section-open';

/**
 * Get the starter section open/closed state from localStorage.
 * Defaults to true (open) if localStorage is unavailable.
 */
function getStarterSectionOpen(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const stored = localStorage.getItem(STARTER_SECTION_OPEN_KEY);
  return stored === null ? true : stored === 'true';
}

/**
 * Save the starter section open/closed state to localStorage.
 */
function setStarterSectionOpen(open: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STARTER_SECTION_OPEN_KEY, String(open));
}

/**
 * AssetLibraryPanel - Unified view of starter models and recent uploads.
 *
 * Features:
 * - Collapsible "Starter models" section (state persisted to localStorage)
 * - Recent uploads section (always visible)
 * - Lazy thumbnail generation for visible assets
 */
export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({
  starterAssets,
  recentAssets,
  onAddAsset,
  onRemoveRecent,
}) => {
  const [isStarterSectionOpen, setIsStarterSectionOpen] = useState(getStarterSectionOpen);

  // Persist section state to localStorage
  const handleToggleStarterSection = useCallback(() => {
    const newState = !isStarterSectionOpen;
    setIsStarterSectionOpen(newState);
    setStarterSectionOpen(newState);
  }, [isStarterSectionOpen]);

  // Trigger thumbnail generation for starter assets when section is opened
  useEffect(() => {
    if (isStarterSectionOpen && starterAssets.length > 0) {
      // Generate thumbnails in the background (fire and forget)
      starterAssets.forEach((asset) => {
        if (!asset.thumbnail) {
          ensureAssetThumbnail(asset.id).catch((error) => {
            console.error(`[AssetLibraryPanel] Thumbnail generation failed for ${asset.id}:`, error);
          });
        }
      });
    }
  }, [isStarterSectionOpen, starterAssets]);

  return (
    <div className="space-y-6">
      {/* Starter Models Section */}
      {starterAssets.length > 0 && (
        <div>
          <button
            type="button"
            onClick={handleToggleStarterSection}
            className="group mb-3 flex w-full items-center justify-between text-left"
            aria-expanded={isStarterSectionOpen}
            aria-label={isStarterSectionOpen ? 'Collapse starter models' : 'Expand starter models'}
          >
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-600">
                Starter models
              </h3>
              <HelpIcon content="Click any model to add it to your project." />
            </div>
            <div className="text-slate-400 transition-all group-hover:text-slate-600">
              {isStarterSectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </button>

          {isStarterSectionOpen && (
            <RecentAssetsList
              assets={starterAssets}
              onAddAsset={onAddAsset}
              emptyMessage="No starter models available"
              // Don't allow removing starter assets
              onRemoveAsset={undefined}
            />
          )}
        </div>
      )}

      {/* Recent Uploads Section */}
      {recentAssets.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Recent uploads
            </h3>
            <HelpIcon content="Click any model to add it to your project." />
          </div>
          <RecentAssetsList
            assets={recentAssets}
            onAddAsset={onAddAsset}
            onRemoveAsset={onRemoveRecent}
            emptyMessage="No recent uploads"
          />
        </div>
      )}

      {/* Empty state when both lists are empty */}
      {starterAssets.length === 0 && recentAssets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">No assets available</p>
          <p className="mt-1 text-xs text-slate-400">Upload a 3D model to get started</p>
        </div>
      )}
    </div>
  );
};
