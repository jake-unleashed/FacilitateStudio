import { Plus } from 'lucide-react';
import type { DragEndEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core';
import { DndContext, closestCenter, MeasuringStrategy } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

import type { FocusMode, SceneObject, SimStep } from '../../types';
import type { StepCardHandle } from '../StepCard';
import { InsertStepDivider } from './InsertStepDivider';
import { SortableStepItem } from './SortableStepItem';

export function StepsPanel({
  steps,
  stepIds,
  sensors,
  onDragEnd,
  onInsertStep,
  openedStepId,
  onUpdateStep,
  onMinimizeStep,
  onStepClick,
  onStepCardHandleChange,
  selectedObjectId,
  objects,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  onFocusObject,
  onDeleteStep,
  onAddStepClick,
}: {
  steps: SimStep[];
  stepIds: string[];
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  onInsertStep?: (index: number, step?: Omit<SimStep, 'id'>) => void;
  openedStepId: string | null;
  onUpdateStep?: (step: SimStep) => void;
  onMinimizeStep: () => void;
  onStepClick: (stepId: string) => void;
  onStepCardHandleChange: (stepId: string, handle: StepCardHandle | null) => void;
  selectedObjectId: string | null;
  objects: SceneObject[];
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: (stepId: string) => void;
  recordingPositionForStepId?: string | null;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onDeleteStep?: (stepId: string) => void;
  onAddStepClick: () => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <SortableContext items={stepIds} strategy={rectSortingStrategy}>
          <div className="relative">
            <InsertStepDivider insertIndex={0} onInsertStep={onInsertStep} offsetYClassName="-top-1" />

            <div className="space-y-4 pt-1">
              {steps.map((step, index) => (
                <div key={step.id}>
                  <SortableStepItem
                    step={step}
                    stepNumber={index + 1}
                    isOpen={step.id === openedStepId}
                    onUpdate={onUpdateStep || (() => {})}
                    onMinimize={onMinimizeStep}
                    onStepClick={onStepClick}
                    onStepCardHandleChange={onStepCardHandleChange}
                    selectedObjectId={selectedObjectId}
                    objects={objects}
                    onStartRecording={onStartRecordingPosition ? () => onStartRecordingPosition(step.id) : undefined}
                    onStopRecording={onStopRecordingPosition ? () => onStopRecordingPosition(step.id) : undefined}
                    isRecordingPosition={recordingPositionForStepId === step.id}
                    onFocusObject={onFocusObject}
                    onDeleteStep={onDeleteStep}
                  />

                  {index < steps.length - 1 && <InsertStepDivider insertIndex={index + 1} onInsertStep={onInsertStep} />}
                </div>
              ))}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={onAddStepClick}
        className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-slate-300 bg-white/20 py-4 text-sm font-medium text-slate-500 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
      >
        <Plus size={18} />
        Add Step
      </button>
    </div>
  );
}

