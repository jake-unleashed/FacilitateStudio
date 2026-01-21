import React from 'react';
import { Clock, Upload } from 'lucide-react';
import type { AssetMetadata, UploadProgress } from '../../types/model';
import { AssetUploadButton } from '../AssetUploadButton';
import { RecentAssetsList } from '../RecentAssetsList';

export function AddPanel({
  onUploadAsset,
  uploadProgress,
  recentAssets = [],
  onAddRecentAsset,
  onRemoveAsset,
  onRequestModel,
}: {
  onUploadAsset?: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onRemoveAsset?: (assetId: string) => void;
  onRequestModel: () => void;
}): JSX.Element {
  return (
    <div className="space-y-6">
      {onUploadAsset ? (
        <AssetUploadButton onUpload={onUploadAsset} uploadProgress={uploadProgress} />
      ) : (
        <div className="group cursor-pointer rounded-[20px] border border-blue-100/50 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 shadow-sm transition-all hover:border-blue-300">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-blue-500 shadow-lg shadow-blue-500/10 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Upload 3D Model</p>
            </div>
          </div>
        </div>
      )}

      <div className="pt-2 text-center">
        <p className="mb-2 text-xs text-slate-500">Nothing to upload?</p>
        <button onClick={onRequestModel} className="text-sm font-medium text-blue-600 hover:underline">
          Request a 3D Model
        </button>
      </div>

      <div>
        <h3 className="mb-4 pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">Recent</h3>
        {onAddRecentAsset ? (
          <RecentAssetsList
            assets={recentAssets}
            onAddAsset={onAddRecentAsset}
            onRemoveAsset={onRemoveAsset}
            emptyMessage="No recent assets"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Clock size={20} />
            </div>
            <p className="text-sm font-medium text-slate-500">No recent assets</p>
            <p className="mt-1 text-xs text-slate-400">Uploaded assets will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

