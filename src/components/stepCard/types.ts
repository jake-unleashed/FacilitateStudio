import type { SceneObject, SimStep, StepType } from '../../types';

export interface StepCardProps {
  step: SimStep;
  isOpen: boolean;
  onUpdate: (updated: SimStep) => void;
  onMinimize: () => void;
  selectedObjectId?: string | null;
  objects?: SceneObject[];
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecordingPosition?: boolean;
  onFocusObject?: (object: SceneObject) => void;
  onDelete?: () => void;
}

export type StepCardEditingField = 'heading' | 'bodyText' | 'buttonText' | null;

export interface StepCardState {
  stepName: string;
  selectedType: StepType | null;
  showTypeSelection: boolean;
  heading: string;
  bodyText: string;
  buttonText: string;
  cardColor: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  targetObjectId: string;
  targetChildPath: string;
  endPosition: SimStep['endPosition'];
  editingField: StepCardEditingField;
  confirmingDelete: boolean;
}

