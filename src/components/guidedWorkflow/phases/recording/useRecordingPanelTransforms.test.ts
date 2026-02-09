import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import type { SceneObject, SimStep } from '../../../../types';
import { DEFAULT_TRANSFORM } from '../../../../types';
import type { LatestRecordingEndTransformRefValue } from '../../../../hooks/editor/useRecordingEndTransform';
import { useRecordingPanelTransforms } from './useRecordingPanelTransforms';

function makeMeshObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'obj-1',
    name: 'Test mesh',
    type: 'mesh',
    transform: { ...DEFAULT_TRANSFORM },
    properties: { visible: true, modelHeight: 100 },
    ...overrides,
  };
}

describe('useRecordingPanelTransforms', () => {
  it('preserves position+scale when updating rotation for parent targets (uses latest ref)', () => {
    const obj = makeMeshObject({
      transform: { ...DEFAULT_TRANSFORM, x: 1, y: 2, z: 3, scaleX: 1, scaleY: 1, scaleZ: 1 },
    });

    const step: SimStep = {
      id: 'step-1',
      title: 'Move',
      description: '',
      completed: false,
      type: 'move-item',
      targetObjectId: obj.id,
      endPosition: { x: 10, y: 0, z: 0 },
      endRotation: { x: 0, y: 0, z: 0 },
      endScale: { x: 2, y: 2, z: 2 },
    };

    const latest: LatestRecordingEndTransformRefValue = {
      stepId: step.id,
      endPosition: { x: 99, y: 88, z: 77 },
      endRotation: { x: 1, y: 2, z: 3 },
      endScale: { x: 3, y: 3, z: 3 },
    };
    const latestRef = { current: latest };

    const onUpdateObject = vi.fn();
    const { result } = renderHook(() =>
      useRecordingPanelTransforms({
        step,
        objects: [obj],
        onUpdateObject,
        latestRecordingEndPositionRef: latestRef,
      })
    );

    act(() => {
      result.current.handleRotationChange('y', 45);
    });

    expect(onUpdateObject).toHaveBeenCalledTimes(1);
    const updated = onUpdateObject.mock.calls[0]![0] as SceneObject;
    expect(updated.transform.x).toBe(99);
    expect(updated.transform.y).toBe(88);
    expect(updated.transform.z).toBe(77);
    expect(updated.transform.scaleX).toBe(3);
    expect(updated.transform.scaleY).toBe(3);
    expect(updated.transform.scaleZ).toBe(3);
    expect(updated.transform.rotationX).toBe(1);
    expect(updated.transform.rotationY).toBe(45);
    expect(updated.transform.rotationZ).toBe(3);
  });

  it('preserves rotation when updating scale for child targets (writes rotation+scale together)', () => {
    const childPath = ['Scene', 'Child'];
    const childPathStr = 'Scene.Child';
    const obj = makeMeshObject({
      id: 'obj-child',
      transform: { ...DEFAULT_TRANSFORM, x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
      children: [
        {
          name: 'Child',
          path: childPath,
          localTransform: { ...DEFAULT_TRANSFORM },
        },
      ],
    });

    const step: SimStep = {
      id: 'step-child',
      title: 'Move child',
      description: '',
      completed: false,
      type: 'move-item',
      targetObjectId: obj.id,
      targetChildPath: childPathStr,
      endPosition: { x: 5, y: 0, z: 0 },
      endRotation: { x: 10, y: 20, z: 30 },
      endScale: { x: 2, y: 2, z: 2 },
    };

    const latest: LatestRecordingEndTransformRefValue = {
      stepId: step.id,
      endPosition: { x: 7, y: 0, z: 0 },
      endRotation: { x: 11, y: 22, z: 33 },
      endScale: { x: 3, y: 3, z: 3 },
    };
    const latestRef = { current: latest };

    const onUpdateObject = vi.fn();
    const { result } = renderHook(() =>
      useRecordingPanelTransforms({
        step,
        objects: [obj],
        onUpdateObject,
        latestRecordingEndPositionRef: latestRef,
      })
    );

    act(() => {
      result.current.handleScaleChange(4);
    });

    expect(onUpdateObject).toHaveBeenCalledTimes(1);
    const updated = onUpdateObject.mock.calls[0]![0] as SceneObject;
    const updatedChild = updated.children?.find((c) => c.name === 'Child');
    expect(updatedChild).toBeTruthy();
    expect(updatedChild!.localTransform.scaleX).toBe(4);
    expect(updatedChild!.localTransform.scaleY).toBe(4);
    expect(updatedChild!.localTransform.scaleZ).toBe(4);
    // Rotation should be preserved from latest ref (not reset).
    expect(updatedChild!.localTransform.rotationX).toBe(11);
    expect(updatedChild!.localTransform.rotationY).toBe(22);
    expect(updatedChild!.localTransform.rotationZ).toBe(33);
  });
});

