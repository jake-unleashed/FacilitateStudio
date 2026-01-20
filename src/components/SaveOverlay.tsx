import { Button } from './Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

export type SaveOverlayMode = 'saving' | 'error';

export interface SaveOverlayProps {
  mode: SaveOverlayMode;
  errorMessage?: string;
  onStay: () => void;
  onLeaveAnyway: () => void;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const tabIndex = el.getAttribute('tabindex');
    if (tabIndex === '-1') return false;
    return true;
  });
}

export function SaveOverlay({ mode, errorMessage, onStay, onLeaveAnyway }: SaveOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus trap + restore focus on close/unmount.
  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const auto = dialog.querySelector<HTMLElement>('[data-autofocus="true"]');
      auto?.focus?.();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStay();
        return;
      }

      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const active = document.activeElement;
      const currentIndex = active ? focusables.indexOf(active as HTMLElement) : -1;

      if (currentIndex === -1) {
        e.preventDefault();
        (e.shiftKey ? focusables[focusables.length - 1] : focusables[0]).focus();
        return;
      }

      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + focusables.length) % focusables.length
        : (currentIndex + 1) % focusables.length;

      e.preventDefault();
      focusables[nextIndex].focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      const toRestore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      setTimeout(() => {
        toRestore?.focus?.();
      }, 0);
    };
  }, [onStay]);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'saving' ? 'Saving changes' : 'Save failed'}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative mx-4 w-full max-w-sm rounded-[28px] border border-white/40 bg-white/80 p-6 shadow-glass backdrop-blur-xl"
      >
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
              <Button
                variant="secondary"
                size="md"
                onClick={onStay}
                className="rounded-[18px]"
                data-autofocus="true"
              >
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
            <Button
              variant="secondary"
              size="md"
              onClick={onStay}
              className="rounded-[18px]"
              data-autofocus="true"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
