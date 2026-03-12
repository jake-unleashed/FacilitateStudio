import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '../types/modelGeneration';
import { useModelGeneration } from './useModelGeneration';

const submitGenerationMock = vi.fn();
const pollGenerationStatusMock = vi.fn();

vi.mock('../services/modelGenerationService', () => ({
  submitGeneration: (...args: Parameters<typeof submitGenerationMock>) => submitGenerationMock(...args),
  pollGenerationStatus: (...args: Parameters<typeof pollGenerationStatusMock>) =>
    pollGenerationStatusMock(...args),
  downloadGeneratedModel: vi.fn(),
}));

vi.mock('../utils/modelAssetStore', () => ({
  saveAsset: vi.fn(),
  syncAssetToCloud: vi.fn(),
}));

vi.mock('./modelUpload/processBuffer', () => ({
  processModelBuffer: vi.fn(),
}));

const STORAGE_KEY = 'facilitate:model-generation:tasks';

function createStoredGeneration(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: 'stored-gen',
    taskId: 'stored-task',
    name: 'stored-reference.png',
    imagePreviewDataUrl: 'data:image/png;base64,stored',
    provider: 'meshy',
    stage: 'generating',
    progress: 33,
    status: 'processing',
    error: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useModelGeneration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    submitGenerationMock.mockResolvedValue({ taskId: 'task-1', provider: 'meshy' });
    pollGenerationStatusMock.mockImplementation(() => new Promise(() => {}));
  });

  it('persists in-flight generations so they survive remounts', async () => {
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    const { result, unmount } = renderHook(() =>
      useModelGeneration({
        getExistingObjects: () => [],
      })
    );

    await act(async () => {
      await result.current.startGeneration(file);
    });

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).toContain('reference.png');

    unmount();

    const { result: restoredResult } = renderHook(() =>
      useModelGeneration({
        getExistingObjects: () => [],
      })
    );

    await waitFor(() => {
      expect(restoredResult.current.generations).toHaveLength(1);
      expect(restoredResult.current.generations[0]?.name).toBe('reference.png');
      expect(restoredResult.current.generations[0]?.taskId).toBe('task-1');
    });
  });

  it('keeps restored generations when a new generation starts', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([createStoredGeneration()]));

    const { result } = renderHook(() =>
      useModelGeneration({
        getExistingObjects: () => [],
      })
    );

    await waitFor(() => {
      expect(result.current.generations).toHaveLength(1);
      expect(result.current.generations[0]?.name).toBe('stored-reference.png');
    });

    await act(async () => {
      await result.current.startGeneration(new File(['image'], 'fresh-reference.png', { type: 'image/png' }));
    });

    await waitFor(() => {
      expect(result.current.generations).toHaveLength(2);
    });

    expect(result.current.generations.map((task) => task.name)).toEqual([
      'fresh-reference.png',
      'stored-reference.png',
    ]);
  });
});
