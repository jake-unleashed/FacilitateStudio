import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneBackgroundImage } from '../types/sceneSettings';
import { useBackgroundImageFlow } from './useBackgroundImageFlow';

type UploadHookState = {
  userId?: string;
  stage: 'idle' | 'optimizing' | 'uploading';
  isUploading: boolean;
  statusText: string | null;
  lastError: string | null;
  uploadBackground: (file: File, projectId: string) => Promise<SceneBackgroundImage>;
  removeBackground: (storageKeyOrRef: string | null | undefined) => Promise<void>;
  clearError: () => void;
};

let mockedUploadHookState: UploadHookState;

vi.mock('./useBackgroundUpload', () => ({
  useBackgroundUpload: () => mockedUploadHookState,
}));

function createBackgroundImage(overrides: Partial<SceneBackgroundImage> = {}): SceneBackgroundImage {
  return {
    storageKey: 'bg://user/project/background/test.jpg',
    filename: 'test.jpg',
    fileSize: 1024,
    signedUrl: 'https://example.com/bg/test.jpg',
    ...overrides,
  };
}

describe('useBackgroundImageFlow', () => {
  beforeEach(() => {
    mockedUploadHookState = {
      userId: 'user-1',
      stage: 'idle',
      isUploading: false,
      statusText: null,
      lastError: null,
      uploadBackground: vi.fn().mockResolvedValue(createBackgroundImage()),
      removeBackground: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
    };
  });

  it('maps upload status text to optimizing/uploading phases', async () => {
    const { result, rerender } = renderHook(() => useBackgroundImageFlow());
    expect(result.current.phase).toBe('idle');

    mockedUploadHookState.isUploading = true;
    mockedUploadHookState.stage = 'optimizing';
    mockedUploadHookState.statusText = 'Optimizing image...';
    rerender();
    expect(result.current.phase).toBe('optimizing');
    expect(result.current.isUploadingBackground).toBe(true);

    mockedUploadHookState.stage = 'uploading';
    mockedUploadHookState.statusText = 'Uploading...';
    rerender();
    expect(result.current.phase).toBe('uploading');
    expect(result.current.backgroundUploadStatusText).toBe('Uploading...');
  });

  it('transitions to preparingScene after successful upload', async () => {
    const { result } = renderHook(() => useBackgroundImageFlow());
    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.uploadBackgroundAndPrepare(file, 'project-1');
    });

    expect(result.current.phase).toBe('preparingScene');
    expect(result.current.isBackgroundTextureLoading).toBe(true);
  });

  it('ignores stale ready events from older image URLs', async () => {
    const oldBackground = createBackgroundImage({ signedUrl: 'https://example.com/bg/old.jpg' });
    mockedUploadHookState.uploadBackground = vi.fn().mockResolvedValue(oldBackground);
    const { result } = renderHook(() => useBackgroundImageFlow());
    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.uploadBackgroundAndPrepare(file, 'project-1');
    });
    expect(result.current.phase).toBe('preparingScene');

    act(() => {
      result.current.handleBackgroundReadyChange(true, 'https://example.com/bg/newer.jpg');
    });
    expect(result.current.phase).toBe('preparingScene');

    act(() => {
      result.current.handleBackgroundReadyChange(true, 'https://example.com/bg/old.jpg');
    });
    expect(result.current.phase).toBe('ready');
  });

  it('surfaces texture-load errors via backgroundUploadError', async () => {
    const expectedUrl = 'https://example.com/bg/expected.jpg';
    mockedUploadHookState.uploadBackground = vi.fn().mockResolvedValue(createBackgroundImage({ signedUrl: expectedUrl }));
    const { result } = renderHook(() => useBackgroundImageFlow());
    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.uploadBackgroundAndPrepare(file, 'project-1');
    });

    act(() => {
      result.current.handleBackgroundReadyChange(true, expectedUrl, 'Failed to load texture');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.backgroundUploadError).toBe('Failed to load texture');
  });

  it('resets to idle when background image is removed', () => {
    const { result } = renderHook(() => useBackgroundImageFlow());

    act(() => {
      result.current.syncBackgroundImageUrl(undefined);
    });

    expect(result.current.phase).toBe('idle');
  });
});
