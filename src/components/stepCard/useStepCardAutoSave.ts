import { useEffect } from 'react';
import type { InfoCardDisplayMode, SimStep } from '../../types';
import { useDebounce } from './useDebounce';
import { AUTO_SAVE_DELAY } from './constants';

export interface StepCardAutoSaveArgs {
  step: SimStep;
  onUpdate: (updated: SimStep) => void;
  createUpdatedStep: (overrides?: Partial<SimStep>) => SimStep;

  stepName: string;
  heading: string;
  bodyText: string;
  buttonText: string;
  cardColor: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  infoCardDisplayMode: InfoCardDisplayMode;
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
  heading,
  bodyText,
  buttonText,
  cardColor,
  infoCardDisplayMode,
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
      debouncedHeading !== (step.heading || '') ||
      debouncedBodyText !== (step.bodyText || '') ||
      debouncedButtonText !== (step.buttonText || '') ||
      cardColor !== (step.cardColor || 'blue') ||
      infoCardDisplayMode !== (step.infoCardDisplayMode || 'overlay') ||
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
    debouncedHeading,
    debouncedBodyText,
    debouncedButtonText,
    stepName,
    heading,
    bodyText,
    buttonText,
    cardColor,
    infoCardDisplayMode,
    targetObjectId,
    targetChildPath,
    debouncedEndPosition,
    step.id,
    onUpdate,
    createUpdatedStep,
    isRecordingPosition,
  ]);
}

