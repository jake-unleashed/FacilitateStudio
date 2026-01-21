import React, { forwardRef, useImperativeHandle } from 'react';
import type { StepCardHandle } from './publicTypes';
import { useStepCardController } from './StepCardController';
import type { StepCardProps } from './types';
import { StepCardView } from './StepCardView';

export const StepCard = forwardRef<StepCardHandle, StepCardProps>(
  (
    {
      step,
      isOpen,
      onUpdate,
      onMinimize,
      selectedObjectId,
      objects = [],
      onStartRecording,
      onStopRecording,
      isRecordingPosition = false,
      onFocusObject,
      onDelete,
    },
    ref
  ) => {
    const controller = useStepCardController({
      step,
      isOpen,
      onUpdate,
      selectedObjectId,
      objects,
      onStartRecording,
      onStopRecording,
      isRecordingPosition,
      onFocusObject,
      onDelete,
    });

    useImperativeHandle(
      ref,
      () => ({
        flushPendingUpdates: controller.flushPendingUpdates,
      }),
      [controller.flushPendingUpdates]
    );

    if (!isOpen) return null;

    return (
      <StepCardView
        step={step}
        onMinimize={onMinimize}
        onDeleteVisible={!!onDelete}
        controller={controller}
      />
    );
  }
);

StepCard.displayName = 'StepCard';

