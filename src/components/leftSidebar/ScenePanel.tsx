import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { Globe2, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { SceneBackgroundImage } from '../../types/sceneSettings';
import type { BackgroundImageFlowPhase } from '../../hooks/useBackgroundImageFlow';

interface ScenePanelProps {
  backgroundImage?: SceneBackgroundImage;
  onUploadBackground: (file: File) => Promise<void>;
  onRemoveBackground: () => Promise<void>;
  isUploading?: boolean;
  statusText?: string | null;
  /** True while the GPU texture for the new background is still downloading after upload. */
  isTextureLoading?: boolean;
  phase?: BackgroundImageFlowPhase;
}

const ACCEPTED_BACKGROUND_FORMATS = '.jpg,.jpeg,.png,.webp';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function ScenePanel({
  backgroundImage,
  onUploadBackground,
  onRemoveBackground,
  isUploading = false,
  statusText = null,
  isTextureLoading = false,
  phase,
}: ScenePanelProps): JSX.Element {
  const effectivePhase = phase ?? (isUploading ? 'uploading' : isTextureLoading ? 'preparingScene' : 'idle');
  const isUploadingPhase = effectivePhase === 'optimizing' || effectivePhase === 'uploading';
  const isTextureLoadingPhase = effectivePhase === 'preparingScene';
  const isAnyLoading = isUploadingPhase || isTextureLoadingPhase;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const previewSrc = backgroundImage?.signedUrl;

  const handleOpenPicker = useCallback(() => {
    if (isAnyLoading) return;
    inputRef.current?.click();
  }, [isAnyLoading]);

  const handleUploadFile = useCallback(
    async (file: File | null) => {
      if (!file || isAnyLoading) return;
      await onUploadBackground(file);
    },
    [isAnyLoading, onUploadBackground]
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const droppedFile = event.dataTransfer.files?.[0] ?? null;
      await handleUploadFile(droppedFile);
    },
    [handleUploadFile]
  );

  const uploadCardClasses = useMemo(() => {
    const base =
      'group relative rounded-[16px] border-2 border-dashed bg-white/40 p-4 transition-all duration-200';
    if (isAnyLoading) return `${base} cursor-not-allowed border-slate-300/70 opacity-80`;
    if (isDragging) return `${base} border-blue-400 bg-blue-50/70`;
    return `${base} cursor-pointer border-slate-300/80 hover:border-blue-300`;
  }, [isDragging, isAnyLoading]);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_BACKGROUND_FORMATS}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleUploadFile(file);
          event.currentTarget.value = '';
        }}
      />

      <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Globe2 size={14} className="text-slate-500" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Background</p>
        </div>

        {!backgroundImage ? (
          <button
            type="button"
            disabled={isAnyLoading}
            aria-label="Upload 360 background image"
            className={uploadCardClasses}
            onClick={handleOpenPicker}
            onDragEnter={handleDragEnter}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDragLeave={handleDragLeave}
            onDrop={(event) => {
              void handleDrop(event);
            }}
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white text-blue-500 shadow-sm">
                {isAnyLoading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {isAnyLoading ? (statusText ?? 'Uploading 360 image...') : 'Upload 360 Image'}
              </p>
              <p className="text-xs text-slate-500">Drag and drop or click to browse</p>
              <p className="text-[11px] text-slate-400">JPG, PNG, WebP</p>
            </div>
          </button>
        ) : (
          <div className="rounded-[16px] border border-slate-200/80 bg-white/60 p-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-20 overflow-hidden rounded-[10px] border border-white/50 bg-slate-100">
                {isAnyLoading ? (
                  <div className="flex h-full w-full items-center justify-center text-blue-400">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : previewSrc ? (
                  <img src={previewSrc} alt="360 background preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Globe2 size={14} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{backgroundImage.filename}</p>
                <p className="text-xs text-slate-500">
                  {isUploadingPhase
                    ? (statusText ?? 'Uploading...')
                    : isTextureLoadingPhase
                    ? 'Preparing scene...'
                    : formatBytes(backgroundImage.fileSize)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleOpenPicker}
                disabled={isAnyLoading}
                className="inline-flex items-center gap-1 rounded-[10px] border border-white/60 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={12} />
                Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  void onRemoveBackground();
                }}
                disabled={isAnyLoading}
                className="inline-flex items-center gap-1 rounded-[10px] border border-red-100 bg-red-50/80 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
