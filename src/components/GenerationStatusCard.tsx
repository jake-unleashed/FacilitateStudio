import { Loader2, Sparkles, X, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import type { GenerationTask } from '../types/modelGeneration';

interface GenerationStatusCardProps {
  task: GenerationTask;
  onCancel?: (generationId: string) => void;
  onRetry?: (generationId: string) => void;
}

function stageLabel(task: GenerationTask): string {
  switch (task.stage) {
    case 'uploading':
      return 'Uploading image...';
    case 'generating':
      return 'Generating 3D model...';
    case 'downloading':
      return 'Downloading model...';
    case 'processing':
      return 'Processing model...';
    case 'complete':
      return 'Added to scene';
    case 'failed':
      return task.error ?? 'Generation failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Queued';
  }
}

export function GenerationStatusCard({
  task,
  onCancel,
  onRetry,
}: GenerationStatusCardProps): JSX.Element {
  const isTerminal = task.stage === 'complete' || task.stage === 'failed' || task.stage === 'cancelled';
  const statusText = stageLabel(task);

  return (
    <div className="rounded-[20px] border border-white/40 bg-white/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <img
          src={task.imagePreviewDataUrl}
          alt={task.name}
          className="h-11 w-11 rounded-[12px] border border-white/60 bg-white object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-800">{task.name}</p>
            {!isTerminal && onCancel ? (
              <button
                type="button"
                onClick={() => onCancel(task.id)}
                className="rounded-[12px] p-1.5 text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                aria-label="Cancel generation"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {task.stage === 'failed' ? (
              <AlertCircle size={14} className="text-rose-500" />
            ) : task.stage === 'complete' ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : task.stage === 'cancelled' ? (
              <X size={14} className="text-slate-400" />
            ) : task.stage === 'generating' || task.stage === 'uploading' || task.stage === 'processing' ? (
              <Loader2 size={14} className="animate-spin text-blue-600" />
            ) : (
              <Sparkles size={14} className="text-blue-600" />
            )}
            <span>{statusText}</span>
          </div>

          {!isTerminal ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80"
              role="progressbar"
              aria-label="Generation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.max(0, Math.min(100, task.progress))}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.max(3, Math.min(100, task.progress))}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {task.stage === 'failed' && onRetry ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onRetry(task.id)}
            className="rounded-[12px]"
          >
            <RotateCcw size={14} />
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
