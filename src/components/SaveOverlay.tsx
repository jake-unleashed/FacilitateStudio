import { Button } from './Button';
import { AlertTriangle, Loader2 } from 'lucide-react';

export type SaveOverlayMode = 'saving' | 'error';

export interface SaveOverlayProps {
  mode: SaveOverlayMode;
  errorMessage?: string;
  onStay: () => void;
  onLeaveAnyway: () => void;
}

export function SaveOverlay({ mode, errorMessage, onStay, onLeaveAnyway }: SaveOverlayProps) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-sm rounded-[28px] border border-white/40 bg-white/80 p-6 shadow-glass backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/50 bg-white/60 shadow-sm">
            {mode === 'saving' ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-600" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold tracking-tight text-slate-800">
              {mode === 'saving' ? 'Saving…' : 'Couldn’t save changes'}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {mode === 'saving'
                ? 'Hang tight — we’re saving your latest edits.'
                : errorMessage || 'Something went wrong while saving to this device.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {mode === 'error' ? (
            <>
              <Button variant="secondary" size="md" onClick={onStay} className="rounded-[18px]">
                Stay
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={onLeaveAnyway}
                className="rounded-[18px]"
              >
                Leave anyway
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="md" onClick={onStay} className="rounded-[18px]">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
