import type { SceneObject } from '../../../../types';
import { RotationSection } from '../../../rightSidebar/RotationSection';
import type { RotationAxis } from '../../../rightSidebar/types';
import { PositioningBackHeader } from './PositioningBackHeader';

export interface AdjustRotationScreenProps {
  selectedObject: SceneObject | null;
  onBack: () => void;
  onDone: () => void;
  onRotationChange: (axis: RotationAxis, rotation: number) => void;
}

export function AdjustRotationScreen({
  selectedObject,
  onBack,
  onDone,
  onRotationChange,
}: AdjustRotationScreenProps): JSX.Element {
  return (
    <div className="space-y-4">
      <PositioningBackHeader
        title="Adjust rotation"
        subtitle="Rotate the model until it faces the right direction."
        onBack={onBack}
        backButtonLabel="Back to adjustment options"
      />

      {selectedObject ? (
        <RotationSection
          rotationX={selectedObject.transform.rotationX}
          rotationY={selectedObject.transform.rotationY}
          rotationZ={selectedObject.transform.rotationZ}
          onRotationChange={onRotationChange}
          onRotationCommit={() => undefined}
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

