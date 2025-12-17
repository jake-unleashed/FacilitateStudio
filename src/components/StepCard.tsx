import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Info, MoveRight } from 'lucide-react';
import { StepType } from '../types';

interface StepCardProps {
  stepName: string;
  onStepNameChange: (name: string) => void;
  onTypeSelect: (type: StepType) => void;
}

interface StepTypeConfig {
  type: 'info-card' | 'move-item';
  label: string;
  description: string;
  icon: React.ElementType;
  color: 'blue' | 'purple';
}

const STEP_TYPES: StepTypeConfig[] = [
  {
    type: 'info-card',
    label: 'Info Card',
    description: 'Display information to the trainee',
    icon: Info,
    color: 'blue',
  },
  {
    type: 'move-item',
    label: 'Move Item',
    description: 'Guide trainee to move an object',
    icon: MoveRight,
    color: 'purple',
  },
];

// Constants for textarea auto-resize
const TEXTAREA_CONFIG = {
  MAX_LINES: 3,
  LINE_HEIGHT: 22.75, // text-sm (14px) * leading-relaxed (~1.625)
  PADDING: 20, // py-2.5 (10px top + 10px bottom)
  MAX_HEIGHT: 88, // 3 * LINE_HEIGHT + PADDING
} as const;

export const StepCard: React.FC<StepCardProps> = ({ stepName, onStepNameChange, onTypeSelect }) => {
  const [selectedType, setSelectedType] = useState<StepType>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTypeSelect = useCallback(
    (type: StepType) => {
      setSelectedType(type);
      onTypeSelect(type);
    },
    [onTypeSelect]
  );

  // Auto-resize textarea based on content (max 3 lines)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, TEXTAREA_CONFIG.MAX_HEIGHT);

    // Set height to scrollHeight but cap at max height
    textarea.style.height = `${newHeight}px`;

    // Only show scrollbar if content exceeds max height
    textarea.style.overflowY = scrollHeight > TEXTAREA_CONFIG.MAX_HEIGHT ? 'auto' : 'hidden';
  }, [stepName]);

  return (
    <div className="rounded-[20px] border border-white/50 bg-white/50 p-5 shadow-sm backdrop-blur-sm">
      {/* Step Name Input */}
      <div className="mb-5">
        <label
          htmlFor="step-name-input"
          className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          Step Name
        </label>
        <textarea
          id="step-name-input"
          ref={textareaRef}
          value={stepName}
          onChange={(e) => onStepNameChange(e.target.value)}
          placeholder="Enter step name..."
          maxLength={200}
          rows={1}
          className="w-full resize-none rounded-[12px] border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium leading-relaxed text-slate-800 placeholder-slate-400 transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          autoFocus
        />
      </div>

      {/* Step Type Selection */}
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-slate-500">
          Step Type
        </label>
        <div className="grid grid-cols-2 gap-4">
          {STEP_TYPES.map((stepType) => {
            const Icon = stepType.icon;
            const isSelected = selectedType === stepType.type;
            const isBlue = stepType.color === 'blue';

            return (
              <button
                key={stepType.type}
                onClick={() => handleTypeSelect(stepType.type)}
                className={`
                  group relative aspect-square cursor-pointer overflow-hidden rounded-[24px] border backdrop-blur-xl transition-all duration-300 ease-out
                  ${
                    isBlue
                      ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/90 via-blue-100/80 to-white/70 shadow-lg shadow-blue-500/15 hover:border-blue-300/70 hover:shadow-xl hover:shadow-blue-500/25'
                      : 'border-purple-200/60 bg-gradient-to-br from-purple-50/90 via-purple-100/80 to-white/70 shadow-lg shadow-purple-500/15 hover:border-purple-300/70 hover:shadow-xl hover:shadow-purple-500/25'
                  }
                  ${
                    isSelected
                      ? isBlue
                        ? 'border-blue-400/70 shadow-2xl shadow-blue-500/40 ring-2 ring-blue-400/60'
                        : 'border-purple-400/70 shadow-2xl shadow-purple-500/40 ring-2 ring-purple-400/60'
                      : 'hover:scale-[1.02]'
                  }
                `}
              >
                {/* Premium frosted glass overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 backdrop-blur-sm" />

                {/* Content Container */}
                <div className="relative flex h-full flex-col items-center justify-center px-6 py-5">
                  {/* Icon and Heading - visible by default, fade out on hover */}
                  <div
                    className={`absolute inset-0 flex flex-col items-center justify-center gap-2.5 transition-opacity duration-500 ease-out ${
                      isSelected ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex items-center justify-center ${
                        isBlue ? 'text-blue-600' : 'text-purple-600'
                      }`}
                    >
                      <Icon size={32} strokeWidth={2.5} />
                    </div>

                    {/* Title - single line, no wrap */}
                    <p className="whitespace-nowrap text-xs font-semibold leading-tight text-slate-800">
                      {stepType.label}
                    </p>
                  </div>

                  {/* Description - hidden by default, fades in on hover */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center px-6 transition-opacity duration-500 ease-out ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <p className="text-center text-[11px] font-medium leading-relaxed text-slate-600">
                      {stepType.description}
                    </p>
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute right-4 top-4">
                      <div
                        className={`h-2.5 w-2.5 animate-pulse rounded-full shadow-lg ring-2 ${
                          isBlue
                            ? 'bg-blue-600 ring-blue-400/50'
                            : 'bg-purple-600 ring-purple-400/50'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
