/**
 * RecentAssetsList Component
 *
 * Displays recently uploaded 3D assets in a simplified, user-friendly format.
 * Shows only essential information: model name (without extension), icon, and timestamp.
 * Clicking an asset adds it to the scene.
 */

/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from 'react';
import { Clock, Package } from 'lucide-react';
import { AssetMetadata } from '../types/model';
import { formatRelativeDate } from '../utils/formatRelativeDate';

// =============================================================================
// Types
// =============================================================================

interface RecentAssetsListProps {
  /** List of assets to display */
  assets: AssetMetadata[];
  /** Called when an asset is clicked */
  onAddAsset: (asset: AssetMetadata) => void;
  /** Message to show when list is empty */
  emptyMessage?: string;
}

interface AssetCardProps {
  asset: AssetMetadata;
  onAdd: () => void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Strips the file extension from a filename.
 *
 * @param filename - The filename with extension (e.g., "model.obj")
 * @returns The filename without extension (e.g., "model")
 *
 * @example
 * ```ts
 * stripFileExtension("chair.obj") // "chair"
 * stripFileExtension("table.glb") // "table"
 * stripFileExtension("noextension") // "noextension"
 * ```
 */
export function stripFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return filename;
  return filename.substring(0, lastDotIndex);
}

// =============================================================================
// Component
// =============================================================================

/**
 * RecentAssetsList - Displays recently uploaded 3D assets.
 *
 * Features:
 * - Sorts assets by upload date (most recent first)
 * - Shows simplified card view with name, icon, and timestamp
 * - Displays empty state when no assets are available
 */
export const RecentAssetsList: React.FC<RecentAssetsListProps> = ({
  assets,
  onAddAsset,
  emptyMessage = 'No recent assets',
}) => {
  // Sort by upload date (most recent first)
  const sortedAssets = useMemo(() => {
    return [...assets].sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
  }, [assets]);

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  if (sortedAssets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-8 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Clock size={20} />
        </div>
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
        <p className="mt-1 text-xs text-slate-400">Uploaded assets will appear here</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Asset List
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-2">
      {sortedAssets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} onAdd={() => onAddAsset(asset)} />
      ))}
    </div>
  );
};

// =============================================================================
// Asset Card Sub-Component
// =============================================================================

/**
 * AssetCard - Individual asset card in the recent assets list.
 *
 * Displays:
 * - Model icon (Package icon as placeholder)
 * - Model name (without file extension)
 * - Relative timestamp (e.g., "5m ago", "2h ago")
 */
const AssetCard: React.FC<AssetCardProps> = ({ asset, onAdd }) => {
  const displayName = stripFileExtension(asset.name);
  const relativeDate = formatRelativeDate(asset.uploadDate);

  return (
    <button
      onClick={onAdd}
      type="button"
      className="group w-full rounded-[20px] border border-white/50 bg-white/50 p-4 text-left shadow-sm transition-all hover:bg-white hover:shadow-md"
      aria-label={`Add ${displayName} to scene`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-500 shadow-sm">
          <Package size={18} aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Model Name */}
          <p className="truncate text-sm font-semibold leading-snug text-slate-800 group-hover:text-slate-900">
            {displayName}
          </p>

          {/* Timestamp */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock size={11} aria-hidden="true" />
            <span>{relativeDate}</span>
          </div>
        </div>
      </div>
    </button>
  );
};
