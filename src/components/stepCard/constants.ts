import { Info, MoveRight, MousePointerClick } from 'lucide-react';
import type React from 'react';
import type { StepType } from '../../types';

export interface StepTypeConfig {
  type: StepType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: 'blue' | 'purple' | 'emerald';
}

export const STEP_TYPES: StepTypeConfig[] = [
  {
    type: 'info-card',
    label: 'Info Card',
    description: 'Display information to the trainee',
    icon: Info,
    color: 'blue',
  },
  {
    type: 'move-item',
    label: 'Move Item',
    description: 'Guide trainee to move an object',
    icon: MoveRight,
    color: 'purple',
  },
  {
    type: 'identify',
    label: 'Identify',
    description: 'Trainee finds and clicks the correct object',
    icon: MousePointerClick,
    color: 'emerald',
  },
];

// Constants for textarea auto-resize
export const TEXTAREA_CONFIG = {
  MAX_LINES: 3,
  LINE_HEIGHT: 22.75, // text-sm (14px) * leading-relaxed (~1.625)
  PADDING: 20, // py-2.5 (10px top + 10px bottom)
  MAX_HEIGHT: 88, // 3 * LINE_HEIGHT + PADDING
} as const;

// Debounce delay for auto-save (ms)
export const AUTO_SAVE_DELAY = 400;

// Color theme configurations for Info Card
export const COLOR_THEMES: Record<
  'blue' | 'green' | 'yellow' | 'red' | 'gray',
  {
    headingBg: string;
    headingText: string;
    circleColor: string;
  }
> = {
  blue: {
    headingBg: 'bg-blue-600',
    headingText: 'text-white',
    circleColor: 'bg-blue-600',
  },
  green: {
    headingBg: 'bg-emerald-600',
    headingText: 'text-white',
    circleColor: 'bg-emerald-600',
  },
  yellow: {
    headingBg: 'bg-amber-500',
    headingText: 'text-white',
    circleColor: 'bg-amber-500',
  },
  red: {
    headingBg: 'bg-rose-600',
    headingText: 'text-white',
    circleColor: 'bg-rose-600',
  },
  gray: {
    headingBg: 'bg-slate-600',
    headingText: 'text-white',
    circleColor: 'bg-slate-600',
  },
};

