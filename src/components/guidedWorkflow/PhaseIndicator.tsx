import type { GuidedWorkflowPhase } from '../../types/guidedWorkflow';

const phases: GuidedWorkflowPhase[] = [
  'welcome',
  'step-creation',
  'model-upload',
  'model-positioning',
  'step-configuration',
  'finish',
];

interface PhaseIndicatorProps {
  currentPhase: GuidedWorkflowPhase;
}

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const activeIndexRaw = phases.findIndex((phase) => phase === currentPhase);
  const activeIndex = activeIndexRaw >= 0 ? activeIndexRaw : 0;
  const total = phases.length;
  const now = activeIndex + 1;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div
        className="rounded-[20px] border border-white/40 bg-white/60 px-4 py-2 shadow-glass-sm backdrop-blur-xl"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={now}
      >
        <span className="sr-only">
          Step {now} of {total}
        </span>

        <div className="flex items-center gap-2">
          {phases.map((phase, index) => {
            const isActive = phase === currentPhase;
            const isComplete = index < activeIndex;
            const isUpcoming = index > activeIndex;

            return (
              <div key={phase} className="flex items-center">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-blue-600 ring-4 ring-blue-500/15'
                      : isComplete
                        ? 'bg-blue-500'
                        : 'bg-slate-300'
                  } ${isUpcoming ? 'opacity-50' : ''}`}
                />
                {index < phases.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`mx-2 h-0.5 w-6 rounded-full ${
                      index < activeIndex ? 'bg-blue-500/60' : 'bg-slate-300/60'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
