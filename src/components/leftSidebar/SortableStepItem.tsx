import React, { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import { CircleDashed, GripVertical } from 'lucide-react';

import type { FocusMode, SceneObject, SimStep } from '../../types';
import { StepCard, type StepCardHandle } from '../StepCard';
import { STEP_TYPE_CONFIGS } from './constants';

export interface SortableStepItemProps {
  step: SimStep;
  stepNumber: number;
  isOpen: boolean;
  onUpdate: (step: SimStep) => void;
  onMinimize: () => void;
  onStepClick: (stepId: string) => void;
  onStepCardHandleChange?: (stepId: string, handle: StepCardHandle | null) => void;
  selectedObjectId?: string | null;
  objects?: SceneObject[];
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecordingPosition: boolean;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onDeleteStep?: (stepId: string) => void;
}

export const SortableStepItem = memo<SortableStepItemProps>(
  ({
    step,
    stepNumber,
    isOpen,
    onUpdate,
    onMinimize,
    onStepClick,
    onStepCardHandleChange,
    selectedObjectId,
    objects,
    onStartRecording,
    onStopRecording,
    isRecordingPosition,
    onFocusObject,
    onDeleteStep,
  }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
      id: step.id,
      disabled: isOpen,
      transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' },
    });

    const style: React.CSSProperties = {
      transform: DndCSS.Transform.toString(transform),
      transition: isDragging ? 'transform 0ms' : 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
      zIndex: isDragging ? 50 : undefined,
      willChange: isDragging ? 'transform' : undefined,
      position: 'relative',
    };

    const stepTypeConfig = useMemo(() => STEP_TYPE_CONFIGS.find((c) => c.type === step.type), [step.type]);

    if (isOpen) {
      return (
        <div className="flex flex-col gap-1" data-step-id={step.id}>
          <span className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Step {stepNumber}</span>
          <div ref={setNodeRef} style={style}>
            <StepCard
              ref={(handle) => onStepCardHandleChange?.(step.id, handle)}
              step={step}
              isOpen={true}
              onUpdate={onUpdate}
              onMinimize={onMinimize}
              selectedObjectId={selectedObjectId}
              objects={objects}
              onStartRecording={onStartRecording}
              onStopRecording={onStopRecording}
              isRecordingPosition={isRecordingPosition}
              onFocusObject={onFocusObject}
              onDelete={onDeleteStep ? () => onDeleteStep(step.id) : undefined}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1" data-step-id={step.id}>
        <span className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Step {stepNumber}</span>

        <div
          ref={setNodeRef}
          style={style}
          className={`
            group relative cursor-pointer rounded-[16px] border shadow-sm backdrop-blur-sm
            ${
              isDragging
                ? 'cursor-grabbing border-blue-300 bg-white shadow-xl ring-2 ring-blue-400/50'
                : 'border-white/50 bg-white/50 hover:bg-white hover:shadow-md'
            }
          `}
        >
          <div className="flex items-start gap-2.5 p-3">
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 opacity-40 transition-all hover:text-slate-500 active:cursor-grabbing group-hover:opacity-100"
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </button>

            <div className="min-w-0 flex-1" onClick={() => onStepClick(step.id)}>
              <p className="text-sm font-medium leading-snug text-slate-700">{step.title || 'Untitled Step'}</p>

              {stepTypeConfig ? (
                <div
                  className={`
                    mt-1.5 flex w-fit items-center gap-1.5 rounded-lg border px-2 py-0.5
                    ${
                      stepTypeConfig.color === 'text-blue-600'
                        ? 'border-blue-200/60 bg-gradient-to-br from-blue-50/60 to-blue-100/30'
                        : 'border-purple-200/60 bg-gradient-to-br from-purple-50/60 to-purple-100/30'
                    }
                  `}
                >
                  <stepTypeConfig.icon size={12} className={stepTypeConfig.color} />
                  <span className="text-xs font-medium text-slate-600">{stepTypeConfig.label}</span>
                </div>
              ) : (
                <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-lg border border-slate-200/60 bg-gradient-to-br from-slate-50/60 to-slate-100/30 px-2 py-0.5">
                  <CircleDashed size={12} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">No Type</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
SortableStepItem.displayName = 'SortableStepItem';

