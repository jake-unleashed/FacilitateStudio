/**
 * AssetUploadButton Component
 *
 * A polished upload interface supporting:
 * - Click to select file
 * - Drag and drop
 * - Real-time progress feedback
 * - Clear error/warning messages
 */

import React, { useRef, useState, useCallback, DragEvent } from 'react';
import {
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileBox,
} from 'lucide-react';
import {
  UploadProgress,
  UploadStage,
  STORAGE_CONFIG,
  formatFileSize,
  validateModelFile,
} from '../types/model';

// =============================================================================
// Types
// =============================================================================

interface AssetUploadButtonProps {
  /** Called when a file is selected for upload */
  onUpload: (file: File) => Promise<void>;
  /** Disable the upload button */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** External progress state from useModelUpload hook */
  uploadProgress?: UploadProgress;
}

// =============================================================================
// Constants
// =============================================================================

const ACCEPTED_FORMATS = '.obj,.fbx,.glb,.gltf';
const ACCEPTED_EXTENSIONS = new Set(['obj', 'fbx', 'glb', 'gltf']);

/** Display configuration for each upload stage */
const STAGE_CONFIG: Record<UploadStage, { label: string; progress: number }> = {
  idle: { label: 'Upload Asset', progress: 0 },
  validating: { label: 'Validating...', progress: 10 },
  storing: { label: 'Storing...', progress: 25 },
  processing: { label: 'Processing model...', progress: 50 },
  adding: { label: 'Adding to scene...', progress: 85 },
  complete: { label: 'Complete!', progress: 100 },
  error: { label: 'Upload failed', progress: 0 },
};

// =============================================================================
// Component
// =============================================================================

export const AssetUploadButton: React.FC<AssetUploadButtonProps> = ({
  onUpload,
  disabled = false,
  className = '',
  uploadProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Internal state (used when uploadProgress is not provided externally)
  const [internalState, setInternalState] = useState({
    isUploading: false,
    error: null as string | null,
    fileName: null as string | null,
    stage: 'idle' as UploadStage,
  });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Resolve to external progress if provided, otherwise use internal state
  const currentStage = uploadProgress?.stage ?? internalState.stage;
  const error = uploadProgress?.error ?? internalState.error;
  const warning = uploadProgress?.warning ?? null;
  const fileName = uploadProgress?.fileName ?? internalState.fileName;

  const isUploading = uploadProgress
    ? !['idle', 'complete', 'error'].includes(uploadProgress.stage)
    : internalState.isUploading;

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClick = useCallback(() => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  }, [disabled, isUploading]);

  const processFile = useCallback(
    async (file: File) => {
      // Reset state
      setInternalState({
        isUploading: true,
        error: null,
        fileName: file.name,
        stage: 'validating',
      });

      // Validate
      const validation = validateModelFile(file);
      if (!validation.valid) {
        setInternalState({
          isUploading: false,
          error: validation.error ?? 'Invalid file',
          fileName: null,
          stage: 'error',
        });
        return;
      }

      // Upload
      try {
        setInternalState((s) => ({ ...s, stage: 'processing' }));
        await onUpload(file);
        setInternalState((s) => ({ ...s, stage: 'complete', isUploading: false }));

        // Reset after brief success display
        setTimeout(() => {
          setInternalState({
            isUploading: false,
            error: null,
            fileName: null,
            stage: 'idle',
          });
        }, 1500);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setInternalState({
          isUploading: false,
          error: errorMessage,
          fileName: null,
          stage: 'error',
        });
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onUpload]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
    },
    [processFile]
  );

  // ---------------------------------------------------------------------------
  // Drag and Drop Handlers
  // ---------------------------------------------------------------------------

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;

      if (disabled || isUploading) return;

      if (e.dataTransfer.types.includes('Files')) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Basic extension check
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ACCEPTED_EXTENSIONS.has(ext)) {
        setInternalState({
          isUploading: false,
          error: `Unsupported file type: .${ext ?? 'unknown'}. Use OBJ, FBX, GLB, or GLTF.`,
          fileName: null,
          stage: 'error',
        });
        return;
      }

      await processFile(file);
    },
    [disabled, isUploading, processFile]
  );

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderIcon = () => {
    if (isUploading) {
      return <Loader2 size={24} className="animate-spin" />;
    }
    if (currentStage === 'complete') {
      return <CheckCircle2 size={24} className="text-green-500" />;
    }
    if (currentStage === 'error' || error) {
      return <AlertCircle size={24} className="text-red-500" />;
    }
    if (isDragging) {
      return <FileBox size={24} />;
    }
    return <Upload size={24} />;
  };

  const getLabel = (): string => {
    if (isDragging) return 'Drop file here';
    if (isUploading) return STAGE_CONFIG[currentStage]?.label ?? 'Processing...';
    if (currentStage === 'complete') return 'Added to scene!';
    if (error) return 'Upload failed';
    return 'Upload Asset';
  };

  const progressWidth = uploadProgress?.progress ?? STAGE_CONFIG[currentStage]?.progress ?? 0;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const getContainerClasses = (): string => {
    const base = `
      group relative cursor-pointer overflow-hidden rounded-[20px] border-2 border-dashed transition-all duration-200
    `;

    if (isDragging) {
      return `${base} border-blue-400 bg-blue-50 shadow-lg shadow-blue-500/20`;
    }
    if (error) {
      return `${base} border-red-200 bg-gradient-to-br from-red-50 to-red-100/50`;
    }
    if (currentStage === 'complete') {
      return `${base} border-green-200 bg-gradient-to-br from-green-50 to-green-100/50`;
    }

    const defaultStyle = 'border-blue-100/50 bg-gradient-to-br from-blue-50 to-indigo-50/50';
    const interactiveStyle =
      disabled || isUploading
        ? 'cursor-not-allowed opacity-60'
        : 'hover:border-blue-300 hover:shadow-md';

    return `${base} ${defaultStyle} ${interactiveStyle}`;
  };

  const getIconClasses = (): string => {
    const base = `
      flex h-12 w-12 items-center justify-center rounded-[12px] bg-white shadow-lg transition-all duration-300
    `;

    if (isDragging) {
      return `${base} scale-110 text-blue-600 shadow-blue-500/20`;
    }
    if (error) {
      return `${base} text-red-500 shadow-red-500/10`;
    }
    if (currentStage === 'complete') {
      return `${base} text-green-500 shadow-green-500/10`;
    }

    const hoverEffect =
      !disabled && !isUploading && !isDragging
        ? 'group-hover:-rotate-6 group-hover:scale-110'
        : '';

    return `${base} text-blue-500 shadow-blue-500/10 ${hoverEffect}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={getContainerClasses()}
      >
        {/* Progress bar */}
        {isUploading && (
          <div
            className="absolute inset-0 bg-blue-100/50 transition-all duration-300"
            style={{ width: `${progressWidth}%` }}
          />
        )}

        <div className="relative flex flex-col items-center justify-center gap-3 p-6 text-center">
          {/* Icon */}
          <div className={getIconClasses()}>{renderIcon()}</div>

          {/* Labels */}
          <div className="space-y-1">
            <p
              className={`text-sm font-bold ${
                error
                  ? 'text-red-700'
                  : currentStage === 'complete'
                    ? 'text-green-700'
                    : 'text-slate-800'
              }`}
            >
              {getLabel()}
            </p>

            {/* File name during upload */}
            {fileName && isUploading && (
              <p className="max-w-[200px] truncate text-xs text-slate-500">{fileName}</p>
            )}

            {/* Drag hint (shown in idle state) */}
            {!isUploading && !error && currentStage === 'idle' && (
              <p className="text-xs text-slate-400">
                or drag & drop (max {formatFileSize(STORAGE_CONFIG.MAX_FILE_SIZE)})
              </p>
            )}

            {/* Warning */}
            {warning && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle size={12} />
                <span>{warning}</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p className="text-xs leading-relaxed text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
