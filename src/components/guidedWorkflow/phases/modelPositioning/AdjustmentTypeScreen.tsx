import { Move3d, Rotate3d, Scaling } from 'lucide-react';
import { PositioningBackHeader } from './PositioningBackHeader';

export interface AdjustmentTypeScreenProps {
  selectedObjectName: string | null;
  onBack: () => void;
  onChooseDifferentModel: () => void;
  onChoosePosition: () => void;
  onChooseRotation: () => void;
  onChooseScale: () => void;
}

export function AdjustmentTypeScreen({
  selectedObjectName,
  onBack,
  onChooseDifferentModel,
  onChoosePosition,
  onChooseRotation,
  onChooseScale,
}: AdjustmentTypeScreenProps): JSX.Element {
  return (
    <>
      <PositioningBackHeader
        title="What needs adjusting?"
        subtitle={selectedObjectName ? `Adjusting ${selectedObjectName}.` : 'Pick a model to continue.'}
        onBack={onBack}
        backButtonLabel="Back to model selection"
      />

      <div className="grid gap-3">
        <button
          type="button"
          onClick={onChoosePosition}
          className="group flex w-full items-center gap-4 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/80 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-slate-600 shadow-sm">
            <Move3d size={20} />
          </span>
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-800">Position</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              Move the model into place.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onChooseRotation}
          className="group flex w-full items-center gap-4 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/80 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-slate-600 shadow-sm">
            <Rotate3d size={20} />
          </span>
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-800">Rotation</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              Turn the model to face the right way.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onChooseScale}
          className="group flex w-full items-center gap-4 rounded-[20px] border border-white/40 bg-white/60 p-4 text-left text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/80 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-slate-600 shadow-sm">
            <Scaling size={20} />
          </span>
          <span className="flex-1">
            <span className="text-sm font-semibold text-slate-800">Scale</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              Resize the model for real-world scale.
            </span>
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onChooseDifferentModel}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          Choose a different model
        </button>
      </div>
    </>
  );
}

