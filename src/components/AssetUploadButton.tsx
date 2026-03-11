/**
 * AssetUploadButton Component
 *
 * A polished upload interface supporting:
 * - Click to select file
 * - Drag and drop
 * - Real-time progress feedback
 * - Clear error/warning messages
 */

import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
  DragEvent,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileBox } from 'lucide-react';
import { ModelValidationOptions, UploadProgress, validateModelFile } from '../types/model';
import { usePopup } from '../contexts/PopupContext';
import { ACCEPTED_FORMATS, STAGE_CONFIG, SUCCESS_DISPLAY_DURATION } from './assetUpload/constants';
import type { InternalState } from './assetUpload/types';
import { classifyUploadFiles } from '../utils/uploadClassifier';

// =============================================================================
// Types
// =============================================================================

interface AssetUploadButtonProps {
  /** Called when a model is selected for upload with optional texture files */
  onUpload: (modelFile: File, textureFiles?: File[]) => Promise<void>;
  /** When true, allows model uploads up to 500MB (internal testing). */
  extendedFileSizeLimit?: boolean;
  /** Disable the upload button */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** External progress state from useModelUpload hook */
  uploadProgress?: UploadProgress;
}

export interface AssetUploadButtonHandle {
  openFileDialog: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const AssetUploadButton = forwardRef<AssetUploadButtonHandle, AssetUploadButtonProps>(
  (
    { onUpload, extendedFileSizeLimit = false, disabled = false, className = '', uploadProgress },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const showInfoPopup = useCallback(
      (message: string) => {
        showPopup({
          type: 'info',
          title: 'Upload note',
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

    const validationOptions = useMemo<ModelValidationOptions>(
      () => ({ extendedSizeLimit: extendedFileSizeLimit }),
      [extendedFileSizeLimit]
    );

    // ---------------------------------------------------------------------------
    // Event Handlers
    // ---------------------------------------------------------------------------

    const handleClick = useCallback(() => {
      if (disabled || isUploading) return;
      fileInputRef.current?.click();
    }, [disabled, isUploading]);

    useImperativeHandle(
      ref,
      () => ({
        openFileDialog: handleClick,
      }),
      [handleClick]
    );

    const processFiles = useCallback(
      async (files: File[]) => {
        if (resetTimeoutRef.current !== null) {
          clearTimeout(resetTimeoutRef.current);
          resetTimeoutRef.current = null;
        }

        try {
          const classified = classifyUploadFiles(files);
          if (classified.warning) {
            showInfoPopup(classified.warning);
          }
          if (!classified.modelFile) {
            showErrorPopup(classified.error ?? 'No model file provided.');
            return;
          }

          const file = classified.modelFile;
          const textureCount = classified.textureFiles.length;
          const uploadDisplayName =
            textureCount > 0
              ? `${file.name} + ${textureCount} texture${textureCount === 1 ? '' : 's'}`
              : file.name;

          // Reset state
          setInternalState({
            isUploading: true,
            error: null,
            fileName: uploadDisplayName,
            stage: 'validating',
          });

          // Validate
          const validation = validateModelFile(file, validationOptions);
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
            await onUpload(file, classified.textureFiles);
            setInternalState((prev) => ({
              ...prev,
              stage: 'complete',
              isUploading: false,
            }));

            // Reset after brief success display
            if (resetTimeoutRef.current !== null) {
              clearTimeout(resetTimeoutRef.current);
            }
            resetTimeoutRef.current = setTimeout(() => {
              setInternalState({
                isUploading: false,
                error: null,
                fileName: null,
                stage: 'idle',
              });
              resetTimeoutRef.current = null;
            }, SUCCESS_DISPLAY_DURATION);
          } catch (err) {
            // Show error popup, reset button to idle so it stays usable
            const errorMessage =
              err instanceof Error ? err.message : 'Upload failed. Please try again.';
            console.error('[AssetUploadButton] Upload failed:', err);
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
        } catch (error) {
          console.error('[AssetUploadButton] Failed to process selected files:', error);
          showErrorPopup(
            error instanceof Error ? error.message : 'Unable to process the selected files.'
          );
          setInternalState({
            isUploading: false,
            error: null,
            fileName: null,
            stage: 'idle',
          });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      [onUpload, showErrorPopup, showInfoPopup, validationOptions]
    );

    const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) {
          return;
        }

        await processFiles(Array.from(fileList));
      },
      [processFiles]
    );

    const collectFilesFromDirectoryEntry = useCallback(
      async (entry: FileSystemEntry): Promise<File[]> => {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file = await new Promise<File>((resolve, reject) => {
            fileEntry.file(resolve, reject);
          });
          return [file];
        }

        if (entry.isDirectory) {
          const directoryEntry = entry as FileSystemDirectoryEntry;
          const reader = directoryEntry.createReader();
          const files: File[] = [];

          let shouldReadMore = true;
          while (shouldReadMore) {
            const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries(resolve, reject);
            });
            shouldReadMore = entries.length > 0;
            if (!shouldReadMore) break;

            for (const childEntry of entries) {
              const childFiles = await collectFilesFromDirectoryEntry(childEntry);
              files.push(...childFiles);
            }
          }

          return files;
        }

        return [];
      },
      []
    );

    const collectDroppedFiles = useCallback(
      async (dataTransfer: DataTransfer): Promise<File[]> => {
        const items = Array.from(dataTransfer.items ?? []);
        if (items.length === 0) {
          return Array.from(dataTransfer.files);
        }

        const allFiles: File[] = [];
        for (const item of items) {
          if (item.kind !== 'file') continue;
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            const entryFiles = await collectFilesFromDirectoryEntry(entry);
            allFiles.push(...entryFiles);
            continue;
          }

          const fallbackFile = item.getAsFile();
          if (fallbackFile) {
            allFiles.push(fallbackFile);
          }
        }

        return allFiles;
      },
      [collectFilesFromDirectoryEntry]
    );

    // ---------------------------------------------------------------------------
    // Drag and Drop Handlers
    // ---------------------------------------------------------------------------

    const handleDragEnter = useCallback(
      (e: DragEvent<HTMLButtonElement>) => {
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

    const handleDragLeave = useCallback((e: DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;

      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
      async (e: DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);

        if (disabled || isUploading) return;

        try {
          const files = await collectDroppedFiles(e.dataTransfer);
          if (files.length === 0) {
            showErrorPopup('No files found in your drop. Try dropping a model file or folder again.');
            return;
          }

          await processFiles(files);
        } catch (error) {
          console.error('[AssetUploadButton] Failed to read dropped files:', error);
          showErrorPopup(
            error instanceof Error ? error.message : 'Unable to read the dropped files.'
          );
        }
      },
      [collectDroppedFiles, disabled, isUploading, processFiles, showErrorPopup]
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
      if (isDragging) return 'Drop to upload';
      if (isUploading) return STAGE_CONFIG[currentStage]?.label ?? 'Processing...';
      if (currentStage === 'complete') return 'Added to scene!';
      return 'Upload 3D Model';
    }, [isDragging, isUploading, currentStage]);

    const progressWidth = useMemo(() => {
      return uploadProgress?.progress ?? STAGE_CONFIG[currentStage]?.progress ?? 0;
    }, [uploadProgress?.progress, currentStage]);

    useEffect(() => {
      return () => {
        if (resetTimeoutRef.current !== null) {
          clearTimeout(resetTimeoutRef.current);
        }
      };
    }, []);

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
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isUploading}
          aria-label="Upload 3D model and texture files"
        />

        <button
          type="button"
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={getContainerClasses()}
          aria-label="Upload asset"
          disabled={disabled || isUploading}
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
                <p className="text-xs text-slate-400">
                  Drag a GLB, FBX, or OBJ with any textures. GLB is recommended.
                </p>
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
        </button>
      </div>
    );
  }
);

AssetUploadButton.displayName = 'AssetUploadButton';
