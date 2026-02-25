import { Info, MoveRight, MousePointerClick } from 'lucide-react';
import type { SimStep } from '../../types';
import type { StepTypeConfig } from './types';

export const STEP_TYPE_CONFIGS: StepTypeConfig[] = [
  {
    type: 'info-card',
    icon: Info,
    color: 'text-blue-600',
    label: 'Info Card',
  },
  {
    type: 'move-item',
    icon: MoveRight,
    color: 'text-purple-600',
    label: 'Move Item',
  },
  {
    type: 'identify',
    icon: MousePointerClick,
    color: 'text-emerald-600',
    label: 'Identify',
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

