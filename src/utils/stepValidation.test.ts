import { describe, expect, it } from 'vitest';
import type { SceneObject, SimStep } from '../types';
import { hasPreviewableContent, hasShowcaseableObjects, hasUsableSteps } from './stepValidation';

function makeObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'object-1',
    name: 'Object',
    type: 'mesh',
    transform: {
      x: 0,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    properties: {
      visible: true,
    },
    ...overrides,
  };
}

function makeStep(overrides: Partial<SimStep> = {}): SimStep {
  return {
    id: 'step-1',
    title: 'Step',
    description: '',
    completed: false,
    ...overrides,
  };
}

describe('stepValidation', () => {
  it('detects usable configured steps', () => {
    expect(hasUsableSteps([makeStep({ type: 'info-card' })])).toBe(true);
    expect(hasUsableSteps([makeStep({ type: null })])).toBe(false);
  });

  it('only treats imported models as showcaseable objects', () => {
    expect(hasShowcaseableObjects([makeObject({ properties: { visible: true } })])).toBe(false);
    expect(
      hasShowcaseableObjects([
        makeObject({ properties: { visible: true, modelAssetId: 'asset-1' } }),
      ])
    ).toBe(true);
  });

  it('allows preview/publish when there is a model or a usable step', () => {
    expect(hasPreviewableContent([], [])).toBe(false);
    expect(hasPreviewableContent([makeObject({ properties: { visible: true, modelAssetId: 'asset-1' } })], [])).toBe(
      true
    );
    expect(hasPreviewableContent([], [makeStep({ type: 'info-card' })])).toBe(true);
  });
});
