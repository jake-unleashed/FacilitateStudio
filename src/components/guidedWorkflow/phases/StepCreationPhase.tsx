import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Check, Copy, Plus, UploadCloud } from 'lucide-react';
import { Button } from '../../Button';
import { Input } from '../../Input';
import type { SimStep } from '../../../types';
import { GuidedSortableStepRow } from './GuidedSortableStepRow';
import { SOPUploadView } from './SOPUploadView';

interface StepCreationPhaseProps {
  steps: SimStep[];
  onAddStep: (step: Omit<SimStep, 'id'>) => void;
  onUpdateStep: (step: SimStep) => void;
  onDeleteStep: (stepId: string) => void;
  onReorderSteps?: (previousOrder: string[], newOrder: string[]) => void;
  /** Optional batch boundary for grouping bulk step changes into one undo entry. */
  onBatchStart?: () => void;
  /** Optional batch boundary for grouping bulk step changes into one undo entry. */
  onBatchEnd?: () => void;
  onContinue?: () => void;
}

/**
 * Guided workflow phase for creating a project’s steps.
 * - Choice view: select SOP upload vs manual creation.
 * - SOP view: upload a document and extract steps via AI.
 * - Manual view: add/edit/delete/reorder steps using editor-like patterns.
 */
export function StepCreationPhase({
  steps,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
  onBatchStart,
  onBatchEnd,
  onContinue,
}: StepCreationPhaseProps): JSX.Element {
  const [mode, setMode] = useState<'choice' | 'sop' | 'manual' | 'reset-confirm'>('choice');
  const [draftTitle, setDraftTitle] = useState('');
  const [stepTitles, setStepTitles] = useState<Record<string, string>>({});
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(false);
  const isClearingStepsRef = useRef(false);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStepTitles((prev) =>
      Object.fromEntries(steps.map((step) => [step.id, prev[step.id] ?? step.title]))
    );
  }, [steps]);

  useEffect(() => {
    // Auto-advance into the step list view when steps already exist (e.g. resume).
    // Avoid fighting explicit navigation when we're intentionally clearing/resetting.
    if (isClearingStepsRef.current) return;
    if (mode === 'choice' && steps.length > 0) {
      setMode('manual');
    }
  }, [mode, steps.length]);

  const canAddStep = draftTitle.trim().length > 0;

  const handleAddStep = useCallback(() => {
    const title = draftTitle.trim();
    if (!title) return;
    // If the list is long, ensure the newly-added step is immediately visible.
    shouldScrollToBottomRef.current = true;
    onAddStep({
      title,
      description: '',
      completed: false,
      type: null,
    });
    setDraftTitle('');
  }, [draftTitle, onAddStep]);

  const handleCommitTitle = useCallback(
    (step: SimStep) => {
      const nextTitle = (stepTitles[step.id] ?? '').trim();
      if (!nextTitle || nextTitle === step.title) {
        setStepTitles((prev) => ({ ...prev, [step.id]: step.title }));
        return;
      }
      onUpdateStep({ ...step, title: nextTitle });
    },
    [onUpdateStep, stepTitles]
  );

  const sortedSteps = useMemo(() => steps, [steps]);
  const stepIds = useMemo(() => steps.map((step) => step.id), [steps]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!onReorderSteps) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = steps.findIndex((step) => step.id === active.id);
      const newIndex = steps.findIndex((step) => step.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const previousOrder = steps.map((step) => step.id);
      const newOrder = arrayMove(previousOrder, oldIndex, newIndex);
      onReorderSteps(previousOrder, newOrder);
    },
    [onReorderSteps, steps]
  );

  useEffect(() => {
    if (!shouldScrollToBottomRef.current) return;
    if (!listContainerRef.current) return;
    shouldScrollToBottomRef.current = false;
    const container = listContainerRef.current;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [steps.length]);

  const isReorderEnabled = !!onReorderSteps;

  const clearCopyResetTimeout = useCallback(() => {
    if (!copyResetTimeoutRef.current) return;
    clearTimeout(copyResetTimeoutRef.current);
    copyResetTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearCopyResetTimeout();
    };
  }, [clearCopyResetTimeout]);

  const handleCopySteps = useCallback(async () => {
    if (sortedSteps.length === 0) return;
    const text = sortedSteps.map((s, i) => `${i + 1}. ${s.title}`).join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without clipboard permissions.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    clearCopyResetTimeout();
    setCopyState('copied');
    copyResetTimeoutRef.current = setTimeout(() => setCopyState('idle'), 1400);
  }, [clearCopyResetTimeout, sortedSteps]);

  const clearAllSteps = useCallback(() => {
    if (steps.length === 0) return;
    isClearingStepsRef.current = true;
    for (const step of steps) {
      onDeleteStep(step.id);
    }
    setDraftTitle('');
    setStepTitles({});
    shouldScrollToBottomRef.current = false;
    // Allow the parent step state to flush before re-enabling auto mode transitions.
    requestAnimationFrame(() => {
      isClearingStepsRef.current = false;
    });
  }, [onDeleteStep, steps]);

  const handleSOPStepsExtracted = useCallback(
    (extractedSteps: string[]) => {
      // Replace any existing step list with the latest SOP extraction.
      // Wrap in a batch so "Undo" treats this as one operation.
      onBatchStart?.();
      try {
        clearAllSteps();
        for (const title of extractedSteps) {
          onAddStep({
            title,
            description: '',
            completed: false,
            type: null,
          });
        }
      } finally {
        onBatchEnd?.();
      }
      setMode('manual');
    },
    [clearAllSteps, onAddStep, onBatchEnd, onBatchStart]
  );

  if (mode === 'reset-confirm') {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Start over?</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            This will remove your current step list so you can upload a new SOP or add steps manually.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-6">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setMode('manual')}
            className="rounded-[20px]"
          >
            Keep steps
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              // Wrap reset in a batch so "Undo" stays clean.
              onBatchStart?.();
              try {
                clearAllSteps();
              } finally {
                onBatchEnd?.();
              }
              setMode('choice');
            }}
            className="rounded-[20px] bg-red-600 shadow-lg shadow-red-500/20 hover:bg-red-500 border border-red-400/20"
          >
            Start over
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'sop') {
    return (
      <SOPUploadView
        onStepsExtracted={handleSOPStepsExtracted}
        onBack={() => setMode('choice')}
      />
    );
  }

  if (mode === 'choice') {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">
            Add steps
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Choose how to create the steps your trainee will follow: upload an SOP or add them manually.
          </p>
        </div>

        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => setMode('sop')}
            className="group flex w-full items-start gap-4 rounded-[20px] border border-blue-400/30 bg-white/70 p-5 text-left shadow-sm transition-all duration-300 hover:bg-white/90 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-blue-600 shadow-sm">
              <UploadCloud size={24} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                Upload an SOP
                <span className="rounded-[12px] border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  Recommended
                </span>
              </span>
              <span className="mt-1 block text-xs font-medium text-slate-500">
                We&apos;ll extract steps automatically
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            className="group flex w-full items-start gap-4 rounded-[20px] border border-white/40 bg-white/60 p-5 text-left shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/60 bg-white/60 text-slate-600 shadow-sm">
              <Plus size={24} />
            </span>
            <span className="flex-1">
              <span className="text-sm font-semibold text-slate-800">Add steps manually</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">
                Create your step list from scratch
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10" aria-hidden="true" />
        <div className="flex-1 text-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Add steps</h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCopySteps}
          disabled={sortedSteps.length === 0}
          aria-label={copyState === 'copied' ? 'Copied' : 'Copy all steps'}
          title={copyState === 'copied' ? 'Copied' : 'Copy all steps'}
          className="rounded-full px-3"
        >
          {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>

      <div
        ref={listContainerRef}
        className="max-h-[36vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar"
      >
        {sortedSteps.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-slate-500">
            Add your first step to continue
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={stepIds} strategy={rectSortingStrategy}>
              <div className="space-y-2">
                {sortedSteps.map((step, index) => (
                  <GuidedSortableStepRow
                    key={step.id}
                    step={step}
                    index={index}
                    title={stepTitles[step.id] ?? step.title}
                    onTitleChange={(value) =>
                      setStepTitles((prev) => ({ ...prev, [step.id]: value }))
                    }
                    onCommitTitle={() => handleCommitTitle(step)}
                    onDelete={() => onDeleteStep(step.id)}
                    isReorderEnabled={isReorderEnabled}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-[20px] border border-white/40 bg-white/50 p-4 shadow-sm">
        <div className="flex-1">
          <Input
            placeholder="e.g. Inspect the workspace"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddStep();
              }
            }}
            aria-label="New step title"
          />
        </div>
        <Button variant="primary" size="md" onClick={handleAddStep} disabled={!canAddStep}>
          Add
        </Button>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-6">
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            if (steps.length === 0) {
              setMode('choice');
              return;
            }
            setMode('reset-confirm');
          }}
          className="rounded-[20px]"
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          className="rounded-[20px]"
          disabled={sortedSteps.length === 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
