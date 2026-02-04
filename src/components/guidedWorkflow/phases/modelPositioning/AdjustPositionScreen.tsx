import { PositioningBackHeader } from './PositioningBackHeader';
import { PositioningHandleCallout } from '../../PositioningHandleCallout';

export interface AdjustPositionScreenProps {
  onBack: () => void;
  onDone: () => void;
  isCalloutOpen: boolean;
  onDismissCallout: () => void;
}

export function AdjustPositionScreen({
  onBack,
  onDone,
  isCalloutOpen,
  onDismissCallout,
}: AdjustPositionScreenProps): JSX.Element {
  return (
    <>
      <PositioningBackHeader
        title="Adjust position"
        subtitle="Drag the on-screen handles to move the model."
        onBack={onBack}
        backButtonLabel="Back to adjustment options"
      />

      <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600 shadow-sm">
        <p className="font-semibold text-slate-700">Position</p>
        <p className="mt-1">Select the model, then drag the handles in the scene.</p>
      </div>

      <PositioningHandleCallout isOpen={isCalloutOpen} onClose={onDismissCallout} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          Done
        </button>
      </div>
    </>
  );
}

