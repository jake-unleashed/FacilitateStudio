import type React from 'react';
import type { InfoCardDisplayMode, SceneObject, SimStep, StepType } from '../../types';
import type { STEP_TYPES } from './constants';
import type { COLOR_THEMES } from './constants';
import type { findChildByPathString } from '../../utils/childTransformUtils';

export interface StepCardControllerArgs {
  step: SimStep;
  isOpen: boolean;
  onUpdate: (updated: SimStep) => void;
  selectedObjectId?: string | null;
  objects: SceneObject[];
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecordingPosition: boolean;
  onFocusObject?: (object: SceneObject) => void;
  onDelete?: () => void;
}

export interface StepCardController {
  // state
  stepName: string;
  selectedType: StepType | null;
  showTypeSelection: boolean;
  heading: string;
  bodyText: string;
  buttonText: string;
  cardColor: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  infoCardDisplayMode: InfoCardDisplayMode;
  targetObjectId: string;
  targetChildPath: string;
  endPosition: SimStep['endPosition'];
  editingField: 'heading' | 'bodyText' | 'buttonText' | null;
  confirmingDelete: boolean;
  isRecordingPosition: boolean;

  // refs
  stepNameTextareaRef: React.RefObject<HTMLTextAreaElement>;
  headingTextareaRef: React.RefObject<HTMLTextAreaElement>;
  bodyTextTextareaRef: React.RefObject<HTMLTextAreaElement>;
  buttonTextInputRef: React.RefObject<HTMLInputElement>;

  // derived
  isInfoCardSelected: boolean;
  isMoveItemSelected: boolean;
  isIdentifySelected: boolean;
  currentStepTypeConfig: (typeof STEP_TYPES)[number] | undefined;
  currentTheme: (typeof COLOR_THEMES)[keyof typeof COLOR_THEMES];
  effectiveTargetObjectId: string | undefined;
  effectiveTargetChildPath: string | undefined;
  targetObject: SceneObject | null;
  targetChild: ReturnType<typeof findChildByPathString> | null;
  canUseSelectedObject: boolean;

  // actions/handlers
  flushPendingUpdates: () => void;
  handleStepNameChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleFieldBlur: (
    field: 'stepName' | 'heading' | 'bodyText' | 'buttonText',
    value: string
  ) => void;
  handleStartEdit: (field: 'heading' | 'bodyText' | 'buttonText') => void;
  handleTypeSelect: (type: StepType) => void;
  handleChangeStepType: () => void;
  handleClearStepType: () => void;
  handleSetCardColor: (color: 'blue' | 'green' | 'yellow' | 'red' | 'gray') => void;
  handleSetInfoCardDisplayMode: (mode: InfoCardDisplayMode) => void;
  handleUseSelectedObject: () => void;
  handleToggleRecording: () => void;
  handleRemoveTargetObject: () => void;
  handleFocusTargetObject: (targetObj: SceneObject) => void;
  handleDeleteClick: () => void;
}

