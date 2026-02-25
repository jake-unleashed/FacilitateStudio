import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SceneObject, SimStep } from '../../types';
import { PreviewInfoCard } from './PreviewInfoCard';
import { PreviewIdentifyFeedback, type IdentifyFeedbackState } from './PreviewIdentifyFeedback';
import { findChildByPathString } from '../../utils/childTransformUtils';
import { STEP_TYPES } from '../stepCard/constants';

interface PreviewStepExecutorProps {
  steps: SimStep[];
  objects: SceneObject[];
  onComplete: () => void;
  /** Optional exit handler. If not provided, no exit button will be shown. */
  onExit?: () => void;
  onSetCurrentPreviewStep?: (step: SimStep | null) => void;
  /** Callback when object is clicked (for move-item / identify steps) */
  onObjectClick?: (objectId: string) => void;
  /** Callback when wrong object is clicked (for identify steps) */
  onWrongObjectClick?: (objectId: string) => void;
  /** Register object click handler for external use */
  onRegisterObjectClickHandler?: (handler: (objectId: string) => void) => void;
  /** Register wrong-object click handler for external use */
  onRegisterWrongObjectClickHandler?: (handler: (objectId: string) => void) => void;
  /** Register step complete handler for external use */
  onRegisterStepCompleteHandler?: (handler: () => void) => void;
}

type StepExecutionState = 'waiting' | 'executing' | 'completed';

const STEP_TRANSITION_DELAY_MS = 300;
const FINAL_STEP_COMPLETE_DELAY_MS = 300;
const IDENTIFY_CORRECT_DELAY_MS = 750;
const IDENTIFY_WRONG_CLEAR_DELAY_MS = 1100;
const PROGRESS_TEXT = 'Progress';
const DEFAULT_STEP_LABELS: Record<string, string> = {
  'move-item': 'Move Item',
  identify: 'Identify',
};

// Progress bar styling constants
const PROGRESS_BAR_CONTAINER_CLASSES =
  'flex w-72 items-center gap-2.5 rounded-[20px] border border-white/40 bg-white/70 px-4 py-2.5 shadow-glass backdrop-blur-xl sm:w-80';
const PROGRESS_TEXT_CLASSES =
  'whitespace-nowrap text-xs font-semibold leading-none tracking-tight text-slate-700';
const PROGRESS_BAR_TRACK_CLASSES =
  'h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/30 ring-1 ring-white/30';
const PROGRESS_BAR_FILL_CLASSES =
  'h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-700 ease-out';

function getStepLabel(step: SimStep): string {
  const title = step.title?.trim();
  return title || DEFAULT_STEP_LABELS[step.type ?? ''] || '';
}

const STEP_TYPE_ACCENT_CLASSES: Record<string, string> = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  purple: 'text-purple-600',
};

/**
 * Manages step-by-step execution during preview mode.
 * Handles transitions between steps and coordinates step completion.
 */
export const PreviewStepExecutor: React.FC<PreviewStepExecutorProps> = ({
  steps,
  objects,
  onComplete,
  onExit,
  onSetCurrentPreviewStep,
  onObjectClick,
  onWrongObjectClick,
  onRegisterObjectClickHandler,
  onRegisterWrongObjectClickHandler,
  onRegisterStepCompleteHandler,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [executionState, setExecutionState] = useState<StepExecutionState>('waiting');
  const [identifyFeedback, setIdentifyFeedback] = useState<IdentifyFeedbackState>(null);

  /**
   * Filters steps to only include valid ones with required type-specific data.
   * Info cards need heading or bodyText.
   * Move-item steps need targetObjectId, startPosition, endPosition, and a matching object.
   */
  const validSteps = useMemo(() => {
    return steps.filter((step) => {
      if (!step.type) return false;

      if (step.type === 'info-card') {
        return !!(step.heading || step.bodyText);
      }

      if (step.type === 'move-item') {
        // For move-item steps, we need a target and an end position.
        // End position/rotation/scale are recorded during the “record end position” workflow.
        // startPosition/rotation/scale are implicit at step start, but are still supported.
        const hasEndTransform = !!step.endPosition || !!step.endRotation || !!step.endScale;
        if (!step.targetObjectId || !hasEndTransform) return false;

        const targetObject = objects.find((obj) => obj.id === step.targetObjectId);
        if (!targetObject) return false;

        if (step.targetChildPath) {
          return !!findChildByPathString(targetObject, step.targetChildPath);
        }

        return true;
      }

      if (step.type === 'identify') {
        if (!step.targetObjectId) return false;
        const targetObject = objects.find((obj) => obj.id === step.targetObjectId);
        if (!targetObject) return false;

        if (step.targetChildPath) {
          return !!findChildByPathString(targetObject, step.targetChildPath);
        }

        return true;
      }

      return false;
    });
  }, [steps, objects]);

  const currentStep = validSteps[currentStepIndex] || null;
  const isLastStep = currentStepIndex >= validSteps.length - 1;
  const currentInfoCardDisplayMode = currentStep?.infoCardDisplayMode || 'overlay';
  const shouldShowStepIndicator =
    currentStep?.type === 'move-item' ||
    currentStep?.type === 'identify' ||
    (currentStep?.type === 'info-card' && currentInfoCardDisplayMode === 'side-panel');

  /**
   * Calculates progress percentage.
   * Only shows 100% when the last step is actually completed.
   * Otherwise, progress is based on completed steps (currentStepIndex represents steps completed).
   */
  const progressPercentage = useMemo(() => {
    if (validSteps.length === 0) return 0;

    // If on last step and it's completed, show 100%
    if (isLastStep && executionState === 'completed') {
      return 100;
    }

    // Progress is based on completed steps
    // currentStepIndex represents the number of steps completed
    return Math.round((currentStepIndex / validSteps.length) * 100);
  }, [currentStepIndex, validSteps.length, isLastStep, executionState]);

  /**
   * Resets execution state when step changes and notifies parent of current step.
   */
  useEffect(() => {
    setExecutionState('waiting');
    setIdentifyFeedback(null);
    onSetCurrentPreviewStep?.(currentStep);
  }, [currentStepIndex, currentStep, onSetCurrentPreviewStep]);

  useEffect(() => {
    if (!identifyFeedback) return;
    if (identifyFeedback === 'correct') return;

    const clearTimeoutId = window.setTimeout(() => {
      setIdentifyFeedback(null);
    }, IDENTIFY_WRONG_CLEAR_DELAY_MS);

    return () => {
      window.clearTimeout(clearTimeoutId);
    };
  }, [identifyFeedback]);

  /**
   * Handles step completion.
   * For move-item steps, transitions immediately to allow camera movement to start.
   * For other steps, applies a small delay for smoother transitions.
   */
  const handleStepComplete = useCallback(() => {
    setExecutionState('completed');

    if (isLastStep) {
      // Final step - complete the preview after a brief delay
      setTimeout(() => {
        onComplete();
      }, FINAL_STEP_COMPLETE_DELAY_MS);
      return;
    }

    // Move to next step
    const nextStepIndex = currentStepIndex + 1;
    const nextStep = validSteps[nextStepIndex];

    if (nextStep?.type === 'move-item' || nextStep?.type === 'identify') {
      // Immediate transition for camera-driven steps to start positioning right away
      setCurrentStepIndex(nextStepIndex);
    } else {
      // Small delay for other transitions
      setTimeout(() => {
        setCurrentStepIndex(nextStepIndex);
      }, STEP_TRANSITION_DELAY_MS);
    }
  }, [isLastStep, onComplete, currentStepIndex, validSteps]);

  /**
   * Handles info card continue button click.
   */
  const handleInfoCardContinue = useCallback(() => {
    if (currentStep?.type === 'info-card') {
      handleStepComplete();
    }
  }, [currentStep, handleStepComplete]);

  /**
   * Handles object click in move-item/identify steps.
   * Only processes clicks when the step is waiting and the clicked object matches the target.
   */
  const handleObjectClick = useCallback(
    (objectId: string) => {
      const isMoveItemStep = currentStep?.type === 'move-item';
      const isIdentifyStep = currentStep?.type === 'identify';
      const isTargetObject = currentStep?.targetObjectId === objectId;
      const isWaiting = executionState === 'waiting';

      if (isMoveItemStep && isTargetObject && isWaiting) {
        setExecutionState('executing');
        onObjectClick?.(objectId);
      }

      if (isIdentifyStep && isTargetObject && isWaiting) {
        setIdentifyFeedback('correct');
        setExecutionState('executing');
        onObjectClick?.(objectId);
        window.setTimeout(() => {
          handleStepComplete();
        }, IDENTIFY_CORRECT_DELAY_MS);
      }
    },
    [currentStep, executionState, onObjectClick, handleStepComplete]
  );

  const handleWrongObjectClick = useCallback(
    (objectId: string) => {
      const isIdentifyStep = currentStep?.type === 'identify';
      const isWaiting = executionState === 'waiting';
      if (!isIdentifyStep || !isWaiting) return;

      setIdentifyFeedback('wrong');
      onWrongObjectClick?.(objectId);
    },
    [currentStep, executionState, onWrongObjectClick]
  );

  /**
   * Registers object click handler with parent component.
   */
  useEffect(() => {
    onRegisterObjectClickHandler?.(handleObjectClick);
  }, [handleObjectClick, onRegisterObjectClickHandler]);

  /**
   * Registers wrong-object click handler with parent component.
   */
  useEffect(() => {
    onRegisterWrongObjectClickHandler?.(handleWrongObjectClick);
  }, [handleWrongObjectClick, onRegisterWrongObjectClickHandler]);

  /**
   * Registers step complete handler with parent component.
   */
  useEffect(() => {
    onRegisterStepCompleteHandler?.(handleStepComplete);
  }, [handleStepComplete, onRegisterStepCompleteHandler]);

  /**
   * Handles keyboard navigation.
   * Escape: Exit preview (if onExit is provided)
   * Enter: Continue info card (only when waiting)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onExit) {
        onExit();
        return;
      }

      if (e.key === 'Enter') {
        const isInfoCard = currentStep?.type === 'info-card';
        const isWaiting = executionState === 'waiting';
        if (isInfoCard && isWaiting) {
          handleInfoCardContinue();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, executionState, handleInfoCardContinue, onExit]);

  /**
   * Render empty state when no valid steps are available.
   */
  if (validSteps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="rounded-[20px] border border-slate-300/60 bg-white/95 px-6 py-5 shadow-2xl">
          <p className="text-sm text-slate-700">No valid steps to preview.</p>
          {onExit && (
            <button
              onClick={onExit}
              className="mt-4 rounded-[12px] bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-600"
            >
              Exit Preview
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Step name indicator for interactive steps and side-panel info cards */}
      {shouldShowStepIndicator && (
        <div className="fixed left-1/2 top-4 z-40 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-[16px] border border-white/50 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-800 shadow-xl backdrop-blur-xl">
            {(() => {
              const stepTypeConfig = STEP_TYPES.find((st) => st.type === currentStep.type);
              if (!stepTypeConfig) return null;

              const Icon = stepTypeConfig.icon;
              const accentClass = STEP_TYPE_ACCENT_CLASSES[stepTypeConfig.color] ?? 'text-slate-600';
              return (
                <>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${accentClass}`}
                  >
                    <Icon size={13} />
                    <span>{stepTypeConfig.label}</span>
                  </div>
                  <div className="h-5 w-px bg-slate-300/70" />
                </>
              );
            })()}
            <span>{getStepLabel(currentStep)}</span>
          </div>
        </div>
      )}

      {/* Exit button - only show if onExit is provided */}
      {onExit && (
        <button
          onClick={onExit}
          className="fixed left-4 top-4 z-[60] flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-sm transition-all hover:bg-white/90"
          title="Exit Preview (Esc)"
        >
          <span>Exit</span>
        </button>
      )}

      {/* Progress bar at bottom - unified container with liquid glass styling */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
        <div className={PROGRESS_BAR_CONTAINER_CLASSES}>
          {/* Progress label */}
          <span className={PROGRESS_TEXT_CLASSES}>{PROGRESS_TEXT}</span>

          {/* Progress bar */}
          <div className={PROGRESS_BAR_TRACK_CLASSES}>
            <div
              className={PROGRESS_BAR_FILL_CLASSES}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Percentage */}
          <span className={`${PROGRESS_TEXT_CLASSES} tabular-nums`}>{progressPercentage}%</span>
        </div>
      </div>

      {/* Info Card Step */}
      {currentStep?.type === 'info-card' && (
        <PreviewInfoCard
          step={currentStep}
          displayMode={currentInfoCardDisplayMode}
          onContinue={handleInfoCardContinue}
        />
      )}

      {currentStep?.type === 'identify' && <PreviewIdentifyFeedback state={identifyFeedback} />}

      {/* Move Item Step - PreviewMoveItemStep is rendered inside Canvas by MainCanvas */}
      {/* This component just coordinates the execution state */}
    </>
  );
};
