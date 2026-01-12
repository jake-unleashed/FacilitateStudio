/**
 * RecentAssetsList Component
 *
 * Displays recently uploaded 3D assets in a simplified, user-friendly format.
 * Shows only essential information: model name (without extension), icon, and timestamp.
 * Clicking an asset adds it to the scene.
 */

/* eslint-disable react-refresh/only-export-components */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Clock, Package, CheckCircle2 } from 'lucide-react';
import { AssetMetadata } from '../types/model';
import { formatRelativeDate } from '../utils/formatRelativeDate';

/** Time to show "Added to scene" feedback before resetting (matches upload button) */
export const ADDED_FEEDBACK_DURATION_MS = 2500;

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
  /** Whether this asset was just added to the scene */
  isAdded?: boolean;
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
  // Track which asset was just added (for visual feedback)
  const [addedAssetId, setAddedAssetId] = useState<string | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  // Handle adding an asset with visual feedback
  const handleAddAsset = useCallback(
    (asset: AssetMetadata) => {
      // Clear any existing timeout
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      // Set this asset as "added" for visual feedback
      setAddedAssetId(asset.id);

      // Call the parent handler
      onAddAsset(asset);

      // Reset after delay
      resetTimeoutRef.current = setTimeout(() => {
        setAddedAssetId(null);
        resetTimeoutRef.current = null;
      }, ADDED_FEEDBACK_DURATION_MS);
    },
    [onAddAsset]
  );

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
        <AssetCard
          key={asset.id}
          asset={asset}
          onAdd={() => handleAddAsset(asset)}
          isAdded={addedAssetId === asset.id}
        />
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
 * - Model icon (Package icon as placeholder, or checkmark when added)
 * - Model name (without file extension), or "Added to scene!" when added
 * - Relative timestamp (e.g., "5m ago", "2h ago")
 */
const AssetCard: React.FC<AssetCardProps> = ({ asset, onAdd, isAdded = false }) => {
  const displayName = stripFileExtension(asset.name);
  const relativeDate = formatRelativeDate(asset.uploadDate);

  return (
    <button
      onClick={onAdd}
      type="button"
      className={`group w-full rounded-[20px] border p-4 text-left shadow-sm transition-all ${
        isAdded
          ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100/50'
          : 'border-white/50 bg-white/50 hover:bg-white hover:shadow-md'
      }`}
      aria-label={isAdded ? `${displayName} added to scene` : `Add ${displayName} to scene`}
      disabled={isAdded}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] shadow-sm ${
            isAdded
              ? 'bg-green-500 text-white'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-500'
          }`}
        >
          {isAdded ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : (
            <Package size={18} aria-hidden="true" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Model Name or "Added to scene!" */}
          <p
            className={`truncate text-sm font-semibold leading-snug ${
              isAdded ? 'text-green-700' : 'text-slate-800 group-hover:text-slate-900'
            }`}
          >
            {isAdded ? 'Added to scene!' : displayName}
          </p>

          {/* Timestamp (or asset name when showing "Added") */}
          <div
            className={`mt-1 flex items-center gap-1.5 text-xs ${
              isAdded ? 'text-green-600' : 'text-slate-400'
            }`}
          >
            {isAdded ? (
              <span>{displayName}</span>
            ) : (
              <>
                <Clock size={11} aria-hidden="true" />
                <span>{relativeDate}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
