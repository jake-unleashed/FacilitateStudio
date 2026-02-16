import type { SimStep } from '../types';

/**
 * Returns true if there is at least one step that is usable in Preview/Publish.
 *
 * We treat steps without a type (null/undefined) as not yet configured.
 */
export function hasUsableSteps(steps: SimStep[]): boolean {
  return steps.some((step) => Boolean(step.type));
}

