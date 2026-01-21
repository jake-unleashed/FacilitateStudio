import React from 'react';
import { ChevronUp } from 'lucide-react';

export interface StepCardHeaderProps {
  stepId: string;
  stepName: string;
  stepNameTextareaRef: React.RefObject<HTMLTextAreaElement>;
  onStepNameChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onStepNameBlur: (value: string) => void;
  onMinimize: () => void;
}

export function StepCardHeader({
  stepId,
  stepName,
  stepNameTextareaRef,
  onStepNameChange,
  onStepNameBlur,
  onMinimize,
}: StepCardHeaderProps): JSX.Element {
  return (
    <div className="mb-4 flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <textarea
          id={`step-name-input-${stepId}`}
          ref={stepNameTextareaRef}
          value={stepName}
          onChange={onStepNameChange}
          onBlur={(e) => onStepNameBlur(e.currentTarget.value)}
          placeholder="Enter step name..."
          maxLength={200}
          rows={1}
          className="w-full resize-none border-0 bg-transparent p-0 text-sm font-medium leading-snug text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-0"
        />
      </div>
      <button
        onClick={onMinimize}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-600"
        title="Minimize step"
      >
        <ChevronUp size={16} />
      </button>
    </div>
  );
}

