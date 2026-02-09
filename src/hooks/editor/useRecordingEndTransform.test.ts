import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import type { SceneObject, SimStep } from '../../types';
import { DEFAULT_TRANSFORM } from '../../types';
import { useRecordingEndTransform } from './useRecordingEndTransform';

function makeMeshObject(id: string): SceneObject {
  return {
    id,
    name: 'Obj',
    type: 'mesh',
    transform: { ...DEFAULT_TRANSFORM },
    properties: { visible: true },
  };
}

describe('useRecordingEndTransform', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not enter recording mode if step has no targetObjectId', () => {
    const steps: SimStep[] = [
      { id: 's1', title: 'Step', description: '', completed: false, type: 'move-item' },
    ];

    const beginBatch = vi.fn();
    const endBatch = vi.fn();
    const executeCommand = vi.fn(() => true);
    const onSelectObject = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useRecordingEndTransform({
        steps,
        undoRedoSteps: steps,
        objects: [],
        beginBatch,
        endBatch,
        executeCommand,
        onSelectObject,
      })
    );

    act(() => {
      result.current.handleStartRecordingPosition('s1');
    });

    expect(result.current.recordingPositionForStepId).toBeNull();
    expect(beginBatch).not.toHaveBeenCalled();
    expect(onSelectObject).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not enter recording mode if target object is missing', () => {
    const steps: SimStep[] = [
      {
        id: 's1',
        title: 'Step',
        description: '',
        completed: false,
        type: 'move-item',
        targetObjectId: 'missing',
      },
    ];

    const beginBatch = vi.fn();
    const endBatch = vi.fn();
    const executeCommand = vi.fn(() => true);
    const onSelectObject = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useRecordingEndTransform({
        steps,
        undoRedoSteps: steps,
        objects: [makeMeshObject('other')],
        beginBatch,
        endBatch,
        executeCommand,
        onSelectObject,
      })
    );

    act(() => {
      result.current.handleStartRecordingPosition('s1');
    });

    expect(result.current.recordingPositionForStepId).toBeNull();
    expect(beginBatch).not.toHaveBeenCalled();
    expect(onSelectObject).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});

