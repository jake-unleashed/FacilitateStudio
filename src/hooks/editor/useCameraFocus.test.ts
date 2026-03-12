import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';

import type { SceneObject } from '../../types';

const calculateFocusTargetFromSceneMock = vi.fn();
const calculateFocusTargetForObjectMock = vi.fn();
const calculateQuickFocusCameraMock = vi.fn();
const calculateOcclusionAwareFocusCameraAsyncMock = vi.fn();

vi.mock('../../utils/focusTargetCalculator', () => ({
  calculateFocusTargetFromScene: (...args: unknown[]) => calculateFocusTargetFromSceneMock(...args),
  calculateFocusTargetForObject: (...args: unknown[]) => calculateFocusTargetForObjectMock(...args),
}));

vi.mock('../../utils/focusCameraOcclusion', () => ({
  calculateQuickFocusCamera: (...args: unknown[]) => calculateQuickFocusCameraMock(...args),
  calculateOcclusionAwareFocusCameraAsync: (...args: unknown[]) =>
    calculateOcclusionAwareFocusCameraAsyncMock(...args),
  MIN_FOCUS_CAMERA_Y: 0.05,
}));

import { useCameraFocus } from './useCameraFocus';

function createSceneObject(): SceneObject {
  return {
    id: 'obj-1',
    name: 'Test',
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
      modelAssetId: 'asset-1',
    },
  };
}

function createControls(position = new THREE.Vector3(5, 5, 5)): CameraControlsImpl {
  return {
    getPosition: vi.fn((target: THREE.Vector3) => {
      target.copy(position);
    }),
    setTarget: vi.fn(),
    setLookAt: vi.fn(),
  } as unknown as CameraControlsImpl;
}

describe('useCameraFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('recenters only for recenter-only selection focus without running camera solvers', async () => {
    const object = createSceneObject();
    const controls = createControls();
    const scene = new THREE.Scene();

    calculateFocusTargetFromSceneMock.mockReturnValue({
      targetX: 1,
      targetY: 2,
      targetZ: 3,
      boundsSize: 1,
    });

    const { result } = renderHook(() => useCameraFocus());

    act(() => {
      result.current.handleCameraControlsReady(controls);
      result.current.handleSceneReady(scene);
    });

    await act(async () => {
      await result.current.handleFocusObject(object, 'child.path', 'recenterOnly');
    });

    expect(controls.setTarget).toHaveBeenCalledWith(1, 2, 3, true);
    expect(controls.setLookAt).not.toHaveBeenCalled();
    expect(calculateQuickFocusCameraMock).not.toHaveBeenCalled();
    expect(calculateOcclusionAwareFocusCameraAsyncMock).not.toHaveBeenCalled();
  });

  it('uses assist focus to zoom from afar without invoking the heavy solver', async () => {
    const object = createSceneObject();
    const controls = createControls(new THREE.Vector3(20, 20, 20));
    const scene = new THREE.Scene();

    calculateFocusTargetFromSceneMock.mockReturnValue({
      targetX: 1,
      targetY: 2,
      targetZ: 3,
      boundsSize: 1,
    });
    calculateQuickFocusCameraMock.mockReturnValue({
      shouldUseFastPath: false,
      position: undefined,
      target: new THREE.Vector3(1, 2, 3),
    });

    const { result } = renderHook(() => useCameraFocus());

    act(() => {
      result.current.handleCameraControlsReady(controls);
      result.current.handleSceneReady(scene);
    });

    await act(async () => {
      await result.current.handleFocusObject(object, 'child.path', 'assist');
    });

    expect(controls.setLookAt).toHaveBeenCalledTimes(1);
    expect(calculateOcclusionAwareFocusCameraAsyncMock).not.toHaveBeenCalled();
  });

  it('uses a single quick explicit focus move when the quick path is clear', async () => {
    const object = createSceneObject();
    const controls = createControls();
    const scene = new THREE.Scene();

    calculateFocusTargetFromSceneMock.mockReturnValue({
      targetX: 1,
      targetY: 2,
      targetZ: 3,
      boundsSize: 1,
    });
    calculateQuickFocusCameraMock.mockReturnValue({
      shouldUseFastPath: true,
      position: new THREE.Vector3(8, 6, 4),
      target: new THREE.Vector3(1, 2, 3),
    });

    const { result } = renderHook(() => useCameraFocus());

    act(() => {
      result.current.handleCameraControlsReady(controls);
      result.current.handleSceneReady(scene);
    });

    await act(async () => {
      await result.current.handleFocusObject(object, 'child.path', 'explicit');
    });

    expect(controls.setLookAt).toHaveBeenCalledTimes(1);
    expect(calculateQuickFocusCameraMock).toHaveBeenCalledTimes(1);
    expect(calculateOcclusionAwareFocusCameraAsyncMock).not.toHaveBeenCalled();
  });

  it('falls back to assist focus when explicit solver exceeds the time budget', async () => {
    vi.useFakeTimers();

    const object = createSceneObject();
    const controls = createControls();
    const scene = new THREE.Scene();

    calculateFocusTargetFromSceneMock.mockReturnValue({
      targetX: 1,
      targetY: 2,
      targetZ: 3,
      boundsSize: 1,
    });
    calculateQuickFocusCameraMock.mockReturnValue({
      shouldUseFastPath: false,
      position: undefined,
      target: new THREE.Vector3(1, 2, 3),
    });
    calculateOcclusionAwareFocusCameraAsyncMock.mockImplementation(
      () => new Promise(() => {})
    );

    const { result } = renderHook(() => useCameraFocus());

    act(() => {
      result.current.handleCameraControlsReady(controls);
      result.current.handleSceneReady(scene);
    });

    const focusPromise = result.current.handleFocusObject(object, 'child.path', 'explicit');
    await vi.advanceTimersByTimeAsync(200);
    await focusPromise;

    expect(controls.setLookAt).toHaveBeenCalledTimes(1);
  });
});
