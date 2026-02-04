import type { SceneObject } from '../../../../types';
import { ScaleSection } from '../../../rightSidebar/ScaleSection';
import { PositioningBackHeader } from './PositioningBackHeader';

export interface AdjustScaleScreenProps {
  selectedObject: SceneObject | null;
  onBack: () => void;
  onDone: () => void;
  onScaleChange: (scale: number) => void;
}

export function AdjustScaleScreen({
  selectedObject,
  onBack,
  onDone,
  onScaleChange,
}: AdjustScaleScreenProps): JSX.Element {
  return (
    <div className="space-y-4">
      <PositioningBackHeader
        title="Adjust scale"
        subtitle="Resize the model to match real-world scale."
        onBack={onBack}
        backButtonLabel="Back to adjustment options"
      />

      {selectedObject ? (
        <ScaleSection
          currentScale={selectedObject.transform.scaleX}
          onScaleChange={onScaleChange}
          onScaleCommit={() => undefined}
        />
      ) : (
        <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600 shadow-sm">
          Select a model first.
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        >
          Done
        </button>
      </div>
    </div>
  );
}

