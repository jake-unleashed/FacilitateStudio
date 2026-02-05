import { MonitorPlay, Sparkles } from 'lucide-react';
import { Button } from '../../Button';
import { useGuidedWorkflow } from '../../../hooks/useGuidedWorkflow';

interface FinishPhaseProps {
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
}

/**
 * Final guided workflow screen that prompts preview and publishing.
 */
export function FinishPhase({ onPreviewClick, onPublishClick }: FinishPhaseProps): JSX.Element {
  const { state, actions } = useGuidedWorkflow();
  const hasPreviewed = state.hasPreviewedInFinishPhase;

  return (
    <div className="space-y-6 text-center">
      {!hasPreviewed ? (
        <>
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/70 text-blue-600 shadow-sm">
              <MonitorPlay size={24} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Simulation complete</h2>
              <p className="mt-2 text-sm font-medium text-slate-600">
                You’ve finished creating your simulation. Preview it end to end before entering the editor.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/20 pt-4">
            <Button
              variant="secondary"
              size="md"
              onClick={actions.previousPhase}
              className="rounded-[20px]"
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                actions.markFinishPreviewDone();
                onPreviewClick?.();
              }}
              className="rounded-[20px]"
              disabled={!onPreviewClick}
            >
              Preview
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/70 text-blue-600 shadow-sm">
              <Sparkles size={24} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Ready to share?</h2>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Enter the editor to keep refining, or publish when you’re ready.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/20 pt-4">
            <Button
              variant="secondary"
              size="md"
              onClick={actions.exitWorkflow}
              className="rounded-[20px]"
            >
              Enter editor
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onPublishClick}
              className="rounded-[20px]"
              disabled={!onPublishClick}
            >
              Publish
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
