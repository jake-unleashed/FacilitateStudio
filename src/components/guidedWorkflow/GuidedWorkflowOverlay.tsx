import { X } from 'lucide-react';
import { Button } from '../Button';
import { useGuidedWorkflow } from '../../hooks/useGuidedWorkflow';
import type { GuidedWorkflowPhase } from '../../types/guidedWorkflow';

const phaseDescriptions: Record<GuidedWorkflowPhase, string> = {
  welcome: 'Welcome to guided setup.',
  'step-creation': 'Create or upload your steps to begin.',
  'model-upload': 'Upload the 3D models you will use.',
  'model-positioning': 'Place and adjust models in the scene.',
  'step-configuration': 'Assign step types and configure each step.',
  finish: 'Review your setup and move into the editor.',
};

export function GuidedWorkflowOverlay() {
  const { state, actions, isFirstPhase, isLastPhase } = useGuidedWorkflow();

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="pointer-events-auto absolute right-4 top-24 w-[420px] max-w-[calc(100%-32px)] rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl">
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

        <div className="space-y-4 p-5">
          <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600">
            Placeholder for <span className="font-semibold">{state.currentPhase}</span> phase
            content.
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
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
            disabled={isLastPhase}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
