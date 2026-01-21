import React from 'react';
import { Box } from 'lucide-react';
import type { FocusMode, SceneObject } from '../../types';
import { HierarchyItem } from './HierarchyItem';

export function ObjectsPanel({
  objects,
  selectedObjectId,
  onSelectObject,
  onFocusObject,
  onSwitchToAddPanel,
}: {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onSwitchToAddPanel: () => void;
}): JSX.Element {
  if (objects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/30 px-6 py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Box size={24} />
        </div>
        <p className="text-sm font-medium text-slate-500">No objects in scene</p>
        <p className="mt-1 text-xs text-slate-400">
          Add objects from{' '}
          <button
            onClick={onSwitchToAddPanel}
            className="font-semibold text-blue-500 underline decoration-blue-300 underline-offset-2 transition-colors hover:text-blue-600"
          >
            Add New
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {objects.map((obj) => (
        <HierarchyItem
          key={obj.id}
          obj={obj}
          selectedObjectId={selectedObjectId}
          onSelectObject={onSelectObject}
          onFocusObject={onFocusObject}
        />
      ))}
    </div>
  );
}

