import { memo } from 'react';
import { Plus } from 'lucide-react';
import type { SimStep } from '../../types';
import { EMPTY_NEW_STEP } from './constants';

export interface InsertStepDividerProps {
  insertIndex: number;
  onInsertStep?: (index: number, step?: Omit<SimStep, 'id'>) => void;
  /**
   * Vertical offset relative to the gap anchor point. Use this to fine-tune
   * centering between two step cards without affecting layout.
   */
  offsetYClassName?: string;
}

export const InsertStepDivider = memo<InsertStepDividerProps>(
  ({ insertIndex, onInsertStep, offsetYClassName = 'top-2' }) => {
    if (!onInsertStep) return null;

    return (
      <div className="relative h-0">
        <div className={`absolute inset-x-0 ${offsetYClassName} group z-10`}>
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-slate-200/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => onInsertStep(insertIndex, EMPTY_NEW_STEP)}
              data-testid={`insert-step-${insertIndex}`}
              className="pointer-events-auto flex h-7 items-center justify-center gap-1 rounded-full border border-slate-200/70 bg-white/60 px-2.5 text-xs font-semibold text-slate-600 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-300/80 hover:bg-white hover:text-blue-600 hover:shadow-md group-hover:opacity-100"
              title={insertIndex === 0 ? 'Insert step at top' : 'Insert step'}
              aria-label={insertIndex === 0 ? 'Insert step at top' : 'Insert step'}
            >
              <Plus size={14} />
              <span className="sr-only">{insertIndex === 0 ? 'Insert step at top' : 'Insert step'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
InsertStepDivider.displayName = 'InsertStepDivider';

