interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  message = 'Preparing your workspace...',
  fullScreen = true,
}: LoadingScreenProps): JSX.Element {
  return (
    <div
      className={`${fullScreen ? 'min-h-screen' : 'min-h-[220px]'} relative flex w-full items-center justify-center overflow-hidden bg-slate-100`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#e2e8f0_50%,_#cbd5e1_100%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Facilitate Studio
        </div>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <p className="text-sm font-medium text-slate-500">{message}</p>
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400/80 [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400/60 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
