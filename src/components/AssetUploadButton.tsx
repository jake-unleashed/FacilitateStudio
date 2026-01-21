/**
 * AssetUploadButton Component
 *
 * A polished upload interface supporting:
 * - Click to select file
 * - Drag and drop
 * - Real-time progress feedback
 * - Clear error/warning messages
 */

import React, { useRef, useState, useCallback, useMemo, DragEvent } from 'react';
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileBox } from 'lucide-react';
import { UploadProgress, validateModelFile } from '../types/model';
import { usePopup } from '../contexts/PopupContext';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS,
  STAGE_CONFIG,
  SUCCESS_DISPLAY_DURATION,
  SUPPORTED_FORMATS_TEXT,
} from './assetUpload/constants';
import type { InternalState } from './assetUpload/types';

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
// Component
// =============================================================================

export const AssetUploadButton: React.FC<AssetUploadButtonProps> = ({
  onUpload,
  disabled = false,
  className = '',
  uploadProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global popup for showing errors
  const { showPopup } = usePopup();

  // Internal state (used when uploadProgress is not provided externally)
  const [internalState, setInternalState] = useState<InternalState>({
    isUploading: false,
    error: null,
    fileName: null,
    stage: 'idle',
  });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Resolve to external progress if provided, otherwise use internal state
  const currentStage = uploadProgress?.stage ?? internalState.stage;
  const warning = uploadProgress?.warning ?? null;
  const fileName = uploadProgress?.fileName ?? internalState.fileName;

  // Helper to show error popup
  const showErrorPopup = useCallback(
    (message: string) => {
      showPopup({
        type: 'error',
        title: 'Upload Failed',
        message,
      });
    },
    [showPopup]
  );

  const isUploading = useMemo(() => {
    if (uploadProgress) {
      return !['idle', 'complete', 'error'].includes(uploadProgress.stage);
    }
    return internalState.isUploading;
  }, [uploadProgress, internalState.isUploading]);

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
        // Show error popup, reset button to idle so it stays usable
        showErrorPopup(validation.error ?? 'Invalid file');
        setInternalState({
          isUploading: false,
          error: null,
          fileName: null,
          stage: 'idle',
        });
        return;
      }

      // Upload
      try {
        setInternalState((prev) => ({ ...prev, stage: 'processing' }));
        await onUpload(file);
        setInternalState((prev) => ({
          ...prev,
          stage: 'complete',
          isUploading: false,
        }));

        // Reset after brief success display
        setTimeout(() => {
          setInternalState({
            isUploading: false,
            error: null,
            fileName: null,
            stage: 'idle',
          });
        }, SUCCESS_DISPLAY_DURATION);
      } catch (err) {
        // Show error popup, reset button to idle so it stays usable
        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed. Please try again.';
        showErrorPopup(errorMessage);
        setInternalState({
          isUploading: false,
          error: null,
          fileName: null,
          stage: 'idle',
        });
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onUpload, showErrorPopup]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await processFile(file);
      }
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

      // Basic extension check (validation will also check this, but we can fail fast)
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ACCEPTED_EXTENSIONS.has(ext)) {
        // Show error popup, keep button usable
        showErrorPopup(
          `Unsupported file type: .${ext ?? 'unknown'}. Supported formats: ${SUPPORTED_FORMATS_TEXT}.`
        );
        return;
      }

      await processFile(file);
    },
    [disabled, isUploading, processFile, showErrorPopup]
  );

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderIcon = useCallback(() => {
    if (isUploading) {
      return <Loader2 size={24} className="animate-spin" />;
    }
    if (currentStage === 'complete') {
      return <CheckCircle2 size={24} className="text-green-500" />;
    }
    if (isDragging) {
      return <FileBox size={24} />;
    }
    return <Upload size={24} />;
  }, [isUploading, currentStage, isDragging]);

  const getLabel = useCallback((): string => {
    if (isDragging) return 'Drop file here';
    if (isUploading) return STAGE_CONFIG[currentStage]?.label ?? 'Processing...';
    if (currentStage === 'complete') return 'Added to scene!';
    return 'Upload 3D Model';
  }, [isDragging, isUploading, currentStage]);

  const progressWidth = useMemo(() => {
    return uploadProgress?.progress ?? STAGE_CONFIG[currentStage]?.progress ?? 0;
  }, [uploadProgress?.progress, currentStage]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const getContainerClasses = useCallback((): string => {
    const base =
      'group relative cursor-pointer overflow-hidden rounded-[20px] border-2 border-dashed transition-all duration-200';

    if (isDragging) {
      return `${base} border-blue-400 bg-blue-50 shadow-lg shadow-blue-500/20`;
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
  }, [isDragging, currentStage, disabled, isUploading]);

  const getIconClasses = useCallback((): string => {
    const base =
      'flex h-12 w-12 items-center justify-center rounded-[12px] bg-white shadow-lg transition-all duration-300';

    if (isDragging) {
      return `${base} scale-110 text-blue-600 shadow-blue-500/20`;
    }
    if (currentStage === 'complete') {
      return `${base} text-green-500 shadow-green-500/10`;
    }

    const hoverEffect = !disabled && !isUploading && !isDragging ? 'group-hover:scale-110' : '';

    return `${base} text-blue-500 shadow-blue-500/10 ${hoverEffect}`;
  }, [isDragging, currentStage, disabled, isUploading]);

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
        aria-label="Upload 3D model file"
      />

      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={getContainerClasses()}
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-label="Upload asset"
        aria-disabled={disabled || isUploading}
      >
        {/* Progress bar */}
        {isUploading && (
          <div
            className="absolute inset-0 bg-blue-100/50 transition-all duration-300"
            style={{ width: `${progressWidth}%` }}
            role="progressbar"
            aria-valuenow={progressWidth}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        )}

        <div className="relative flex flex-col items-center justify-center gap-3 p-6 text-center">
          {/* Icon */}
          <div className={getIconClasses()}>{renderIcon()}</div>

          {/* Labels */}
          <div className="space-y-1">
            <p
              className={`text-sm font-bold ${
                currentStage === 'complete' ? 'text-green-700' : 'text-slate-800'
              }`}
            >
              {getLabel()}
            </p>

            {/* File name during upload */}
            {fileName && isUploading && (
              <p className="max-w-[200px] truncate text-xs text-slate-500">{fileName}</p>
            )}

            {/* Format hint (shown in idle state) */}
            {!isUploading && currentStage === 'idle' && (
              <p className="text-xs text-slate-400">Supported: {SUPPORTED_FORMATS_TEXT}</p>
            )}

            {/* Warning */}
            {warning && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle size={12} aria-hidden="true" />
                <span>{warning}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
