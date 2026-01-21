import { HelpCircle, RefreshCw } from 'lucide-react';
import type { StepType } from '../../types';
import { STEP_TYPES, type StepTypeConfig } from './constants';

export interface StepTypeSectionProps {
  selectedType: StepType | null;
  showTypeSelection: boolean;
  currentStepTypeConfig?: StepTypeConfig;
  isInfoCardSelected: boolean;
  onChangeStepType: () => void;
  onTypeSelect: (type: StepType) => void;
}

export function StepTypeSection({
  selectedType,
  showTypeSelection,
  currentStepTypeConfig,
  isInfoCardSelected,
  onChangeStepType,
  onTypeSelect,
}: StepTypeSectionProps): JSX.Element | null {
  // Indicator row
  if (!showTypeSelection && selectedType !== null && currentStepTypeConfig) {
    const Icon = currentStepTypeConfig.icon;
    return (
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`
            flex items-center gap-2 rounded-[12px] border px-3 py-1.5
            ${
              currentStepTypeConfig.color === 'blue'
                ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-blue-100/40 shadow-sm shadow-blue-500/10'
                : 'border-purple-200/60 bg-gradient-to-br from-purple-50/80 to-purple-100/40 shadow-sm shadow-purple-500/10'
            }
          `}
        >
          <Icon
            size={14}
            className={currentStepTypeConfig.color === 'blue' ? 'text-blue-600' : 'text-purple-600'}
          />
          <span className="text-xs font-semibold text-slate-700">{currentStepTypeConfig.label}</span>
        </div>

        <span
          title={
            isInfoCardSelected
              ? 'Shows a pop-up card with information to trainees. They read the heading and body text, then click the button to continue.'
              : 'Guides trainees to move an object in the 3D scene.'
          }
        >
          <HelpCircle size={12} className="text-slate-400" />
        </span>

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
        <span title="Choose what kind of step this is. Each type does something different for the trainee.">
          <HelpCircle size={12} className="text-slate-400" />
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        {STEP_TYPES.map((stepType) => {
          const Icon = stepType.icon;
          const isSelected = selectedType === stepType.type;
          const isBlue = stepType.color === 'blue';

          return (
            <button
              key={stepType.type}
              onClick={() => onTypeSelect(stepType.type)}
              className={`
                group relative aspect-square cursor-pointer overflow-hidden rounded-[20px] border backdrop-blur-xl transition-all duration-300 ease-out
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
              <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 backdrop-blur-sm" />

              <div className="relative flex h-full flex-col items-center justify-center px-6 py-5">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 opacity-100 transition-opacity duration-500 ease-out group-hover:opacity-0">
                  <div className={`flex items-center justify-center ${isBlue ? 'text-blue-600' : 'text-purple-600'}`}>
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
                        isBlue ? 'bg-blue-600 ring-blue-400/50' : 'bg-purple-600 ring-purple-400/50'
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

