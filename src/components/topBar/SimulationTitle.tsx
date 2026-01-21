import React, { memo, useCallback } from 'react';
import { Pencil } from 'lucide-react';

export interface SimulationTitleProps {
  title: string;
  isEditing: boolean;
  tempTitle: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onTempTitleChange: (value: string) => void;
  onStartEditing: () => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export const SimulationTitle = memo<SimulationTitleProps>(
  ({ title, isEditing, tempTitle, inputRef, onTempTitleChange, onStartEditing, onSave, onKeyDown }) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onTempTitleChange(e.target.value);
      },
      [onTempTitleChange]
    );

    return (
      <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center md:flex">
        {isEditing ? (
          <input
            ref={inputRef}
            value={tempTitle}
            onChange={handleChange}
            onBlur={onSave}
            onKeyDown={onKeyDown}
            className="w-[200px] border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center text-sm font-bold text-slate-800 focus:outline-none"
            aria-label="Simulation title"
          />
        ) : (
          <button
            type="button"
            className="group flex cursor-pointer items-center gap-2 rounded-[20px] px-4 py-1.5 outline-none transition-all hover:bg-black/5 focus:bg-black/5"
            onClick={onStartEditing}
            title="Edit simulation title"
          >
            <span className="max-w-[200px] truncate text-sm font-bold text-slate-700 lg:max-w-[400px]">
              {title}
            </span>
            <div className="rounded-[12px] bg-slate-200/50 p-1 text-slate-400 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
              <Pencil size={12} strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>
    );
  }
);
SimulationTitle.displayName = 'SimulationTitle';

