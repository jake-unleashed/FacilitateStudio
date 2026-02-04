import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';

import type { SimStep } from '../../../types';

export interface GuidedSortableStepRowProps {
  step: SimStep;
  index: number;
  title: string;
  onTitleChange: (value: string) => void;
  onCommitTitle: () => void;
  onDelete: () => void;
  isReorderEnabled: boolean;
}

/**
 * Minimal sortable step row for Guided Workflow.
 * Mirrors the editor Steps panel interaction (drag handle + inline editing),
 * but remains usable even when reordering is disabled.
 */
export function GuidedSortableStepRow({
  step,
  index,
  title,
  onTitleChange,
  onCommitTitle,
  onDelete,
  isReorderEnabled,
}: GuidedSortableStepRowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' },
    disabled: !isReorderEnabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? 'transform 0ms'
      : transition ?? 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: isDragging ? 50 : undefined,
    willChange: isDragging ? 'transform' : undefined,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-[16px] border shadow-sm backdrop-blur-sm
        ${
          isDragging
            ? 'cursor-grabbing border-blue-300 bg-white shadow-xl ring-2 ring-blue-400/50'
            : 'border-white/50 bg-white/50 hover:bg-white hover:shadow-md'
        }
      `}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={!isReorderEnabled}
          className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 opacity-40 transition-all hover:text-slate-500 disabled:cursor-default disabled:opacity-20 active:cursor-grabbing group-hover:opacity-100"
          title="Drag to reorder"
          aria-label={`Drag to reorder step ${index + 1}`}
        >
          <GripVertical size={14} />
        </button>

        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
          {index + 1}
        </span>

        <input
          type="text"
          aria-label={`Step ${index + 1} title`}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={onCommitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommitTitle();
              event.currentTarget.blur();
            }
          }}
          className="flex-1 border-none bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete step ${index + 1}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

