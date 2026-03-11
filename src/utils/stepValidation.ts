import type { SceneObject, SimStep } from '../types';

/**
 * Returns true if there is at least one step that is usable in Preview/Publish.
 *
 * We treat steps without a type (null/undefined) as not yet configured.
 */
export function hasUsableSteps(steps: SimStep[]): boolean {
  return steps.some((step) => Boolean(step.type));
}

/**
 * Returns true if the project contains at least one imported model to showcase.
 */
export function hasShowcaseableObjects(objects: SceneObject[]): boolean {
  return objects.some((object) => typeof object.properties.modelAssetId === 'string');
}

/**
 * Returns true when preview/publish should be available because the project has
 * either a usable training step or a model worth showcasing.
 */
export function hasPreviewableContent(objects: SceneObject[], steps: SimStep[]): boolean {
  return hasShowcaseableObjects(objects) || hasUsableSteps(steps);
}

