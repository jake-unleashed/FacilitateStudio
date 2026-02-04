import { X } from 'lucide-react';
import { Button } from '../Button';
import { useGuidedWorkflow } from '../../hooks/useGuidedWorkflow';
import type { GuidedWorkflowPhase } from '../../types/guidedWorkflow';
import type { SimStep } from '../../types';
import { StepCreationPhase } from './phases/StepCreationPhase';

const phaseDescriptions: Record<GuidedWorkflowPhase, string> = {
  welcome: 'Welcome to guided setup.',
  'step-creation': 'Choose how you want to create steps.',
  'model-upload': 'Upload the 3D models you will use.',
  'model-positioning': 'Place and adjust models in the scene.',
  'step-configuration': 'Assign step types and configure each step.',
  finish: 'Review your setup and move into the editor.',
};

export interface GuidedWorkflowOverlayProps {
  steps: SimStep[];
  onAddStep: (step: Omit<SimStep, 'id'>) => void;
  onUpdateStep: (step: SimStep) => void;
  onDeleteStep: (stepId: string) => void;
  onReorderSteps: (previousOrder: string[], newOrder: string[]) => void;
}

export function GuidedWorkflowOverlay({
  steps,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
}: GuidedWorkflowOverlayProps) {
  const { state, actions, isFirstPhase, isLastPhase } = useGuidedWorkflow();
  const canContinue = state.currentPhase !== 'step-creation' ? true : steps.length > 0;
  const isCentered = state.currentPhase === 'step-creation';
  const isStepCreation = state.currentPhase === 'step-creation';

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {/* Skip setup button - persistent throughout all guided phases */}
      <div className="pointer-events-auto fixed bottom-6 left-6 z-[60]">
        <button
          type="button"
          onClick={actions.exitWorkflow}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-glass-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/90 hover:text-slate-800 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          Skip setup
        </button>
      </div>

      <div
        className={
          isCentered
            ? 'pointer-events-auto flex h-full w-full items-center justify-center px-6 pt-8 pb-16'
            : 'pointer-events-auto absolute right-4 top-24 w-[420px] max-w-[calc(100%-32px)]'
        }
      >
        <div
          className={
            isCentered
              ? 'w-full max-w-3xl rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-glass backdrop-blur-xl'
              : 'w-full rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl'
          }
        >
          {!isStepCreation && (
            <div className="flex items-center justify-between border-b border-white/10 bg-white/10 px-6 py-4 backdrop-blur-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Guided Workflow
                </p>
                <h3 className="mt-1 text-sm font-bold tracking-tight text-slate-800">
                  {phaseDescriptions[state.currentPhase]}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-[12px]"
                onClick={actions.exitWorkflow}
                aria-label="Exit guided workflow"
              >
                <X size={18} />
              </Button>
            </div>
          )}

          <div
            className={
              isStepCreation
                ? 'space-y-4'
                : 'max-h-[calc(100vh-240px)] space-y-4 overflow-y-auto p-6 custom-scrollbar'
            }
          >
            {state.currentPhase === 'step-creation' ? (
              <StepCreationPhase
                steps={steps}
                onAddStep={onAddStep}
                onUpdateStep={onUpdateStep}
                onDeleteStep={onDeleteStep}
                onReorderSteps={onReorderSteps}
                onContinue={actions.nextPhase}
              />
            ) : (
              <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600">
                Placeholder for <span className="font-semibold">{state.currentPhase}</span> phase
                content.
              </div>
            )}
          </div>

          {!isStepCreation && (
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
              <Button
                variant="secondary"
                size="md"
                onClick={actions.previousPhase}
                className="rounded-[20px]"
                disabled={isFirstPhase}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={actions.nextPhase}
                className="rounded-[20px]"
                disabled={isLastPhase || !canContinue}
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
