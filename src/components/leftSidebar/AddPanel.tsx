import { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { AssetMetadata, UploadProgress } from '../../types/model';
import type { GenerationTask } from '../../types/modelGeneration';
import { AssetUploadButton, type AssetUploadButtonHandle } from '../AssetUploadButton';
import { AssetLibraryPanel } from '../AssetLibraryPanel';
import { GenerationStatusCard } from '../GenerationStatusCard';
import { ModelAddEntryCard, ModelSourceOptions } from '../modelAdd/ModelAddCards';
import { Button } from '../Button';

type AddPanelView = 'main' | 'new-model';

export function AddPanel({
  onUploadAsset,
  uploadProgress,
  recentAssets = [],
  starterAssets = [],
  onAddRecentAsset,
  onRemoveAsset,
  onRequestModel,
  generations = [],
  onGenerateFromImage,
  onCancelGeneration,
  onRetryGeneration,
}: {
  onUploadAsset?: (file: File, textureFiles?: File[]) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  starterAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onRemoveAsset?: (assetId: string) => void;
  onRequestModel: () => void;
  generations?: GenerationTask[];
  onGenerateFromImage?: (imageFile: File) => Promise<void>;
  onCancelGeneration?: (generationId: string) => void;
  onRetryGeneration?: (generationId: string) => void;
}): JSX.Element {
  const [view, setView] = useState<AddPanelView>('main');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadButtonRef = useRef<AssetUploadButtonHandle | null>(null);

  const handleUpload = async (file: File, textureFiles?: File[]) => {
    if (!onUploadAsset) return;
    await onUploadAsset(file, textureFiles);
    setView('main');
  };

  const handleGenerateFromImage = (imageFile: File | null) => {
    if (!imageFile || !onGenerateFromImage) return;
    setView('main');
    void onGenerateFromImage(imageFile);
  };

  const renderMainView = () => (
    <>
      <ModelAddEntryCard
        title="Add New 3D Model"
        subtitle="Upload, generate, or request"
        onClick={() => setView('new-model')}
      />

      {generations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Active generations ({generations.length})
          </p>
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
        </div>
      ) : null}

      {onAddRecentAsset && (
        <AssetLibraryPanel
          starterAssets={starterAssets}
          recentAssets={recentAssets}
          onAddAsset={onAddRecentAsset}
          onRemoveRecent={onRemoveAsset}
        />
      )}
    </>
  );

  const renderNewModelView = () => (
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
          onClick={() => {
            setView('main');
          }}
        >
          <ArrowLeft size={14} />
          Back
        </Button>
      </div>

      <ModelSourceOptions
        onUploadClick={() => uploadButtonRef.current?.openFileDialog()}
        onGenerateFromImageClick={() => imageInputRef.current?.click()}
        onRequestModelClick={onRequestModel}
      />

      {onUploadAsset ? (
        <AssetUploadButton
          ref={uploadButtonRef}
          onUpload={handleUpload}
          uploadProgress={uploadProgress}
          className="hidden"
        />
      ) : null}

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
      {view === 'main' ? renderMainView() : renderNewModelView()}
    </div>
  );
}

