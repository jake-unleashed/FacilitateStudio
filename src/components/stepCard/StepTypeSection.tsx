import { RefreshCw } from 'lucide-react';
import type { StepType } from '../../types';
import { STEP_TYPES, type StepTypeConfig } from './constants';
import { HelpIcon } from '../HelpIcon';

export interface StepTypeSectionProps {
  selectedType: StepType | null;
  showTypeSelection: boolean;
  currentStepTypeConfig?: StepTypeConfig;
  isInfoCardSelected: boolean;
  compact?: boolean;
  onChangeStepType: () => void;
  onTypeSelect: (type: StepType) => void;
}

export function StepTypeSection({
  selectedType,
  showTypeSelection,
  currentStepTypeConfig,
  isInfoCardSelected,
  compact = false,
  onChangeStepType,
  onTypeSelect,
}: StepTypeSectionProps): JSX.Element | null {
  const helpContent =
    selectedType === 'identify'
      ? 'Trainees identify and click the correct object in the scene.'
      : isInfoCardSelected
        ? 'Shows a pop-up card with information. Trainees read the content, then click to continue.'
        : 'Trainees move an object to complete this step.';

  // Indicator row
  if (!showTypeSelection && selectedType !== null && currentStepTypeConfig) {
    const Icon = currentStepTypeConfig.icon;
    const isBlue = currentStepTypeConfig.color === 'blue';
    const isEmerald = currentStepTypeConfig.color === 'emerald';
    return (
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`
            flex items-center gap-2 rounded-[12px] border px-3 py-1.5
            ${
              isBlue
                ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-blue-100/40 shadow-sm shadow-blue-500/10'
                : isEmerald
                  ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 shadow-sm shadow-emerald-500/10'
                  : 'border-purple-200/60 bg-gradient-to-br from-purple-50/80 to-purple-100/40 shadow-sm shadow-purple-500/10'
            }
          `}
        >
          <Icon
            size={14}
            className={isBlue ? 'text-blue-600' : isEmerald ? 'text-emerald-600' : 'text-purple-600'}
          />
          <span className="text-xs font-semibold text-slate-700">{currentStepTypeConfig.label}</span>
        </div>

        <HelpIcon content={helpContent} />

        <button
          onClick={onChangeStepType}
          className="flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium text-slate-500 transition-all hover:bg-white/60 hover:text-blue-600"
          title="Change step type"
        >
          <RefreshCw size={12} />
          <span>Change</span>
        </button>
      </div>
    );
  }

  if (!showTypeSelection) return null;

  return (
    <div className="mb-4">
      <label className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Step Type
        <HelpIcon content="Choose what kind of action trainees will take in this step." />
      </label>

      <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
        {STEP_TYPES.map((stepType) => {
          const Icon = stepType.icon;
          const isSelected = selectedType === stepType.type;
          const isBlue = stepType.color === 'blue';
          const isEmerald = stepType.color === 'emerald';

          return (
            <button
              key={stepType.type}
              onClick={() => onTypeSelect(stepType.type)}
              className={`
                group relative ${compact ? 'aspect-[5/6]' : 'aspect-square'} cursor-pointer overflow-hidden rounded-[20px] border backdrop-blur-xl transition-all duration-300 ease-out
                ${
                  isBlue
                    ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/90 via-blue-100/80 to-white/70 shadow-lg shadow-blue-500/15 hover:border-blue-300/70 hover:shadow-xl hover:shadow-blue-500/25'
                    : isEmerald
                      ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-emerald-100/80 to-white/70 shadow-lg shadow-emerald-500/15 hover:border-emerald-300/70 hover:shadow-xl hover:shadow-emerald-500/25'
                      : 'border-purple-200/60 bg-gradient-to-br from-purple-50/90 via-purple-100/80 to-white/70 shadow-lg shadow-purple-500/15 hover:border-purple-300/70 hover:shadow-xl hover:shadow-purple-500/25'
                }
                ${
                  isSelected
                    ? isBlue
                      ? 'border-blue-400/70 shadow-2xl shadow-blue-500/40 ring-2 ring-blue-400/60'
                      : isEmerald
                        ? 'border-emerald-400/70 shadow-2xl shadow-emerald-500/40 ring-2 ring-emerald-400/60'
                        : 'border-purple-400/70 shadow-2xl shadow-purple-500/40 ring-2 ring-purple-400/60'
                    : 'hover:scale-[1.02]'
                }
              `}
            >
              <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 backdrop-blur-sm" />

              <div className="relative flex h-full flex-col items-center justify-center px-6 py-5">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 opacity-100 transition-opacity duration-500 ease-out group-hover:opacity-0">
                  <div
                    className={`flex items-center justify-center ${isBlue ? 'text-blue-600' : isEmerald ? 'text-emerald-600' : 'text-purple-600'}`}
                  >
                    <Icon size={28} strokeWidth={2.5} />
                  </div>
                  <p className="whitespace-nowrap text-xs font-semibold leading-tight text-slate-800">
                    {stepType.label}
                  </p>
                </div>

                <div className="absolute inset-0 flex items-center justify-center px-6 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100">
                  <p className="text-center text-xs font-medium leading-relaxed text-slate-600">
                    {stepType.description}
                  </p>
                </div>

                {isSelected && (
                  <div className="absolute right-3 top-3">
                    <div
                      className={`h-2 w-2 animate-pulse rounded-full shadow-lg ring-2 ${
                        isBlue
                          ? 'bg-blue-600 ring-blue-400/50'
                          : isEmerald
                            ? 'bg-emerald-600 ring-emerald-400/50'
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
  );
}

