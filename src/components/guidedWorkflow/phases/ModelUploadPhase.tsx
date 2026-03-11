import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Box, Library } from 'lucide-react';
import type { FocusMode, SceneObject } from '../../../types';
import type { AssetMetadata, UploadProgress } from '../../../types/model';
import type { GenerationTask } from '../../../types/modelGeneration';
import { AssetUploadButton, type AssetUploadButtonHandle } from '../../AssetUploadButton';
import { AssetLibraryPanel } from '../../AssetLibraryPanel';
import { Button } from '../../Button';
import { GenerationStatusCard } from '../../GenerationStatusCard';
import { ModelAddEntryCard, ModelSourceOptions } from '../../modelAdd/ModelAddCards';
import { usePopup } from '../../../contexts/PopupContext';
import { getErrorMessage } from '../../../utils/errors';

interface ModelUploadPhaseProps {
  objects: SceneObject[];
  onUploadAsset: (file: File, textureFiles?: File[]) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  starterAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onDeleteObject?: (objectId: string) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onSubmenuChange?: (open: boolean) => void;
  generations?: GenerationTask[];
  onGenerateFromImage?: (imageFile: File) => Promise<void>;
  onCancelGeneration?: (generationId: string) => void;
  onRetryGeneration?: (generationId: string) => void;
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
  generations = [],
  onGenerateFromImage,
  onCancelGeneration,
  onRetryGeneration,
}: ModelUploadPhaseProps): JSX.Element {
  const { showPopup } = usePopup();
  const uploadedObjects = useMemo(
    () => objects.filter((object) => object.type === 'mesh'),
    [objects]
  );
  const [emptyMode, setEmptyMode] = useState<'main' | 'new-model' | 'library'>('main');
  const [sideView, setSideView] = useState<'main' | 'new-model'>('main');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadButtonRef = useRef<AssetUploadButtonHandle | null>(null);

  const hasLibraryAssets =
    ((starterAssets?.length ?? 0) + (recentAssets?.length ?? 0)) > 0 && !!onAddRecentAsset;

  const setEmptyModeAndNotify = useCallback(
    (mode: 'main' | 'new-model' | 'library') => {
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
    setEmptyMode('main');
    setSideView('main');
    onSubmenuChange?.(false);
  }, [onSubmenuChange, uploadedObjects.length]);

  const handleUpload = useCallback(
    async (file: File, textureFiles?: File[]) => {
      await onUploadAsset(file, textureFiles);
      setEmptyModeAndNotify('main');
      setSideView('main');
    },
    [onUploadAsset, setEmptyModeAndNotify]
  );

  const handleGenerateFromImage = useCallback(
    async (imageFile: File | null) => {
      if (!imageFile || !onGenerateFromImage) return;
      try {
        await onGenerateFromImage(imageFile);
        setSideView('main');
      } catch (error) {
        showPopup({
          type: 'error',
          title: 'Image generation failed',
          message: getErrorMessage(error, 'We could not start model generation from that image.'),
        });
      }
    },
    [onGenerateFromImage, showPopup]
  );

  const showEmptyState = uploadedObjects.length === 0 && generations.length === 0;

  if (showEmptyState) {
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
                onClick={() => setEmptyModeAndNotify('main')}
                className="rounded-[12px]"
              >
                Back
              </Button>
            </div>
            <AssetLibraryPanel
              starterAssets={starterAssets ?? []}
              recentAssets={recentAssets ?? []}
              onAddAsset={onAddRecentAsset ?? (() => {})}
            />
          </div>
        ) : emptyMode === 'new-model' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmptyModeAndNotify('main');
                }}
                className="rounded-[12px]"
              >
                <ArrowLeft size={14} />
                Back
              </Button>
            </div>

            <ModelSourceOptions
              onUploadClick={() => uploadButtonRef.current?.openFileDialog()}
              onGenerateFromImageClick={() => imageInputRef.current?.click()}
              onRequestModelClick={handleRequestModel}
            />

            <AssetUploadButton
              ref={uploadButtonRef}
              onUpload={handleUpload}
              uploadProgress={uploadProgress}
              className="hidden"
            />

            <input
              ref={imageInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleGenerateFromImage(file);
                event.currentTarget.value = '';
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <ModelAddEntryCard
              title="Add New 3D Model"
              subtitle="Upload, generate, or request"
              onClick={() => setEmptyModeAndNotify('new-model')}
            />

            {generations.length > 0 ? (
              <div className="space-y-2">
                {generations.map((generation) => (
                  <GenerationStatusCard
                    key={generation.id}
                    task={generation}
                    onCancel={onCancelGeneration}
                    onRetry={onRetryGeneration}
                  />
                ))}
              </div>
            ) : null}

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

          </div>
        )}
      </div>
    );
  }

  const renderSideMainView = () => (
    <>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-700">Your 3D models</h3>
        <p className="text-xs font-medium text-slate-500">
          Add the models you need for your training scenario.
        </p>
      </div>

      {/* In scene + active generations — shown at the top */}
      {(uploadedObjects.length > 0 || generations.length > 0) && (
        <div className="space-y-4">
          {uploadedObjects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                In scene ({uploadedObjects.length})
              </p>
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
          )}

          {generations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Generating ({generations.length})
              </p>
              {generations.map((generation) => (
                <GenerationStatusCard
                  key={generation.id}
                  task={generation}
                  onCancel={onCancelGeneration}
                  onRetry={onRetryGeneration}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add another model — mirrors the AddPanel button */}
      <ModelAddEntryCard
        title="Add Another 3D Model"
        subtitle="Upload, generate, or request"
        onClick={() => setSideView('new-model')}
      />
    </>
  );

  const renderSideNewModelView = () => (
    <>
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <h3 className="min-w-0 pr-1 text-sm font-semibold leading-snug text-slate-700">
          How would you like to add your 3D model?
        </h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 rounded-[12px]"
          onClick={() => setSideView('main')}
        >
          <ArrowLeft size={14} />
          Back
        </Button>
      </div>

      <ModelSourceOptions
        onUploadClick={() => uploadButtonRef.current?.openFileDialog()}
        onGenerateFromImageClick={() => imageInputRef.current?.click()}
        onRequestModelClick={handleRequestModel}
      />

      {hasLibraryAssets ? (
        <AssetLibraryPanel
          starterAssets={starterAssets ?? []}
          recentAssets={recentAssets ?? []}
          onAddAsset={onAddRecentAsset ?? (() => {})}
        />
      ) : null}

      <AssetUploadButton
        ref={uploadButtonRef}
        onUpload={handleUpload}
        uploadProgress={uploadProgress}
        className="hidden"
      />

      <input
        ref={imageInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleGenerateFromImage(file);
          event.currentTarget.value = '';
        }}
      />
    </>
  );

  return (
    <div className="space-y-6">
      {sideView === 'main' ? renderSideMainView() : renderSideNewModelView()}
    </div>
  );
}
