import React from 'react';
import { Trash2 } from 'lucide-react';

export interface DeleteStepSectionProps {
  isVisible: boolean;
  confirmingDelete: boolean;
  onDeleteClick: () => void;
}

export function DeleteStepSection({
  isVisible,
  confirmingDelete,
  onDeleteClick,
}: DeleteStepSectionProps): JSX.Element | null {
  if (!isVisible) return null;

  return (
    <div className="mt-4 border-t border-white/30 pt-4">
      <button
        onClick={onDeleteClick}
        className={`
          flex w-full items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-xs font-medium transition-all
          ${
            confirmingDelete
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'border border-slate-200/60 bg-white/40 text-slate-500 hover:border-rose-200 hover:bg-rose-50/50 hover:text-rose-600'
          }
        `}
      >
        <Trash2 size={14} />
        <span>{confirmingDelete ? 'Click again to confirm delete' : 'Delete Step'}</span>
      </button>
    </div>
  );
}

