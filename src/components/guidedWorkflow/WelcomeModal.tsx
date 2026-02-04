import { useEffect, useRef } from 'react';
import { Sparkles, PencilRuler } from 'lucide-react';

export interface WelcomeModalProps {
  isOpen: boolean;
  onSelectGuided: () => void;
  onSelectEditor: () => void;
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

export function WelcomeModal({
  isOpen,
  onSelectGuided,
  onSelectEditor,
}: WelcomeModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = setTimeout(() => {
      const dialog = dialogRef.current;
      const focusables = dialog ? getFocusableElements(dialog) : [];
      focusables[0]?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSelectEditor();
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
  }, [isOpen, onSelectEditor]);

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      aria-describedby="welcome-modal-description"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-sm"
        aria-label="Close guided setup modal"
        onClick={onSelectEditor}
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        className="relative mx-4 w-full max-w-xl rounded-[32px] border border-white/40 bg-white/80 p-6 shadow-glass backdrop-blur-xl"
      >
        <div className="text-center">
          <h2 id="welcome-modal-title" className="text-lg font-bold tracking-tight text-slate-800">
            Create Your Simulation
          </h2>
          <p
            id="welcome-modal-description"
            className="mt-2 text-sm font-medium text-slate-600"
          >
            Create immersive training experiences with guided setup or jump straight into the
            editor.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <button
            type="button"
            onClick={onSelectGuided}
            className="group flex w-full items-start gap-4 rounded-[20px] border border-blue-400/30 bg-white/70 p-4 text-left shadow-sm transition-all duration-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-blue-600 shadow-sm">
              <Sparkles size={20} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                Guided Setup
                <span className="rounded-[12px] border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  Recommended
                </span>
              </span>
              <span className="mt-1 block text-xs font-medium text-slate-500">
                Follow a step-by-step process to build your simulation.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectEditor}
            className="group flex w-full items-start gap-4 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-slate-600 shadow-sm">
              <PencilRuler size={20} />
            </span>
            <span className="flex-1">
              <span className="text-sm font-semibold text-slate-800">Start from Scratch</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">
                Jump straight into the editor if you already know the workflow.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
