import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export type IdentifyFeedbackState = 'correct' | 'wrong' | null;

interface PreviewIdentifyFeedbackProps {
  state: IdentifyFeedbackState;
}

export const PreviewIdentifyFeedback: React.FC<PreviewIdentifyFeedbackProps> = ({ state }) => {
  if (!state) return null;

  const isCorrect = state === 'correct';
  const Icon = isCorrect ? CheckCircle2 : XCircle;

  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[70] -translate-x-1/2">
      <div
        className={`animate-in fade-in zoom-in-95 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-xl duration-200 ${
          isCorrect
            ? 'border-emerald-200/70 bg-emerald-50/85 text-emerald-700'
            : 'border-rose-200/70 bg-rose-50/85 text-rose-700'
        }`}
      >
        <Icon size={14} />
        <span>{isCorrect ? 'Correct! Great job.' : 'Not quite right. Try again.'}</span>
      </div>
    </div>
  );
};
