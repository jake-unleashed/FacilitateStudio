import { useEffect, useRef } from 'react';

interface PublishedTrainingCompleteDialogProps {
  visible: boolean;
  title: string;
  onRestart: () => void;
}

export function PublishedTrainingCompleteDialog({
  visible,
  title,
  onRestart,
}: PublishedTrainingCompleteDialogProps): JSX.Element {
  const restartButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = 'published-training-complete-title';

  useEffect(() => {
    if (visible) {
      restartButtonRef.current?.focus();
    }
  }, [visible]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm transition-opacity duration-500 ease-out ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[20px] border border-white/50 bg-white/95 p-7 text-center shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
              ✓
            </div>
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Complete</p>
          <h2 id={titleId} className="mb-2 text-2xl font-bold tracking-tight text-slate-800">
            {title}
          </h2>
          <p className="mx-auto max-w-sm text-sm font-medium text-slate-600">
            You have completed all steps in this training.
          </p>
          <button
            ref={restartButtonRef}
            onClick={onRestart}
            className="mt-7 rounded-[20px] border border-blue-400/20 bg-blue-600 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}

