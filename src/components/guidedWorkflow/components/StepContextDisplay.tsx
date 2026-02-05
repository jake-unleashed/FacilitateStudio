interface StepContextDisplayProps {
  currentIndex: number;
  totalSteps: number;
  stepTitle: string;
}

export function StepContextDisplay({
  currentIndex,
  totalSteps,
  stepTitle,
}: StepContextDisplayProps): JSX.Element {
  const stepNumber = Math.min(Math.max(currentIndex + 1, 1), Math.max(totalSteps, 1));
  const displayTitle = stepTitle.trim() || 'Untitled Step';

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        <span>
          Step {stepNumber} of {Math.max(totalSteps, 1)}
        </span>
      </div>
      <h2 className="text-base font-semibold text-slate-800">{displayTitle}</h2>
    </div>
  );
}
