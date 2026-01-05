/**
 * RecentAssetsList Component
 *
 * Displays recently uploaded 3D assets with metadata.
 * Clicking an asset adds it to the scene.
 */

import React, { useMemo } from 'react';
import { Clock, Package } from 'lucide-react';
import {
  AssetMetadata,
  ModelFileType,
  FILE_TYPE_LABELS,
  formatFileSize,
} from '../types/model';
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

// =============================================================================
// Constants
// =============================================================================

const FILE_TYPE_COLORS: Record<ModelFileType, string> = {
  obj: 'bg-blue-100 text-blue-700 border-blue-200',
  fbx: 'bg-purple-100 text-purple-700 border-purple-200',
  glb: 'bg-green-100 text-green-700 border-green-200',
  gltf: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

// =============================================================================
// Component
// =============================================================================

export const RecentAssetsList: React.FC<RecentAssetsListProps> = ({
  assets,
  onAddAsset,
  emptyMessage = 'No recent assets',
}) => {
  // Sort by upload date (most recent first)
  const sortedAssets = useMemo(() => {
    return [...assets].sort(
      (a, b) =>
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
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
        <p className="mt-1 text-xs text-slate-400">
          Uploaded assets will appear here
        </p>
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

interface AssetCardProps {
  asset: AssetMetadata;
  onAdd: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onAdd }) => {
  const colorClasses = FILE_TYPE_COLORS[asset.fileType];
  const typeLabel = FILE_TYPE_LABELS[asset.fileType];
  const relativeDate = formatRelativeDate(asset.uploadDate);

  return (
    <button
      onClick={onAdd}
      className="group w-full rounded-[20px] border border-white/50 bg-white/50 p-4 text-left shadow-sm transition-all hover:bg-white hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-500 shadow-sm">
          <Package size={18} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header: Name + Type Badge */}
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium leading-snug text-slate-700">
              {asset.name}
            </p>
            <span
              className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${colorClasses}`}
            >
              {typeLabel}
            </span>
          </div>

          {/* Metadata Row */}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {relativeDate}
            </span>
            <span>•</span>
            <span>{formatFileSize(asset.fileSize)}</span>

            {/* Model metrics (if available) */}
            {asset.metrics && (
              <>
                <span>•</span>
                <span>
                  {asset.metrics.maxDimension.toFixed(1)}u
                  {asset.metrics.triangleCount &&
                    asset.metrics.triangleCount > 1000 && (
                      <span className="ml-1 text-slate-300">
                        ({Math.round(asset.metrics.triangleCount / 1000)}k)
                      </span>
                    )}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
