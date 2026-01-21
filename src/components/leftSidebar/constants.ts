import { Info, MoveRight } from 'lucide-react';
import type { SimStep, StepType } from '../../types';
import type { StepTypeConfig } from './types';

export const STEP_TYPE_CONFIGS: StepTypeConfig[] = [
  {
    type: 'info-card' as StepType,
    icon: Info,
    color: 'text-blue-600',
    label: 'Info Card',
  },
  {
    type: 'move-item' as StepType,
    icon: MoveRight,
    color: 'text-purple-600',
    label: 'Move Item',
  },
];

export const EMPTY_NEW_STEP: Omit<SimStep, 'id'> = {
  title: '',
  description: '',
  completed: false,
  type: null,
};

export function isNewEmptyStep(step: SimStep | undefined): step is SimStep {
  if (!step) return false;
  return step.title === '' && step.type === null && step.description === '';
}

