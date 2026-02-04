import type { SceneObject } from '../../../../types';

export interface ObjectSelectionScreenProps {
  objects: SceneObject[];
  selectedParentId: string | null;
  onSelectObject: (object: SceneObject) => void;
  selectedObjectName: string | null;
  onAdjustSelected: () => void;
}

export function ObjectSelectionScreen({
  objects,
  selectedParentId,
  onSelectObject,
  selectedObjectName,
  onAdjustSelected,
}: ObjectSelectionScreenProps): JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-800">
          Do any models need adjusting?
        </h2>
        <p className="text-sm font-medium text-slate-600">
          Select a model to adjust its position, rotation, or scale.
        </p>
      </div>

      {objects.length === 0 ? (
        <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600 shadow-sm">
          No models in the scene yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {objects.map((object) => {
            const isSelected = selectedParentId === object.id;
            return (
              <button
                key={object.id}
                type="button"
                onClick={() => onSelectObject(object)}
                className={`group flex w-full items-center justify-between gap-4 rounded-[20px] border p-4 text-left shadow-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
                  isSelected
                    ? 'border-blue-400/40 bg-white/80 text-slate-800 shadow-md'
                    : 'border-white/40 bg-white/60 text-slate-600 hover:bg-white/80 hover:text-slate-800'
                }`}
              >
                <span className="flex-1">
                  <span className="text-sm font-semibold">{object.name}</span>
                  <span className="mt-1 block text-xs font-medium text-slate-500">
                    Click to focus in the scene.
                  </span>
                </span>
                {isSelected ? (
                  <span className="rounded-[12px] border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    Selected
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAdjustSelected}
          disabled={!selectedObjectName}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:bg-white/90 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selectedObjectName ? `Adjust ${selectedObjectName}` : 'Select a model to adjust'}
        </button>
      </div>
    </>
  );
}

