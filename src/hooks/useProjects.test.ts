import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Project } from '../types/project';

const { mockCloudPersistence, mockCreateProjectPersistence, mockCreateSupabasePersistence } = vi.hoisted(
  () => {
    const cloud = {
      loadProjects: vi.fn<() => Promise<Project[]>>(),
      saveProjects: vi.fn<() => Promise<void>>(),
      getProject: vi.fn<(id: string) => Promise<Project | undefined>>(),
      saveProject: vi.fn<(project: Project) => Promise<void>>(),
      deleteProject: vi.fn<(id: string) => Promise<void>>(),
    };

    return {
      mockCloudPersistence: cloud,
      mockCreateProjectPersistence: vi.fn(),
      mockCreateSupabasePersistence: vi.fn(() => cloud),
    };
  }
);

const { mockLoadCachedSnapshot, mockSaveCachedSnapshot, mockClearIndexedDbProjectsStore } = vi.hoisted(
  () => ({
    mockLoadCachedSnapshot: vi.fn<(userId?: string | null) => Promise<Project[] | null>>(),
    mockSaveCachedSnapshot: vi.fn<(projects: Project[], userId?: string | null) => Promise<void>>(),
    mockClearIndexedDbProjectsStore: vi.fn<() => Promise<void>>(),
  })
);

let mockUser: { id: string; email?: string } | null = { id: 'test-user-id', email: 'test@example.com' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    session: null,
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../persistence/projectPersistence', () => ({
  createProjectPersistence: mockCreateProjectPersistence,
  createSupabasePersistence: mockCreateSupabasePersistence,
  loadCachedProjectsSnapshot: mockLoadCachedSnapshot,
  saveCachedProjectsSnapshot: mockSaveCachedSnapshot,
  clearIndexedDbProjectsStore: mockClearIndexedDbProjectsStore,
}));

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'test-user-id', email: 'test@example.com' };
    mockLoadCachedSnapshot.mockResolvedValue(null);
    mockSaveCachedSnapshot.mockResolvedValue(undefined);
    mockClearIndexedDbProjectsStore.mockResolvedValue(undefined);
    mockCloudPersistence.loadProjects.mockResolvedValue([]);
    mockCloudPersistence.getProject.mockResolvedValue(undefined);
    mockCloudPersistence.saveProject.mockResolvedValue(undefined);
    mockCloudPersistence.deleteProject.mockResolvedValue(undefined);
  });

  it('does not create or read device-local persistence when signed in', async () => {
    const { useProjects } = await import('./useProjects');

    renderHook(() => useProjects());

    await waitFor(() => {
      expect(mockCloudPersistence.loadProjects).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateProjectPersistence).not.toHaveBeenCalled();
    expect(mockLoadCachedSnapshot).toHaveBeenCalledWith('test-user-id');
  });

  it('rolls back optimistic state when cloud save fails and no further edits occurred', async () => {
    const { useProjects } = await import('./useProjects');

    const existing: Project = {
      id: 'p-1',
      name: 'Existing',
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      objects: [],
      steps: [],
    };

    mockCloudPersistence.loadProjects.mockResolvedValue([existing]);
    // saveProject uses a single retry; reject both attempts so the call fails.
    mockCloudPersistence.saveProject
      .mockRejectedValueOnce(new Error('Network down'))
      .mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('Existing');
    });

    const edited: Project = { ...existing, name: 'Edited name' };

    vi.useFakeTimers();
    let savePromise: ReturnType<typeof result.current.saveProject>;
    await act(async () => {
      savePromise = result.current.saveProject(edited);
    });
    // Attach a handler immediately to avoid vitest unhandled rejection noise.
    void savePromise!.catch(() => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await expect(savePromise!).rejects.toBeTruthy();
    vi.useRealTimers();

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('Existing');
    });
  });

  it('does not roll back if the project was edited again after the failed save began', async () => {
    const { useProjects } = await import('./useProjects');

    const existing: Project = {
      id: 'p-2',
      name: 'Existing',
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      objects: [],
      steps: [],
    };

    mockCloudPersistence.loadProjects.mockResolvedValue([existing]);
    // Order of cloud saves we expect:
    // 1) First edit attempt #1 -> reject
    // 2) Second edit attempt #1 -> resolve
    // 3) First edit attempt #2 (retry after delay) -> reject
    mockCloudPersistence.saveProject
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
    });

    vi.useFakeTimers();
    const firstEdit: Project = { ...existing, name: 'First edit' };
    let firstSavePromise: ReturnType<typeof result.current.saveProject>;
    await act(async () => {
      firstSavePromise = result.current.saveProject(firstEdit);
    });
    // Attach a handler immediately to avoid vitest unhandled rejection noise.
    void firstSavePromise!.catch(() => {});

    const secondEdit: Project = { ...existing, name: 'Second edit' };
    await act(async () => {
      await result.current.saveProject(secondEdit);
    });

    // Let the first edit hit its retry and fail.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await expect(firstSavePromise!).rejects.toBeTruthy();
    vi.useRealTimers();

    // The second edit should remain in-memory (no rollback to existing)
    await waitFor(() => {
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('Second edit');
    });
  });

  it('handles localStorage being unavailable during legacy cleanup flag read/write', async () => {
    const originalLocalStorage = globalThis.localStorage;
    // @ts-expect-error - override for test
    globalThis.localStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };

    const { useProjects } = await import('./useProjects');

    renderHook(() => useProjects());

    await waitFor(() => {
      expect(mockCloudPersistence.loadProjects).toHaveBeenCalledTimes(1);
    });

    // Cleanup may be attempted, but should never throw into the hook.
    expect(mockClearIndexedDbProjectsStore).not.toHaveBeenCalled();

    globalThis.localStorage = originalLocalStorage;
  });
});

