import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../Button';
import { useGuidedWorkflow } from '../../hooks/useGuidedWorkflow';
import type { FocusMode, SceneObject, SimStep } from '../../types';
import type { AssetMetadata, UploadProgress } from '../../types/model';
import type { LatestRecordingEndTransformRefValue } from '../../hooks/editor/useRecordingEndTransform';
import { StepCreationPhase } from './phases/StepCreationPhase';
import { ModelUploadPhase } from './phases/ModelUploadPhase';
import { ModelPositioningPhase, type PositioningScreen } from './phases/ModelPositioningPhase';
import { StepConfigurationPhase } from './phases/StepConfigurationPhase';
import { FinishPhase } from './phases/FinishPhase';

export interface GuidedWorkflowOverlayProps {
  steps: SimStep[];
  onAddStep: (step: Omit<SimStep, 'id'>) => void;
  onUpdateStep: (step: SimStep) => void;
  onDeleteStep: (stepId: string) => void;
  onReorderSteps: (previousOrder: string[], newOrder: string[]) => void;
  objects: SceneObject[];
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: () => void;
  recordingPositionForStepId?: string | null;
  latestRecordingEndPositionRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
  onUploadAsset: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onDeleteObject?: (objectId: string) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onPreviewClick?: () => void;
  onPublishClick?: () => void;
}

export function GuidedWorkflowOverlay({
  steps,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onReorderSteps,
  objects,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  latestRecordingEndPositionRef,
  onUploadAsset,
  uploadProgress,
  recentAssets,
  onAddRecentAsset,
  onDeleteObject,
  onFocusObject,
  onPreviewClick,
  onPublishClick,
}: GuidedWorkflowOverlayProps) {
  const { state, actions, isFirstPhase, isLastPhase } = useGuidedWorkflow();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [positioningScreen, setPositioningScreen] =
    useState<PositioningScreen>('object-selection');

  // --- Phase transition animation state ---
  const TRANSITION_DURATION = 250;
  const [displayedPhase, setDisplayedPhase] = useState(state.currentPhase);
  const [transitionState, setTransitionState] = useState<'idle' | 'exiting' | 'entering'>('idle');
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const isTransitioning = transitionState !== 'idle';

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Detect phase changes and run exit → enter animation
  useEffect(() => {
    if (state.currentPhase === displayedPhase) return;

    // Clear any in-flight transition
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (prefersReducedMotion) {
      setDisplayedPhase(state.currentPhase);
      setTransitionState('idle');
      return;
    }

    // Phase 1: exit animation on current content
    setTransitionState('exiting');

    transitionTimeoutRef.current = setTimeout(() => {
      // Phase 2: swap content (invisible, no CSS transition)
      setDisplayedPhase(state.currentPhase);
      setTransitionState('entering');

      // Phase 3: after browser paints the entering frame, transition to idle (triggers enter animation)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setTransitionState('idle');
          rafRef.current = null;
        });
      });
      transitionTimeoutRef.current = null;
    }, TRANSITION_DURATION);
  }, [state.currentPhase, displayedPhase, prefersReducedMotion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // CSS classes for the phase content panel based on transition state
  const phaseTransitionClasses = (() => {
    const easing = 'ease-[cubic-bezier(0.25,0.8,0.25,1)]';
    switch (transitionState) {
      case 'idle':
        return `transition-[opacity,transform] duration-[250ms] ${easing} opacity-100 translate-y-0`;
      case 'exiting':
        return `transition-[opacity,transform] duration-[250ms] ${easing} opacity-0 -translate-y-2`;
      case 'entering':
        // No transition property — snap to start position instantly before enter animation
        return 'opacity-0 translate-y-2';
      default:
        return 'opacity-100 translate-y-0';
    }
  })();

  // --- Layout and content flags (use displayedPhase to prevent jumps during transition) ---
  const hasUploadedModel = useMemo(
    () => objects.some((object) => object.type === 'mesh'),
    [objects]
  );
  const canContinue = useMemo(() => {
    switch (displayedPhase) {
      case 'step-creation':
        return steps.length > 0;
      case 'model-upload':
        return hasUploadedModel;
      case 'model-positioning':
        return hasUploadedModel;
      default:
        return true;
    }
  }, [displayedPhase, steps.length, hasUploadedModel]);
  const isCentered =
    displayedPhase === 'step-creation' ||
    (displayedPhase === 'model-upload' && !hasUploadedModel) ||
    displayedPhase === 'finish';
  const isStepCreation = displayedPhase === 'step-creation';
  const isModelUpload = displayedPhase === 'model-upload';
  const isModelPositioning = displayedPhase === 'model-positioning';
  const isStepConfiguration = displayedPhase === 'step-configuration';
  const isFinish = displayedPhase === 'finish';
  const shouldShowOverlayNav =
    !isStepCreation &&
    !(isModelUpload && isCentered && isSubmenuOpen) &&
    !isStepConfiguration &&
    !isFinish &&
    (!isModelPositioning || positioningScreen === 'object-selection');
  const continueLabel =
    isModelPositioning && positioningScreen === 'object-selection' ? 'Looks good, continue' : 'Continue';

  const skipPlacementClass = 'bottom-6 right-6';

  const handleSubmenuChange = useCallback((open: boolean) => {
    setIsSubmenuOpen(open);
  }, []);

  useEffect(() => {
    // Prevent stale submenu state when navigating between phases.
    setIsSubmenuOpen(false);
    if (displayedPhase !== 'model-positioning') {
      setPositioningScreen('object-selection');
    }
  }, [displayedPhase]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {/* Skip setup button - persistent throughout all guided phases */}
      <div className={`pointer-events-auto fixed z-[70] ${skipPlacementClass}`}>
        <button
          type="button"
          onClick={actions.exitWorkflow}
          disabled={isTransitioning}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-glass-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/90 hover:text-slate-800 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Skip setup
        </button>
      </div>

      <div
        className={
          isCentered
            ? 'pointer-events-auto flex h-full w-full items-center justify-center px-6 pt-8 pb-16'
            : `pointer-events-auto absolute left-4 ${isStepConfiguration ? 'top-20' : 'top-24'} w-[420px] max-w-[calc(100%-32px)]`
        }
      >
        <div
          className={`${
            isCentered
              ? `w-full ${isFinish ? 'max-w-xl' : 'max-w-3xl'} overflow-hidden rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-glass backdrop-blur-xl`
              : 'w-full overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl'
          } ${phaseTransitionClasses}`}
        >
          <div
            className={
              isCentered
                ? 'space-y-4'
                : isModelPositioning
                  ? 'space-y-4 p-6'
                  : isStepConfiguration
                    ? 'space-y-4 p-6'
                  : isFinish
                    ? 'space-y-4 p-6'
                    : 'max-h-[calc(100vh-240px)] space-y-4 overflow-y-auto p-6 pr-4 custom-scrollbar'
            }
          >
            {isStepCreation ? (
              <StepCreationPhase
                steps={steps}
                onAddStep={onAddStep}
                onUpdateStep={onUpdateStep}
                onDeleteStep={onDeleteStep}
                onReorderSteps={onReorderSteps}
                onContinue={actions.nextPhase}
              />
            ) : isModelUpload ? (
              <ModelUploadPhase
                objects={objects}
                onUploadAsset={onUploadAsset}
                uploadProgress={uploadProgress}
                recentAssets={recentAssets}
                onAddRecentAsset={onAddRecentAsset}
                onDeleteObject={onDeleteObject}
                onFocusObject={onFocusObject}
                onSubmenuChange={handleSubmenuChange}
              />
            ) : isModelPositioning ? (
              <ModelPositioningPhase
                objects={objects}
                selectedObjectId={selectedObjectId ?? null}
                onSelectObject={onSelectObject}
                onUpdateObject={onUpdateObject}
                onFocusObject={onFocusObject}
                onScreenChange={setPositioningScreen}
              />
            ) : isStepConfiguration ? (
              <StepConfigurationPhase
                steps={steps}
                objects={objects}
                selectedObjectId={selectedObjectId ?? null}
                onUpdateStep={onUpdateStep}
                onUpdateObject={onUpdateObject}
                onFocusObject={onFocusObject}
                onStartRecordingPosition={onStartRecordingPosition}
                onStopRecordingPosition={onStopRecordingPosition}
                recordingPositionForStepId={recordingPositionForStepId}
                latestRecordingEndPositionRef={latestRecordingEndPositionRef}
              />
            ) : isFinish ? (
              <FinishPhase onPreviewClick={onPreviewClick} onPublishClick={onPublishClick} />
            ) : null}
          </div>

          {shouldShowOverlayNav && (
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
              <Button
                variant="secondary"
                size="md"
                onClick={actions.previousPhase}
                className="rounded-[20px]"
                disabled={isFirstPhase || isTransitioning}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={actions.nextPhase}
                className="rounded-[20px]"
                disabled={isLastPhase || !canContinue || isTransitioning}
              >
                {continueLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
