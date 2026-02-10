import { Upload } from 'lucide-react';
import type { AssetMetadata, UploadProgress } from '../../types/model';
import { AssetUploadButton } from '../AssetUploadButton';
import { AssetLibraryPanel } from '../AssetLibraryPanel';

export function AddPanel({
  onUploadAsset,
  uploadProgress,
  recentAssets = [],
  starterAssets = [],
  onAddRecentAsset,
  onRemoveAsset,
  onRequestModel,
}: {
  onUploadAsset?: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  starterAssets?: AssetMetadata[];
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
        <button
          type="button"
          onClick={onRequestModel}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Request a 3D Model
        </button>
      </div>

      {/* Asset Library (Starter + Recent) */}
      {onAddRecentAsset && (
        <AssetLibraryPanel
          starterAssets={starterAssets}
          recentAssets={recentAssets}
          onAddAsset={onAddRecentAsset}
          onRemoveRecent={onRemoveAsset}
        />
      )}
    </div>
  );
}

