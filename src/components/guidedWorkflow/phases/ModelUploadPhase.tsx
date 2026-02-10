import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Library } from 'lucide-react';
import type { FocusMode, SceneObject } from '../../../types';
import type { AssetMetadata, UploadProgress } from '../../../types/model';
import { AssetUploadButton } from '../../AssetUploadButton';
import { AssetLibraryPanel } from '../../AssetLibraryPanel';
import { Button } from '../../Button';
import { usePopup } from '../../../contexts/PopupContext';

interface ModelUploadPhaseProps {
  objects: SceneObject[];
  onUploadAsset: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  starterAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onDeleteObject?: (objectId: string) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onSubmenuChange?: (open: boolean) => void;
}

export function ModelUploadPhase({
  objects,
  onUploadAsset,
  uploadProgress,
  recentAssets,
  starterAssets,
  onAddRecentAsset,
  onDeleteObject,
  onFocusObject,
  onSubmenuChange,
}: ModelUploadPhaseProps): JSX.Element {
  const { showPopup } = usePopup();
  const uploadedObjects = useMemo(
    () => objects.filter((object) => object.type === 'mesh'),
    [objects]
  );
  const [emptyMode, setEmptyMode] = useState<'upload' | 'library'>('upload');

  const hasLibraryAssets =
    ((starterAssets?.length ?? 0) + (recentAssets?.length ?? 0)) > 0 && !!onAddRecentAsset;

  const setEmptyModeAndNotify = useCallback(
    (mode: 'upload' | 'library') => {
      setEmptyMode(mode);
      onSubmenuChange?.(mode === 'library');
    },
    [onSubmenuChange]
  );

  const handleRequestModel = useCallback(() => {
    showPopup({
      type: 'info',
      title: 'Request a 3D Model',
      message:
        "To request a 3D model, please contact the Facilitate team. We'll work with you to create the perfect model for your needs.",
    });
  }, [showPopup]);

  useEffect(() => {
    if (uploadedObjects.length === 0) return;
    // Once at least one model exists, treat this phase as "main view" (no submenu).
    setEmptyMode((prev) => (prev === 'upload' ? prev : 'upload'));
    onSubmenuChange?.(false);
  }, [onSubmenuChange, uploadedObjects.length]);

  if (uploadedObjects.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Add a 3D model</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Upload your first model to continue.
          </p>
        </div>

        {emptyMode === 'library' && hasLibraryAssets ? (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEmptyModeAndNotify('upload')}
                className="rounded-[12px]"
              >
                Back
              </Button>
            </div>
            <AssetLibraryPanel
              starterAssets={starterAssets ?? []}
              recentAssets={recentAssets ?? []}
              onAddAsset={onAddRecentAsset!}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <AssetUploadButton onUpload={onUploadAsset} uploadProgress={uploadProgress} />

            {hasLibraryAssets ? (
              <button
                type="button"
                onClick={() => setEmptyModeAndNotify('library')}
                className="group flex w-full items-start gap-4 rounded-[20px] border border-white/40 bg-white/60 p-5 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-slate-600 shadow-sm">
                  <Library size={24} />
                </span>
                <span className="flex-1">
                  <span className="text-sm font-semibold text-slate-800">Choose from your library</span>
                  <span className="mt-1 block text-xs font-medium text-slate-500">
                    Use starter models or recent uploads
                  </span>
                </span>
              </button>
            ) : null}

            <div className="pt-2 text-center">
              <p className="mb-2 text-xs text-slate-500">Don&apos;t have a 3D model yet?</p>
              <button
                type="button"
                onClick={handleRequestModel}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Request a 3D Model
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold text-slate-700">More 3D models to add?</p>

      <AssetUploadButton onUpload={onUploadAsset} uploadProgress={uploadProgress} />

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          In scene ({uploadedObjects.length})
        </p>
        <div className="space-y-2">
          {uploadedObjects.map((object) => (
            <div
              key={object.id}
              className="flex items-center justify-between overflow-hidden rounded-[16px] border border-white/40 bg-white/60 shadow-sm"
            >
              <button
                type="button"
                onClick={() => onFocusObject?.(object, undefined, 'full')}
                className="group flex flex-1 items-center gap-3 px-4 py-3 text-left transition-all duration-300 hover:bg-white/70 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/70 text-slate-500 shadow-sm">
                  <Box size={18} />
                </span>
                <p className="text-sm font-semibold text-slate-800">{object.name}</p>
              </button>
              {onDeleteObject ? (
                <div className="pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteObject(object.id)}
                    className="rounded-[12px]"
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {hasLibraryAssets ? (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Your library</h3>
          <AssetLibraryPanel
            starterAssets={starterAssets ?? []}
            recentAssets={recentAssets ?? []}
            onAddAsset={onAddRecentAsset}
          />
        </div>
      ) : null}
    </div>
  );
}
