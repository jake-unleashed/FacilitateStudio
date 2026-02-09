import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../Button';
import { useGuidedWorkflow } from '../../../hooks/useGuidedWorkflow';
import { useStepCardController } from '../../stepCard/StepCardController';
import { StepTypeSection } from '../../stepCard/StepTypeSection';
import { InfoCardSection } from '../../stepCard/InfoCardSection';
import { MoveItemSection } from '../../stepCard/MoveItemSection';
import type { FocusMode, SceneObject, SimStep, StepType } from '../../../types';
import { StepContextDisplay } from '../components/StepContextDisplay';
import { RecordingPanel } from './RecordingPanel';
import { MinusCircle } from 'lucide-react';
import type { LatestRecordingEndTransformRefValue } from '../../../hooks/editor/useRecordingEndTransform';

interface StepConfigurationPhaseProps {
  steps: SimStep[];
  objects: SceneObject[];
  selectedObjectId?: string | null;
  onUpdateStep: (step: SimStep) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: () => void;
  recordingPositionForStepId?: string | null;
  latestRecordingEndPositionRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
}

export function StepConfigurationPhase({
  steps,
  objects,
  selectedObjectId,
  onUpdateStep,
  onUpdateObject,
  onFocusObject,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  latestRecordingEndPositionRef,
}: StepConfigurationPhaseProps): JSX.Element {
  const { state, actions } = useGuidedWorkflow();
  const totalSteps = steps.length;

  const [isIntroVisible, setIsIntroVisible] = useState(state.stepSetupEntryMode !== 'resume');
  const [currentSubScreen, setCurrentSubScreen] = useState<'type' | 'settings'>(
    state.stepSetupEntryMode === 'resume' ? state.stepSetupResume?.subScreen ?? 'settings' : 'type'
  );

  const hasAppliedResumeRef = useRef(false);
  useEffect(() => {
    if (hasAppliedResumeRef.current) return;
    if (state.stepSetupEntryMode !== 'resume' || !state.stepSetupResume) return;
    hasAppliedResumeRef.current = true;
    actions.setCurrentStepIndex(state.stepSetupResume.stepIndex);
    setCurrentSubScreen(state.stepSetupResume.subScreen);
    setIsIntroVisible(false);
  }, [actions, state.stepSetupEntryMode, state.stepSetupResume]);

  const clampedIndex = useMemo(() => {
    if (totalSteps === 0) return 0;
    return Math.min(Math.max(state.currentStepIndex, 0), totalSteps - 1);
  }, [state.currentStepIndex, totalSteps]);

  useEffect(() => {
    if (state.currentStepIndex !== clampedIndex) {
      actions.setCurrentStepIndex(clampedIndex);
    }
  }, [actions, clampedIndex, state.currentStepIndex]);

  const currentStep = steps[clampedIndex];
  const isLastStep = clampedIndex >= totalSteps - 1;

  if (!currentStep) {
    return (
      <div className="space-y-5 text-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">No steps yet</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Add at least one step to configure your simulation.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={actions.previousPhase} className="rounded-[20px]">
          Back
        </Button>
      </div>
    );
  }

  if (isIntroVisible) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-800">Set up your steps</h2>
          <p className="text-sm font-medium text-slate-600">
            Next, you’ll choose what the trainee will do in each step. We’ll go step by step.
          </p>
        </div>

        <div className="rounded-[20px] border border-white/40 bg-white/50 p-4">
          <p className="text-sm font-medium text-slate-700">
            You can always change these settings later.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/20 pt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={actions.previousPhase}
            className="rounded-[20px]"
          >
            Back
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              actions.markStepSetupIntroSeen();
              actions.setCurrentStepIndex(0);
              setCurrentSubScreen('type');
              setIsIntroVisible(false);
            }}
            className="rounded-[20px]"
          >
            Start step 1
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StepSetupStep
      key={currentStep.id}
      step={currentStep}
      stepIndex={clampedIndex}
      totalSteps={totalSteps}
      isLastStep={isLastStep}
      objects={objects}
      selectedObjectId={selectedObjectId}
      onUpdateStep={onUpdateStep}
      onUpdateObject={onUpdateObject}
      onFocusObject={onFocusObject}
      onStartRecordingPosition={onStartRecordingPosition}
      onStopRecordingPosition={onStopRecordingPosition}
      recordingPositionForStepId={recordingPositionForStepId}
      latestRecordingEndPositionRef={latestRecordingEndPositionRef}
      onRequestShowIntro={() => setIsIntroVisible(true)}
      currentSubScreen={currentSubScreen}
      onSetCurrentSubScreen={setCurrentSubScreen}
    />
  );
}

function StepSetupStep({
  step,
  stepIndex,
  totalSteps,
  isLastStep,
  objects,
  selectedObjectId,
  onUpdateStep,
  onUpdateObject,
  onFocusObject,
  onStartRecordingPosition,
  onStopRecordingPosition,
  recordingPositionForStepId,
  latestRecordingEndPositionRef,
  onRequestShowIntro,
  currentSubScreen,
  onSetCurrentSubScreen,
}: {
  step: SimStep;
  stepIndex: number;
  totalSteps: number;
  isLastStep: boolean;
  objects: SceneObject[];
  selectedObjectId?: string | null;
  onUpdateStep: (step: SimStep) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
  onStartRecordingPosition?: (stepId: string) => void;
  onStopRecordingPosition?: () => void;
  recordingPositionForStepId?: string | null;
  latestRecordingEndPositionRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
  onRequestShowIntro: () => void;
  currentSubScreen: 'type' | 'settings';
  onSetCurrentSubScreen: (screen: 'type' | 'settings') => void;
}): JSX.Element {
  const { state, actions } = useGuidedWorkflow();

  const handleFocusObject = useCallback(
    (object: SceneObject) => {
      onFocusObject?.(object, undefined, 'full');
    },
    [onFocusObject]
  );

  const handleUpdateStepGuided = useCallback(
    (updated: SimStep) => {
      if (updated.type !== 'info-card') {
        onUpdateStep(updated);
        return;
      }

      const bodySource = (updated.description || '').trim() || (updated.title || '').trim();
      const enhanced: SimStep = {
        ...updated,
        heading: updated.heading ?? 'Step info',
        bodyText: updated.bodyText ?? bodySource,
        buttonText: updated.buttonText ?? 'OK',
      };
      onUpdateStep(enhanced);
    },
    [onUpdateStep]
  );

  const controller = useStepCardController({
    step,
    isOpen: true,
    onUpdate: handleUpdateStepGuided,
    selectedObjectId,
    objects,
    onStartRecording: onStartRecordingPosition ? () => onStartRecordingPosition(step.id) : undefined,
    onStopRecording: onStopRecordingPosition,
    isRecordingPosition: recordingPositionForStepId === step.id,
    onFocusObject: handleFocusObject,
  });

  const effectiveSubScreen: 'type' | 'settings' = controller.selectedType ? currentSubScreen : 'type';
  const isChooserScreen = effectiveSubScreen === 'type';
  const isConfigScreen = effectiveSubScreen === 'settings' && controller.selectedType !== null;

  const [chooserSelection, setChooserSelection] = useState<StepType | 'blank' | null>(
    controller.selectedType ?? null
  );

  useEffect(() => {
    if (!isChooserScreen) return;
    // If a step already has a type, show that as selected. If it has no type, show nothing selected.
    if (controller.selectedType !== null) {
      setChooserSelection(controller.selectedType);
      return;
    }
    const shouldRestoreBlank = state.stepSetupBlankStepIds.includes(step.id);
    setChooserSelection(shouldRestoreBlank ? 'blank' : null);
  }, [controller.selectedType, isChooserScreen, state.stepSetupBlankStepIds, step.id]);

  const handleGoPrevious = useCallback(() => {
    controller.flushPendingUpdates();
    if (isChooserScreen) {
      if (stepIndex === 0) {
        onRequestShowIntro();
        return;
      }
      onSetCurrentSubScreen('settings');
      actions.setCurrentStepIndex(Math.max(stepIndex - 1, 0));
      return;
    }

    onSetCurrentSubScreen('type');
  }, [actions, controller, isChooserScreen, onRequestShowIntro, onSetCurrentSubScreen, stepIndex]);

  const handleGoNext = useCallback(() => {
    controller.flushPendingUpdates();

    if (isChooserScreen) {
      if (chooserSelection === null) return;

      if (chooserSelection !== 'blank') {
        onSetCurrentSubScreen('settings');
        return;
      }

      if (!isLastStep) {
        onSetCurrentSubScreen('type');
        actions.setCurrentStepIndex(Math.min(stepIndex + 1, totalSteps - 1));
        return;
      }

      actions.setStepSetupResume({ stepIndex, subScreen: 'type' });
      actions.setStepSetupEntryMode('resume');
      actions.nextPhase();
      return;
    }

    if (isLastStep) {
      actions.setStepSetupResume({ stepIndex, subScreen: 'settings' });
      actions.setStepSetupEntryMode('resume');
    }

    if (!isLastStep) {
      onSetCurrentSubScreen('type');
      actions.setCurrentStepIndex(Math.min(stepIndex + 1, totalSteps - 1));
      return;
    }
    actions.nextPhase();
  }, [
    actions,
    chooserSelection,
    controller,
    isChooserScreen,
    isLastStep,
    onSetCurrentSubScreen,
    stepIndex,
    totalSteps,
  ]);

  const canAdvance = controller.selectedType !== null;
  const isRecording = controller.isRecordingPosition;

  const isBlankSelected = chooserSelection === 'blank';
  const handleSelectBlank = useCallback(() => {
    controller.flushPendingUpdates();
    controller.handleClearStepType();
    actions.setStepSetupBlankChoice(step.id, true);
    setChooserSelection('blank');
    onSetCurrentSubScreen('type');
  }, [actions, controller, onSetCurrentSubScreen, step.id]);

  const shouldShowRecordingPanel =
    isRecording && recordingPositionForStepId === step.id && Boolean(onStopRecordingPosition);

  if (shouldShowRecordingPanel) {
    return (
      <RecordingPanel
        step={step}
        objects={objects}
        onUpdateObject={onUpdateObject}
        onStopRecording={onStopRecordingPosition!}
        latestRecordingEndPositionRef={latestRecordingEndPositionRef}
      />
    );
  }

  return (
    <div className="space-y-4">
      <StepContextDisplay
        currentIndex={stepIndex}
        totalSteps={totalSteps}
        stepTitle={step.title || ''}
      />

      {/* Keyed wrapper triggers guided-fade-in animation on sub-screen or step changes */}
      <div key={`${step.id}-${effectiveSubScreen}`} className="guided-fade-in space-y-4">
        {isChooserScreen && (
          <div className="text-sm font-medium text-slate-600">
            Choose what the trainee will do in this step.
          </div>
        )}

        <StepTypeSection
          selectedType={chooserSelection && chooserSelection !== 'blank' ? chooserSelection : null}
          showTypeSelection={isChooserScreen}
          currentStepTypeConfig={controller.currentStepTypeConfig}
          isInfoCardSelected={chooserSelection === 'info-card'}
          onChangeStepType={() => {
            controller.handleChangeStepType();
            onSetCurrentSubScreen('type');
          }}
          onTypeSelect={(type) => {
            setChooserSelection(type);
            actions.setStepSetupBlankChoice(step.id, false);
            controller.handleTypeSelect(type);
          }}
        />

        {isChooserScreen && (
          <button
            type="button"
            onClick={handleSelectBlank}
            disabled={isRecording}
            className={`
              group relative mx-auto block w-[260px] max-w-full cursor-pointer overflow-hidden rounded-[20px] border backdrop-blur-xl transition-all duration-300 ease-out
              border-slate-200/60 bg-gradient-to-br from-slate-50/90 via-slate-100/80 to-white/70 shadow-lg shadow-slate-500/10
              hover:border-slate-300/70 hover:shadow-xl hover:shadow-slate-500/15
              ${isBlankSelected ? 'border-slate-400/70 shadow-2xl shadow-slate-500/20 ring-2 ring-slate-400/40' : ''}
              ${isRecording ? 'pointer-events-none opacity-60' : ''}
            `}
            aria-label="Leave blank for now"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 backdrop-blur-sm" />

            <div className="relative flex items-center gap-3 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/40 bg-white/50">
                  <MinusCircle size={16} className="text-slate-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Leave blank for now</div>
                  <div className="text-xs font-medium text-slate-600">No step type selected.</div>
                </div>
              </div>

              {isBlankSelected && (
                <div className="absolute right-3 top-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-slate-600 shadow-lg ring-2 ring-slate-400/50" />
                </div>
              )}
            </div>
          </button>
        )}

        <InfoCardSection
          step={step}
          stepName={controller.stepName}
          selectedType={controller.selectedType}
          isVisible={controller.isInfoCardSelected && isConfigScreen}
          compact
          editingField={controller.editingField}
          heading={controller.heading}
          bodyText={controller.bodyText}
          buttonText={controller.buttonText}
          cardColor={controller.cardColor}
          currentTheme={controller.currentTheme}
          headingTextareaRef={controller.headingTextareaRef}
          bodyTextTextareaRef={controller.bodyTextTextareaRef}
          buttonTextInputRef={controller.buttonTextInputRef}
          onStartEdit={controller.handleStartEdit}
          onFieldBlur={(field, value) => controller.handleFieldBlur(field, value)}
          onSetCardColor={controller.handleSetCardColor}
        />

        <MoveItemSection
          step={step}
          isVisible={controller.isMoveItemSelected && isConfigScreen}
          compact
          isRecordingPosition={controller.isRecordingPosition}
          targetObject={controller.targetObject}
          targetChildName={controller.targetChild?.name ?? null}
          canUseSelectedObject={controller.canUseSelectedObject}
          effectiveTargetObjectId={controller.effectiveTargetObjectId}
          effectiveTargetChildPath={controller.effectiveTargetChildPath}
          onUseSelectedObject={controller.handleUseSelectedObject}
          onRemoveTargetObject={controller.handleRemoveTargetObject}
          onFocusTargetObject={controller.handleFocusTargetObject}
          onToggleRecording={controller.handleToggleRecording}
        />
      </div>

      <div className="flex items-center justify-between border-t border-white/20 pt-4">
        <Button
          variant="secondary"
          size="md"
          onClick={handleGoPrevious}
          className="rounded-[20px]"
          disabled={isRecording}
        >
          {isConfigScreen
            ? 'Back'
            : stepIndex === 0
              ? 'Back'
              : 'Previous step'}
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={handleGoNext}
          className="rounded-[20px]"
          disabled={(isChooserScreen && chooserSelection === null) || (isConfigScreen && !canAdvance) || isRecording}
        >
          {isConfigScreen ? (isLastStep ? 'Finish setup' : 'Done') : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
