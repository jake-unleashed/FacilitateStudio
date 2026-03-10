import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, Globe2, ImagePlus, Loader2, Move3d, RefreshCw, Rotate3d, Scaling, Sparkles, Trash2, X } from 'lucide-react';
import type { SceneBackgroundImage, SceneWorldEnvironment } from '../../types/sceneSettings';
import type { BackgroundImageFlowPhase } from '../../hooks/useBackgroundImageFlow';
import type { WorldEnvironmentFlowPhase } from '../../types/worldEnvironment';
import type { StarterAssetCatalogEntry } from '../../services/starterAssetService';
import { preloadBackgroundTexture } from '../../utils/backgroundTextureCache';
import { toStarterBackgroundStorageRef } from '../../utils/backgroundImageUpload';
import { RotationSection } from '../rightSidebar/RotationSection';
import { ScaleSection } from '../rightSidebar/ScaleSection';

interface ScenePanelProps {
  backgroundImage?: SceneBackgroundImage;
  worldEnvironment?: SceneWorldEnvironment;
  onUploadBackground?: (file: File) => Promise<void>;
  starterBackgrounds?: StarterAssetCatalogEntry[];
  onSelectStarterBackground?: (asset: StarterAssetCatalogEntry) => Promise<void> | void;
  onRemoveBackground?: () => Promise<void>;
  onGenerateWorldEnvironment?: (file: File) => Promise<void>;
  onRemoveWorldEnvironment?: () => Promise<void>;
  onCancelWorldEnvironment?: () => void;
  isUploading?: boolean;
  statusText?: string | null;
  /** True while the GPU texture for the new background is still downloading after upload. */
  isTextureLoading?: boolean;
  phase?: BackgroundImageFlowPhase;
  worldEnvironmentStatusText?: string | null;
  worldEnvironmentPhase?: WorldEnvironmentFlowPhase;
  isWorldEnvironmentWorking?: boolean;
  worldEnvironmentPendingFilename?: string | null;
  onWorldEnvironmentTransformChange?: (
    updates: Partial<
      Pick<
        SceneWorldEnvironment,
        'positionX' | 'positionY' | 'positionZ' | 'rotationX' | 'rotationY' | 'rotationZ' | 'scale'
      >
    >
  ) => void;
  /** When false (default), the 3D environment generation feature is hidden. Enable via debug tools. */
  worldEnvironmentEnabled?: boolean;
}

const ACCEPTED_BACKGROUND_FORMATS = '.jpg,.jpeg,.png,.webp';
const ACCEPTED_WORLD_FORMATS = '.jpg,.jpeg,.png,.webp';

function StarterBackgroundCard({
  asset,
  isSelected,
  isDisabled,
  onSelect,
}: {
  asset: StarterAssetCatalogEntry;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: (asset: StarterAssetCatalogEntry) => void;
}): JSX.Element {
  const handleWarmTexture = useCallback(() => {
    preloadBackgroundTexture(asset.publicUrl);
  }, [asset.publicUrl]);

  return (
    <button
      type="button"
      className={`group flex w-full items-center justify-between rounded-[12px] border px-3 py-2.5 text-left transition-all hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
        isSelected ? 'border-blue-300 bg-blue-50/80 shadow-sm' : 'border-white/50 bg-white/60'
      }`}
      onClick={() => onSelect(asset)}
      onMouseEnter={handleWarmTexture}
      onFocus={handleWarmTexture}
      disabled={isDisabled}
      aria-label={isSelected ? `Starter background ${asset.name} selected` : `Use starter background ${asset.name}`}
    >
      <p
        className={`truncate text-sm font-semibold ${
          isSelected ? 'text-blue-900' : 'text-slate-700 group-hover:text-slate-900'
        }`}
      >
        {asset.name}
      </p>
      {isSelected && (
        <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
          <CheckCircle2 size={10} />
          Active
        </span>
      )}
    </button>
  );
}

export function ScenePanel({
  backgroundImage,
  worldEnvironment,
  onUploadBackground,
  starterBackgrounds = [],
  onSelectStarterBackground,
  onRemoveBackground,
  onGenerateWorldEnvironment,
  onRemoveWorldEnvironment,
  onCancelWorldEnvironment,
  isUploading = false,
  statusText = null,
  isTextureLoading = false,
  phase,
  worldEnvironmentStatusText = null,
  worldEnvironmentPhase = 'idle',
  isWorldEnvironmentWorking = false,
  worldEnvironmentPendingFilename = null,
  onWorldEnvironmentTransformChange,
  worldEnvironmentEnabled = false,
}: ScenePanelProps): JSX.Element {
  const [adjustMode, setAdjustMode] = useState<'menu' | 'position' | 'rotation' | 'scale' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isStarterSectionOpen, setIsStarterSectionOpen] = useState(true);
  const dragCounterRef = useRef(0);

  const effectivePhase = phase ?? (isUploading ? 'uploading' : isTextureLoading ? 'preparingScene' : 'idle');
  const isUploadingPhase = effectivePhase === 'optimizing' || effectivePhase === 'uploading';
  const isTextureLoadingPhase = effectivePhase === 'preparingScene';
  const isBackgroundLoading = isUploadingPhase || isTextureLoadingPhase;
  const isWorldGenerating = worldEnvironmentPhase === 'uploading' || worldEnvironmentPhase === 'generating';
  const isWorldLoading = worldEnvironmentPhase === 'loading';
  const isAnyLoading = isBackgroundLoading || isWorldEnvironmentWorking;
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const worldInputRef = useRef<HTMLInputElement | null>(null);

  const previewSrc = backgroundImage?.signedUrl;
  const worldPreviewSrc = worldEnvironment?.thumbnailUrl;
  const hasWorldEnvironment = !!worldEnvironment;
  const hasBackgroundImage = !!backgroundImage;
  const canAdjustWorldEnvironment = !!onWorldEnvironmentTransformChange && !!worldEnvironment;
  const worldFileDisplayName =
    worldEnvironment?.sourceImageFilename ?? worldEnvironmentPendingFilename ?? 'Generated Environment';

  // Whether the world environment feature UI should be visible (flag on, or data already exists)
  const showWorldEnvironmentUI = worldEnvironmentEnabled || hasWorldEnvironment || isWorldGenerating || isWorldLoading;

  const handleOpenBackgroundPicker = useCallback(() => {
    if (isAnyLoading) return;
    backgroundInputRef.current?.click();
  }, [isAnyLoading]);

  const handleOpenWorldPicker = useCallback(() => {
    if (isAnyLoading) return;
    worldInputRef.current?.click();
  }, [isAnyLoading]);

  const handleUploadBackgroundFile = useCallback(
    async (file: File | null) => {
      if (!file || isAnyLoading) return;
      if (!onUploadBackground) return;
      await onUploadBackground(file);
    },
    [isAnyLoading, onUploadBackground]
  );

  const handleUploadWorldFile = useCallback(
    async (file: File | null) => {
      if (!file || isAnyLoading) return;
      if (!onGenerateWorldEnvironment) return;
      await onGenerateWorldEnvironment(file);
    },
    [isAnyLoading, onGenerateWorldEnvironment]
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
      await handleUploadBackgroundFile(droppedFile);
    },
    [handleUploadBackgroundFile]
  );

  const isWorldError = worldEnvironmentPhase === 'error' || worldEnvironment?.status === 'error';
  const isWorldReady =
    worldEnvironmentPhase === 'ready' ||
    (worldEnvironment?.status === 'ready' && !isWorldGenerating && !isWorldLoading && !isWorldError);
  const worldPositionX = worldEnvironment?.positionX ?? 0;
  const worldPositionY = worldEnvironment?.positionY ?? 0;
  const worldPositionZ = worldEnvironment?.positionZ ?? 0;
  const worldRotationX = worldEnvironment?.rotationX ?? 0;
  const worldRotationY = worldEnvironment?.rotationY ?? 0;
  const worldRotationZ = worldEnvironment?.rotationZ ?? 0;
  const worldScale = worldEnvironment?.scale ?? 1;

  useEffect(() => {
    if (!isWorldReady) {
      setAdjustMode(null);
    }
  }, [isWorldReady]);

  const uploadCardClasses = useMemo(() => {
    const base = 'group relative rounded-[16px] border-2 border-dashed bg-white/40 p-4 transition-all duration-200';
    if (isAnyLoading) return `${base} cursor-not-allowed border-slate-300/70 opacity-80`;
    if (isDragging) return `${base} border-blue-400 bg-blue-50/70`;
    return `${base} cursor-pointer border-slate-300/80 hover:border-blue-300`;
  }, [isDragging, isAnyLoading]);

  const optionCardClasses =
    'group relative rounded-[16px] border border-white/40 bg-white/40 p-4 text-left shadow-sm transition-all duration-300 hover:scale-[1.01] hover:bg-white hover:shadow-md';

  // When world environment feature is off, show the original simple "Background" panel.
  // When it's on, show the "Environment" picker with both options.
  const sectionLabel = showWorldEnvironmentUI ? 'Environment' : 'Background';
  const showEmptyState = !hasBackgroundImage && !hasWorldEnvironment && !isWorldGenerating && !isWorldLoading;
  const hasStarterBackgrounds = starterBackgrounds.length > 0;
  const activeStarterBackgroundRef = backgroundImage?.storageKey ?? null;

  return (
    <div className="space-y-4">
      <input
        ref={backgroundInputRef}
        type="file"
        accept={ACCEPTED_BACKGROUND_FORMATS}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleUploadBackgroundFile(file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={worldInputRef}
        type="file"
        accept={ACCEPTED_WORLD_FORMATS}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleUploadWorldFile(file);
          event.currentTarget.value = '';
        }}
      />

      <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Globe2 size={14} className="text-slate-500" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{sectionLabel}</p>
        </div>

        {showEmptyState ? (
          showWorldEnvironmentUI ? (
            // Two-option picker (world environment feature enabled)
            <div className="space-y-2">
              <button
                type="button"
                className={optionCardClasses}
                onClick={handleOpenBackgroundPicker}
                disabled={isAnyLoading}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-blue-500 shadow-sm">
                    <ImagePlus size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Upload 360 Image</p>
                    <p className="text-xs text-slate-500">Drag and drop or click to browse</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className={optionCardClasses}
                onClick={handleOpenWorldPicker}
                disabled={isAnyLoading}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-indigo-500 shadow-sm">
                    <Sparkles size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Generate 3D Environment</p>
                    <p className="text-xs text-slate-500">Upload an image to generate a volumetric world</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            // Original single drag-and-drop upload card
            <button
              type="button"
              disabled={isAnyLoading}
              aria-label="Upload 360 background image"
              className={uploadCardClasses}
              onClick={handleOpenBackgroundPicker}
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
          )
        ) : hasBackgroundImage ? (
          <div className="rounded-[16px] border border-slate-200/80 bg-white/60 p-3">
            {!backgroundImage ? null : (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-20 overflow-hidden rounded-[10px] border border-white/50 bg-slate-100">
                    {isBackgroundLoading ? (
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
                    {(isUploadingPhase || isTextureLoadingPhase) && (
                      <p className="text-xs text-slate-500">
                        {isUploadingPhase
                          ? (statusText ?? 'Uploading...')
                          : 'Preparing scene...'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleOpenBackgroundPicker}
                    disabled={isBackgroundLoading}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-white/60 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={12} />
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onRemoveBackground) return;
                      void onRemoveBackground();
                    }}
                    disabled={isBackgroundLoading}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-red-100 bg-red-50/80 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </div>
                {showWorldEnvironmentUI && (
                  <button
                    type="button"
                    onClick={handleOpenWorldPicker}
                    disabled={isAnyLoading}
                    className="mt-2 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Switch to 3D environment
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[16px] border border-slate-200/80 bg-white/60 p-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-20 overflow-hidden rounded-[10px] border border-white/50 bg-slate-100">
                {isWorldGenerating || isWorldLoading ? (
                  <div className="flex h-full w-full items-center justify-center text-indigo-500">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : worldPreviewSrc ? (
                  <img src={worldPreviewSrc} alt="3D environment preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-indigo-500">
                    <Sparkles size={14} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{worldFileDisplayName}</p>
                <p className="text-xs text-slate-500">
                  {isWorldGenerating || isWorldLoading
                    ? (worldEnvironmentStatusText ?? 'Generating 3D environment...')
                    : isWorldError
                    ? worldEnvironment?.errorMessage ?? worldEnvironmentStatusText ?? 'Generation failed'
                    : '3D environment ready'}
                </p>
                {isWorldGenerating && (
                  <>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100"
                      aria-hidden="true"
                    >
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
                    </div>
                    {worldEnvironmentPhase === 'generating' && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        3D environments typically take 5-15 minutes to generate.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              {isWorldGenerating || isWorldLoading ? (
                <button
                  type="button"
                  onClick={onCancelWorldEnvironment}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-white/60 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                >
                  <X size={12} />
                  Cancel
                </button>
              ) : (
                <>
                  {canAdjustWorldEnvironment && (
                    <button
                      type="button"
                      onClick={() => setAdjustMode((prev) => (prev ? null : 'menu'))}
                      disabled={isAnyLoading || !isWorldReady}
                      className="inline-flex items-center gap-1 rounded-[10px] border border-white/60 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Move3d size={12} />
                      {adjustMode ? 'Close Adjust' : 'Adjust'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenWorldPicker}
                    disabled={isAnyLoading}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-white/60 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={12} />
                    {isWorldReady ? 'Replace' : 'Retry'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onRemoveWorldEnvironment) return;
                      void onRemoveWorldEnvironment();
                    }}
                    disabled={isAnyLoading}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-red-100 bg-red-50/80 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </>
              )}
            </div>

            {canAdjustWorldEnvironment && adjustMode && isWorldReady && (
              <div className="mt-3 space-y-3 border-t border-white/40 pt-3">
                {adjustMode === 'menu' && (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustMode('position')}
                      className="flex items-center gap-2 rounded-[12px] border border-white/50 bg-white/70 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                    >
                      <Move3d size={14} className="text-slate-500" />
                      Position
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustMode('rotation')}
                      className="flex items-center gap-2 rounded-[12px] border border-white/50 bg-white/70 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                    >
                      <Rotate3d size={14} className="text-slate-500" />
                      Rotation
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustMode('scale')}
                      className="flex items-center gap-2 rounded-[12px] border border-white/50 bg-white/70 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                    >
                      <Scaling size={14} className="text-slate-500" />
                      Scale
                    </button>
                  </div>
                )}

                {adjustMode === 'position' && (
                  <div className="space-y-2 rounded-[14px] border border-white/40 bg-white/50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Position Offset</p>
                      <button
                        type="button"
                        onClick={() => setAdjustMode('menu')}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Back
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Fine-tune where the environment sits around your scene center.
                    </p>
                    {(['X', 'Y', 'Z'] as const).map((axis) => {
                      const value =
                        axis === 'X' ? worldPositionX : axis === 'Y' ? worldPositionY : worldPositionZ;
                      const key = axis === 'X' ? 'positionX' : axis === 'Y' ? 'positionY' : 'positionZ';
                      return (
                        <label key={axis} className="block">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{axis}</span>
                            <span className="font-mono">{value.toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            step={0.5}
                            value={value}
                            onChange={(event) => {
                              onWorldEnvironmentTransformChange?.({
                                [key]: parseFloat(event.target.value),
                              });
                            }}
                            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600"
                            aria-label={`Environment ${axis} position`}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}

                {adjustMode === 'rotation' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rotation</p>
                      <button
                        type="button"
                        onClick={() => setAdjustMode('menu')}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Back
                      </button>
                    </div>
                    <RotationSection
                      rotationX={worldRotationX}
                      rotationY={worldRotationY}
                      rotationZ={worldRotationZ}
                      onRotationChange={(axis, value) => {
                        const key = axis === 'x' ? 'rotationX' : axis === 'y' ? 'rotationY' : 'rotationZ';
                        onWorldEnvironmentTransformChange?.({ [key]: value });
                      }}
                      onRotationCommit={(axis, value) => {
                        const key = axis === 'x' ? 'rotationX' : axis === 'y' ? 'rotationY' : 'rotationZ';
                        onWorldEnvironmentTransformChange?.({ [key]: value });
                      }}
                    />
                  </div>
                )}

                {adjustMode === 'scale' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Scale</p>
                      <button
                        type="button"
                        onClick={() => setAdjustMode('menu')}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Back
                      </button>
                    </div>
                    <ScaleSection
                      currentScale={worldScale}
                      min={0.3}
                      max={12}
                      step={0.1}
                      minLabel="0.3x"
                      maxLabel="12.0x"
                      onScaleChange={(value) => onWorldEnvironmentTransformChange?.({ scale: value })}
                      onScaleCommit={(value) => onWorldEnvironmentTransformChange?.({ scale: value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {hasStarterBackgrounds && (
          <div className="mt-3 border-t border-white/40 pt-3">
            <button
              type="button"
              onClick={() => setIsStarterSectionOpen((prev) => !prev)}
              className="mb-2 flex w-full items-center justify-between text-left"
              aria-expanded={isStarterSectionOpen}
              aria-label={isStarterSectionOpen ? 'Collapse starter backgrounds' : 'Expand starter backgrounds'}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Starter backgrounds</p>
              <span className="text-xs font-medium text-slate-500">
                {isStarterSectionOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {isStarterSectionOpen && (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {starterBackgrounds.map((asset) => {
                  const isSelected = activeStarterBackgroundRef === toStarterBackgroundStorageRef(asset.storageKey);

                  return (
                    <StarterBackgroundCard
                      key={asset.id}
                      asset={asset}
                      isSelected={isSelected}
                      isDisabled={isAnyLoading || !onSelectStarterBackground}
                      onSelect={(selectedAsset) => {
                        if (!onSelectStarterBackground) return;
                        void onSelectStarterBackground(selectedAsset);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
