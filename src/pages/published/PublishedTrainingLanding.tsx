import { useEffect, useMemo, useRef } from 'react';
import { PublishedSurface } from './PublishedSurface';

interface PublishedTrainingLandingProps {
  title: string;
  canStart: boolean;
  isStarting: boolean;
  onStart: () => void;
}

export function PublishedTrainingLanding({
  title,
  canStart,
  isStarting,
  onStart,
}: PublishedTrainingLandingProps): JSX.Element {
  const startButtonRef = useRef<HTMLButtonElement | null>(null);

  // When loading completes, place focus on the primary action.
  useEffect(() => {
    if (canStart && !isStarting) {
      startButtonRef.current?.focus();
    }
  }, [canStart, isStarting]);

  const buttonLabel = useMemo(() => {
    return canStart ? 'Start' : 'Loading';
  }, [canStart]);

  return (
    <PublishedSurface
      className={`z-40 transition-opacity duration-500 ease-out ${isStarting ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[20px] border border-white/50 bg-white/80 p-7 text-center shadow-glass backdrop-blur-xl sm:p-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Interactive Training</p>
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
          <p className="mx-auto max-w-sm text-sm font-medium text-slate-600">
            Follow the steps at your own pace. Press start when you are ready.
          </p>

          <button
            ref={startButtonRef}
            onClick={onStart}
            disabled={!canStart}
            className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-[20px] border border-blue-400/20 bg-blue-600 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!canStart ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/40 [animation-delay:240ms]" />
              </>
            ) : null}
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
      <div className="pb-5 text-center text-xs font-medium text-slate-400 sm:pb-6">Powered by Facilitate</div>
    </PublishedSurface>
  );
}

