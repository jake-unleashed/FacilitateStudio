import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { PreviewStepExecutor } from './PreviewStepExecutor';
import type { SceneObject, SimStep } from '../../types';

function makeCube(id: string): SceneObject {
  return {
    id,
    name: `Cube ${id}`,
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
      grabbable: true,
      color: '#ffffff',
    },
  };
}

function makeInfoStep(partial?: Partial<SimStep>): SimStep {
  return {
    id: partial?.id ?? 'step-info',
    title: partial?.title ?? 'Info',
    description: partial?.description ?? '',
    completed: partial?.completed ?? false,
    type: 'info-card',
    heading: partial?.heading ?? 'Heading',
    bodyText: partial?.bodyText ?? 'Body',
    buttonText: partial?.buttonText ?? 'Continue',
    cardColor: partial?.cardColor ?? 'blue',
  };
}

function makeMoveItemStep(partial?: Partial<SimStep>): SimStep {
  return {
    id: partial?.id ?? 'step-move',
    title: partial?.title ?? 'Move Item',
    description: partial?.description ?? '',
    completed: partial?.completed ?? false,
    type: 'move-item',
    targetObjectId: partial?.targetObjectId ?? 'obj-1',
    startPosition: partial?.startPosition ?? { x: 0, y: 0, z: 0 },
    endPosition: partial?.endPosition ?? { x: 1, y: 0, z: 0 },
  };
}

describe('PreviewStepExecutor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders a slim progress bar with Progress text and percentage', () => {
    render(
      <PreviewStepExecutor
        steps={[makeInfoStep({ id: 's1' }), makeInfoStep({ id: 's2' })]}
        objects={[]}
        onComplete={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('does not show 100% on the last step until that last step is completed', () => {
    const onComplete = vi.fn();
    let stepCompleteHandler: (() => void) | null = null;

    render(
      <PreviewStepExecutor
        steps={[makeInfoStep({ id: 's1' }), makeMoveItemStep({ id: 's2' })]}
        objects={[makeCube('obj-1')]}
        onComplete={onComplete}
        onExit={vi.fn()}
        onRegisterStepCompleteHandler={(handler) => {
          stepCompleteHandler = handler;
        }}
      />
    );

    expect(stepCompleteHandler).not.toBeNull();
    expect(screen.getByText('0%')).toBeInTheDocument();

    // Complete first step -> should move immediately to move-item step (next is move-item)
    act(() => stepCompleteHandler?.());
    expect(screen.getByText('50%')).toBeInTheDocument();

    // We are now on the last step, but it has NOT been completed yet.
    expect(screen.queryByText('100%')).not.toBeInTheDocument();

    // Complete last step -> progress becomes 100%, and onComplete fires after delay
    act(() => stepCompleteHandler?.());
    expect(screen.getByText('100%')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows move-item step label at the top, with fallback when title is empty', () => {
    render(
      <PreviewStepExecutor
        steps={[makeMoveItemStep({ id: 's1', title: '' })]}
        objects={[makeCube('obj-1')]}
        onComplete={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('Move Item')).toBeInTheDocument();
  });

  it('Escape exits preview', () => {
    const onExit = vi.fn();
    render(
      <PreviewStepExecutor
        steps={[makeInfoStep({ id: 's1' })]}
        objects={[]}
        onComplete={vi.fn()}
        onExit={onExit}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('Enter continues an info-card when waiting', () => {
    const onComplete = vi.fn();
    render(
      <PreviewStepExecutor
        steps={[makeInfoStep({ id: 's1' })]}
        objects={[]}
        onComplete={onComplete}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('100%')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('registers an object click handler and only forwards clicks for the active move-item target while waiting', () => {
    const onObjectClick = vi.fn();
    let objectClickHandler: ((objectId: string) => void) | null = null;

    render(
      <PreviewStepExecutor
        steps={[makeMoveItemStep({ id: 's1', targetObjectId: 'obj-1' })]}
        objects={[makeCube('obj-1'), makeCube('obj-2')]}
        onComplete={vi.fn()}
        onExit={vi.fn()}
        onObjectClick={onObjectClick}
        onRegisterObjectClickHandler={(handler) => {
          objectClickHandler = handler;
        }}
      />
    );

    expect(objectClickHandler).not.toBeNull();

    act(() => objectClickHandler?.('obj-2'));
    expect(onObjectClick).not.toHaveBeenCalled();

    act(() => objectClickHandler?.('obj-1'));
    expect(onObjectClick).toHaveBeenCalledTimes(1);

    // Now execution state should be "executing"; further clicks should be ignored.
    act(() => objectClickHandler?.('obj-1'));
    expect(onObjectClick).toHaveBeenCalledTimes(1);
  });
});
