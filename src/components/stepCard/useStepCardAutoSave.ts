import { useEffect } from 'react';
import type { SimStep, StepType } from '../../types';
import { useDebounce } from './useDebounce';
import { AUTO_SAVE_DELAY } from './constants';

export interface StepCardAutoSaveArgs {
  step: SimStep;
  onUpdate: (updated: SimStep) => void;
  createUpdatedStep: (overrides?: Partial<SimStep>) => SimStep;

  stepName: string;
  selectedType: StepType | null;
  heading: string;
  bodyText: string;
  buttonText: string;
  cardColor: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  targetObjectId: string;
  targetChildPath: string;
  endPosition: SimStep['endPosition'];

  isRecordingPosition: boolean;
  endPositionJustUpdatedFromPropsRef: React.MutableRefObject<boolean>;
}

export function useStepCardAutoSave({
  step,
  onUpdate,
  createUpdatedStep,
  stepName,
  selectedType,
  heading,
  bodyText,
  buttonText,
  cardColor,
  targetObjectId,
  targetChildPath,
  endPosition,
  isRecordingPosition,
  endPositionJustUpdatedFromPropsRef,
}: StepCardAutoSaveArgs): void {
  const debouncedStepName = useDebounce(stepName, AUTO_SAVE_DELAY);
  const debouncedHeading = useDebounce(heading, AUTO_SAVE_DELAY);
  const debouncedBodyText = useDebounce(bodyText, AUTO_SAVE_DELAY);
  const debouncedButtonText = useDebounce(buttonText, AUTO_SAVE_DELAY);
  const debouncedEndPosition = useDebounce(endPosition, AUTO_SAVE_DELAY);

  useEffect(() => {
    // If debounced values haven't caught up to local state yet, skip.
    if (
      debouncedStepName !== stepName ||
      debouncedHeading !== heading ||
      debouncedBodyText !== bodyText ||
      debouncedButtonText !== buttonText
    ) {
      return;
    }

    const hasChanged =
      debouncedStepName !== step.title ||
      selectedType !== step.type ||
      debouncedHeading !== (step.heading || '') ||
      debouncedBodyText !== (step.bodyText || '') ||
      debouncedButtonText !== (step.buttonText || '') ||
      cardColor !== (step.cardColor || 'blue') ||
      targetObjectId !== (step.targetObjectId || '') ||
      targetChildPath !== (step.targetChildPath || '') ||
      JSON.stringify(debouncedEndPosition) !== JSON.stringify(step.endPosition);

    if (endPositionJustUpdatedFromPropsRef.current) {
      endPositionJustUpdatedFromPropsRef.current = false;
      return;
    }

    if (isRecordingPosition) return;

    if (hasChanged) {
      onUpdate(
        createUpdatedStep({
          title: debouncedStepName,
          heading: debouncedHeading || undefined,
          bodyText: debouncedBodyText || undefined,
          buttonText: debouncedButtonText || undefined,
          targetObjectId: targetObjectId || undefined,
          targetChildPath: targetChildPath || undefined,
          endPosition: debouncedEndPosition,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedStepName,
    selectedType,
    debouncedHeading,
    debouncedBodyText,
    debouncedButtonText,
    stepName,
    heading,
    bodyText,
    buttonText,
    cardColor,
    targetObjectId,
    targetChildPath,
    debouncedEndPosition,
    step.id,
    onUpdate,
    createUpdatedStep,
    isRecordingPosition,
  ]);
}

