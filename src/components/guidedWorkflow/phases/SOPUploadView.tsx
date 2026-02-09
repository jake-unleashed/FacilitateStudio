import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../Button';
import {
  extractStepsFromFile,
  SOPServiceError,
  type SOPProcessingProgress,
} from '../../../services/sopService';
import { ACCEPTED_FILE_TYPES } from '../../../utils/documentProcessor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SOPUploadViewProps {
  /** Called when steps have been successfully extracted from the SOP. */
  onStepsExtracted: (steps: string[]) => void;
  /** Return to the choice screen. */
  onBack: () => void;
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'processing'; message: string; fileName: string }
  | { kind: 'error'; message: string; fileName: string; retryable: boolean };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SOPUploadView({ onStepsExtracted, onBack }: SOPUploadViewProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({ kind: 'idle' });
  // Keep a ref to the last file so we can retry without re-picking.
  const lastFileRef = useRef<File | null>(null);

  // ---- Core processing ----
  const processFile = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      setViewState({ kind: 'processing', message: 'Extracting text from document\u2026', fileName: file.name });

      const onProgress = (progress: SOPProcessingProgress) => {
        if (progress.stage === 'error') return; // handled via catch
        setViewState({ kind: 'processing', message: progress.message, fileName: file.name });
      };

      try {
        const result = await extractStepsFromFile(file, onProgress);
        // Success - hand off the steps
        onStepsExtracted(result.steps);
      } catch (error) {
        console.error('[SOPUploadView] Failed to extract SOP steps:', error);
        const message =
          error instanceof SOPServiceError
            ? error.message
            : 'Something went wrong. Please try again.';
        const retryable =
          error instanceof SOPServiceError ? error.retryable : true;

        setViewState({ kind: 'error', message, fileName: file.name, retryable });
      }
    },
    [onStepsExtracted]
  );

  // ---- Drag handlers ----
  const handleDragOver = useCallback((e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile]
  );

  // ---- File input handler ----
  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void processFile(file);
      }
      // Reset so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile]
  );

  const handleRetry = useCallback(() => {
    if (lastFileRef.current) {
      processFile(lastFileRef.current);
    }
  }, [processFile]);

  const handlePickDifferent = useCallback(() => {
    setViewState({ kind: 'idle' });
    lastFileRef.current = null;
  }, []);

  const isProcessing = viewState.kind === 'processing';

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-bold tracking-tight text-slate-800">
          Upload an SOP
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Upload your procedure document and we&apos;ll extract the steps automatically.
        </p>
      </div>

      {/* Error state */}
      {viewState.kind === 'error' && (
        <div className="rounded-[20px] border border-red-200/60 bg-red-50/60 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
              <AlertCircle size={18} />
            </span>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Couldn&apos;t extract steps
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {viewState.message}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {viewState.retryable && (
                  <Button variant="secondary" size="sm" onClick={handleRetry}>
                    <RefreshCw size={14} className="mr-1.5" />
                    Try again
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handlePickDifferent}>
                  Upload a different document
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing state */}
      {viewState.kind === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-blue-200/60 bg-blue-50/60">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">
              {viewState.message}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {viewState.fileName}
            </p>
          </div>
        </div>
      )}

      {/* Upload drop zone (visible when idle or after error) */}
      {viewState.kind !== 'processing' && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={isProcessing}
            className={`group flex w-full flex-col items-center gap-4 rounded-[20px] border-2 border-dashed p-10 text-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
              isDragging
                ? 'border-blue-400 bg-blue-50/50 shadow-md'
                : 'border-slate-300/60 bg-white/40 hover:border-blue-400/60 hover:bg-white/60 hover:shadow-sm'
            }`}
            aria-label="Upload SOP document"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-[20px] border shadow-sm transition-all duration-300 ${
                isDragging
                  ? 'border-blue-300/60 bg-blue-100/60 text-blue-600'
                  : 'border-white/60 bg-white/60 text-slate-500 group-hover:text-blue-600 group-hover:-rotate-6'
              }`}
            >
              {isDragging ? <FileText size={24} /> : <UploadCloud size={24} />}
            </span>

            <div>
              <p className="text-sm font-semibold text-slate-700">
                {isDragging ? 'Drop your file here' : 'Drag & drop your SOP here'}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                or click to browse
              </p>
            </div>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Supported formats */}
          <p className="text-center text-xs font-medium text-slate-400">
            Supported formats: PDF, Word (.doc, .docx), Text (.txt, .rtf)
          </p>
        </>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-white/10 pt-6">
        <Button
          variant="secondary"
          size="md"
          onClick={onBack}
          disabled={isProcessing}
          className="rounded-[20px]"
        >
          Back
        </Button>
        {/* No "Continue" button here — success auto-navigates to the step list */}
      </div>
    </div>
  );
}
