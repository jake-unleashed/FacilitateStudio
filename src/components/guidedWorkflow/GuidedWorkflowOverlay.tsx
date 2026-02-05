import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../Button';
import { useGuidedWorkflow } from '../../hooks/useGuidedWorkflow';
import type { FocusMode, SceneObject, SimStep } from '../../types';
import type { AssetMetadata, UploadProgress } from '../../types/model';
import { StepCreationPhase } from './phases/StepCreationPhase';
import { ModelUploadPhase } from './phases/ModelUploadPhase';
import { ModelPositioningPhase, type PositioningScreen } from './phases/ModelPositioningPhase';
import { StepConfigurationPhase } from './phases/StepConfigurationPhase';

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
  onUploadAsset: (file: File) => Promise<void>;
  uploadProgress?: UploadProgress;
  recentAssets?: AssetMetadata[];
  onAddRecentAsset?: (asset: AssetMetadata) => void;
  onDeleteObject?: (objectId: string) => void;
  onFocusObject?: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => void;
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
  onUploadAsset,
  uploadProgress,
  recentAssets,
  onAddRecentAsset,
  onDeleteObject,
  onFocusObject,
}: GuidedWorkflowOverlayProps) {
  const { state, actions, isFirstPhase, isLastPhase } = useGuidedWorkflow();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [positioningScreen, setPositioningScreen] =
    useState<PositioningScreen>('object-selection');
  const hasUploadedModel = useMemo(
    () => objects.some((object) => object.type === 'mesh'),
    [objects]
  );
  const canContinue = useMemo(() => {
    switch (state.currentPhase) {
      case 'step-creation':
        return steps.length > 0;
      case 'model-upload':
        return hasUploadedModel;
      case 'model-positioning':
        return hasUploadedModel;
      default:
        return true;
    }
  }, [state.currentPhase, steps.length, hasUploadedModel]);
  const isCentered =
    state.currentPhase === 'step-creation' ||
    (state.currentPhase === 'model-upload' && !hasUploadedModel);
  const isStepCreation = state.currentPhase === 'step-creation';
  const isModelUpload = state.currentPhase === 'model-upload';
  const isModelPositioning = state.currentPhase === 'model-positioning';
  const isStepConfiguration = state.currentPhase === 'step-configuration';
  const shouldShowOverlayNav =
    !isStepCreation &&
    !(isModelUpload && isCentered && isSubmenuOpen) &&
    !isStepConfiguration &&
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
    if (state.currentPhase !== 'model-positioning') {
      setPositioningScreen('object-selection');
    }
  }, [state.currentPhase]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {/* Skip setup button - persistent throughout all guided phases */}
      <div className={`pointer-events-auto fixed z-[70] ${skipPlacementClass}`}>
        <button
          type="button"
          onClick={actions.exitWorkflow}
          className="rounded-[20px] border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-glass-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/90 hover:text-slate-800 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10"
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
          className={
            isCentered
              ? 'w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/40 bg-white/80 p-8 shadow-glass backdrop-blur-xl'
              : 'w-full overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl'
          }
        >
          <div
            className={
              isCentered
                ? 'space-y-4'
                : isModelPositioning
                  ? 'space-y-4 p-6'
                  : isStepConfiguration
                    ? 'space-y-4 p-6'
                    : 'max-h-[calc(100vh-240px)] space-y-4 overflow-y-auto p-6 pr-4 custom-scrollbar'
            }
          >
            {state.currentPhase === 'step-creation' ? (
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
                onFocusObject={onFocusObject}
                onStartRecordingPosition={onStartRecordingPosition}
                onStopRecordingPosition={onStopRecordingPosition}
                recordingPositionForStepId={recordingPositionForStepId}
              />
            ) : (
              <div className="rounded-[20px] border border-white/40 bg-white/50 p-4 text-sm font-medium text-slate-600">
                Placeholder for <span className="font-semibold">{state.currentPhase}</span> phase content.
              </div>
            )}
          </div>

          {shouldShowOverlayNav && (
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
              <Button
                variant="secondary"
                size="md"
                onClick={actions.previousPhase}
                className="rounded-[20px]"
                disabled={isFirstPhase}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={actions.nextPhase}
                className="rounded-[20px]"
                disabled={isLastPhase || !canContinue}
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
