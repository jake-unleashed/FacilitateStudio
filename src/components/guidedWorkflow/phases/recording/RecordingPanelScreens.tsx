import { ArrowLeft, Move3d, Rotate3d, Scaling } from 'lucide-react';

import type { SceneObject } from '../../../../types';
import { RotationSection } from '../../../rightSidebar/RotationSection';
import { ScaleSection } from '../../../rightSidebar/ScaleSection';
import type { RotationAxis } from '../../../rightSidebar/types';

export function TransformTypeScreen({
  onChoosePosition,
  onChooseRotation,
  onChooseScale,
}: {
  onChoosePosition: () => void;
  onChooseRotation: () => void;
  onChooseScale: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">Set the object’s end position, rotation, or scale.</p>

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
              Move the object to its end position.
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
            <span className="mt-1 block text-xs font-medium text-slate-500">Set the object’s end rotation.</span>
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
              Resize the object at its end position.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function SubScreenBackHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/40 bg-white/60 text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/80 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
        aria-label="Back to transform options"
      >
        <ArrowLeft size={16} />
      </button>
      <div className="space-y-1">
        <h3 className="text-base font-bold tracking-tight text-slate-800">{title}</h3>
        <p className="text-sm font-medium text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}

export function PositionSubScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <SubScreenBackHeader title="Position" subtitle="Drag the on-screen handles to move the object." onBack={onBack} />

      <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600 shadow-sm">
        <p>Select the ghost object in the scene, then drag the handles to set the end position.</p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        Done
      </button>
    </div>
  );
}

export function RotationSubScreen({
  ghostObject,
  onBack,
  onRotationChange,
}: {
  ghostObject: SceneObject | null;
  onBack: () => void;
  onRotationChange: (axis: RotationAxis, rotation: number) => void;
}) {
  return (
    <div className="space-y-4">
      <SubScreenBackHeader title="Rotation" subtitle="Set the object's end rotation." onBack={onBack} />

      {ghostObject ? (
        <RotationSection
          rotationX={ghostObject.transform.rotationX}
          rotationY={ghostObject.transform.rotationY}
          rotationZ={ghostObject.transform.rotationZ}
          onRotationChange={onRotationChange}
          onRotationCommit={() => undefined}
        />
      ) : (
        <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600 shadow-sm">
          No target object selected.
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        Done
      </button>
    </div>
  );
}

export function ScaleSubScreen({
  ghostObject,
  onBack,
  onScaleChange,
}: {
  ghostObject: SceneObject | null;
  onBack: () => void;
  onScaleChange: (scale: number) => void;
}) {
  return (
    <div className="space-y-4">
      <SubScreenBackHeader title="Scale" subtitle="Resize the object at its end position." onBack={onBack} />

      {ghostObject ? (
        <ScaleSection
          currentScale={ghostObject.transform.scaleX}
          onScaleChange={onScaleChange}
          onScaleCommit={() => undefined}
        />
      ) : (
        <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600 shadow-sm">
          No target object selected.
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        Done
      </button>
    </div>
  );
}

