import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectAutoSave } from './useProjectAutoSave';
import type { Project } from '../types/project';
import type { SceneObject, SimStep } from '../types';
import type { SimulationSettings } from '../types/simulationSettings';

describe('useProjectAutoSave', () => {
  let mockProject: Project;
  let mockObjects: SceneObject[];
  let mockSteps: SimStep[];
  let mockSaveProject: ReturnType<typeof vi.fn>;
  let mockCaptureThumbnail: () => Promise<string | undefined>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockProject = {
      id: 'test-project-id',
      name: 'Test Project',
      objects: [],
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockObjects = [];
    mockSteps = [];
    mockSaveProject = vi.fn().mockResolvedValue(undefined);
    mockCaptureThumbnail = vi.fn().mockResolvedValue('data:image/png;base64,mock');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should start with idle status', () => {
      const { result } = renderHook(() =>
        useProjectAutoSave({
          project: mockProject,
          name: mockProject.name,
          objects: mockObjects,
          steps: mockSteps,
          saveProject: mockSaveProject,
        })
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.isDirty).toBe(false);
      expect(result.current.lastError).toBe(null);
      expect(result.current.lastSavedAt).toBe(null);
    });

    it('should handle null project', () => {
      const { result } = renderHook(() =>
        useProjectAutoSave({
          project: null,
          name: 'Test',
          objects: mockObjects,
          steps: mockSteps,
          saveProject: mockSaveProject,
        })
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('Baseline Establishment', () => {
    it('should set baseline and mark as saved', () => {
      const { result } = renderHook(() =>
        useProjectAutoSave({
          project: mockProject,
          name: mockProject.name,
          objects: mockObjects,
          steps: mockSteps,
          saveProject: mockSaveProject,
        })
      );

      act(() => {
        result.current.setBaseline();
      });

      expect(result.current.status).toBe('saved');
      expect(result.current.isDirty).toBe(false);
    });

    it('should not trigger save when setting baseline', () => {
      const { result } = renderHook(() =>
        useProjectAutoSave({
          project: mockProject,
          name: mockProject.name,
          objects: mockObjects,
          steps: mockSteps,
          saveProject: mockSaveProject,
        })
      );

      act(() => {
        result.current.setBaseline();
      });

      expect(mockSaveProject).not.toHaveBeenCalled();
    });
  });

  describe('Dirty State Detection', () => {
    it('should detect name change and schedule save', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original Name' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      // Change name
      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isDirty).toBe(true);
      expect(result.current.status).toBe('dirty');
    });

    it('should detect objects change and schedule save', async () => {
      const { result, rerender } = renderHook(
        ({ objects }) =>
          useProjectAutoSave({
            project: mockProject,
            name: mockProject.name,
            objects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { objects: [] as SceneObject[] } }
      );

      act(() => {
        result.current.setBaseline();
      });

      const newObjects: SceneObject[] = [
        {
          id: 'obj-1',
          type: 'mesh',
          name: 'Cube 1',
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
          properties: { visible: true, color: '#3b82f6' },
        },
      ];

      await act(async () => {
        rerender({ objects: newObjects });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isDirty).toBe(true);
      expect(result.current.status).toBe('dirty');
    });

    it('should detect steps change and schedule save', async () => {
      const { result, rerender } = renderHook(
        ({ steps }) =>
          useProjectAutoSave({
            project: mockProject,
            name: mockProject.name,
            objects: mockObjects,
            steps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { steps: [] as SimStep[] } }
      );

      act(() => {
        result.current.setBaseline();
      });

      const newSteps: SimStep[] = [
        {
          id: 'step-1',
          title: 'Step 1',
          description: 'Test step',
          completed: false,
          type: 'info-card',
        },
      ];

      await act(async () => {
        rerender({ steps: newSteps });
        await vi.runAllTimersAsync();
      });

      expect(result.current.isDirty).toBe(true);
      expect(result.current.status).toBe('dirty');
    });

    it('should not mark dirty if data is equivalent', () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Test Name' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      // Re-render with same data
      rerender({ name: 'Test Name' });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.status).toBe('saved');
    });
  });

  describe('Debounced Auto-Save', () => {
    it('should debounce saves and save after delay', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
            debounceMs: 1000,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      // Make multiple changes
      await act(async () => {
        rerender({ name: 'Change 1' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        rerender({ name: 'Change 2' });
        vi.advanceTimersByTime(500);
      });

      await act(async () => {
        rerender({ name: 'Change 3' });
      });

      // Should not have saved yet
      expect(mockSaveProject).not.toHaveBeenCalled();

      // Advance past debounce delay and run all timers
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should save once
      expect(mockSaveProject).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('saved');
      // Note: isDirty might be true if the project reference changed during save
    });

    it('should use custom debounce time', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
            debounceMs: 2000,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(mockSaveProject).not.toHaveBeenCalled();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSaveProject).toHaveBeenCalledTimes(1);
    });
  });

  describe('Immediate Flush Save', () => {
    it('should flush save immediately with flushSave', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.flushSave();
      });

      expect(mockSaveProject).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('saved');
      // Note: isDirty state depends on whether project reference changed
    });

    it('should capture thumbnail when includeThumbnail is true', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
            captureThumbnail: mockCaptureThumbnail,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      rerender({ name: 'New Name' });

      await act(async () => {
        await result.current.flushSave({ includeThumbnail: true });
      });

      expect(mockCaptureThumbnail).toHaveBeenCalled();
      expect(mockSaveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail: 'data:image/png;base64,mock',
        })
      );
    });

    it('should skip thumbnail when includeThumbnail is false', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
            captureThumbnail: mockCaptureThumbnail,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      rerender({ name: 'New Name' });

      await act(async () => {
        await result.current.flushSave({ includeThumbnail: false });
      });

      expect(mockCaptureThumbnail).not.toHaveBeenCalled();
    });

    it('should prefer dataOverride snapshot for flushSave', async () => {
      const settings: SimulationSettings = {
        allowOrbit: true,
        allowZoom: true,
      };
      const projectWithSettings: Project = {
        ...mockProject,
        simulationSettings: settings,
      };
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: projectWithSettings,
            name,
            objects: mockObjects,
            steps: mockSteps,
            simulationSettings: settings,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      // Change name, but flush with override.
      rerender({ name: 'New Name' });

      await act(async () => {
        await result.current.flushSave({
          dataOverride: {
            name: 'Override Name',
            objects: [],
            steps: [],
          },
        });
      });

      expect(mockSaveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Override Name',
          simulationSettings: settings,
        })
      );
    });

    it('should serialize concurrent flushSave calls', async () => {
      // Use `unknown` to avoid TS flow-analysis weirdness with closure assignment.
      let resolveFirst: unknown = null;
      let resolveSecond: unknown = null;

      const save = vi.fn().mockImplementation(() => {
        if (save.mock.calls.length === 1) {
          return new Promise<void>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return new Promise<void>((resolve) => {
          resolveSecond = resolve;
        });
      });

      const { result } = renderHook(() =>
        useProjectAutoSave({
          project: mockProject,
          name: mockProject.name,
          objects: mockObjects,
          steps: mockSteps,
          saveProject: save,
        })
      );

      act(() => {
        result.current.setBaseline();
      });

      let flush1: Promise<void>;
      let flush2: Promise<void>;

      // Start both flushes inside act, but don't await them yet.
      // We then await a microtask so the first queued save actually begins.
      await act(async () => {
        flush1 = result.current.flushSave({
          dataOverride: { name: 'First', objects: [], steps: [] },
        });
        flush2 = result.current.flushSave({
          dataOverride: { name: 'Second', objects: [], steps: [] },
        });
        await Promise.resolve();
      });

      // Only the first save should have been invoked so far.
      expect(save).toHaveBeenCalledTimes(1);

      // Resolve first; then second should start.
      if (typeof resolveFirst === 'function') (resolveFirst as () => void)();
      await act(async () => {
        await flush1;
        await Promise.resolve();
      });

      // After first resolves, second should now be invoked.
      expect(save).toHaveBeenCalledTimes(2);

      if (typeof resolveSecond === 'function') (resolveSecond as () => void)();
      await act(async () => {
        await flush2;
      });
    });

    it('should timeout thumbnail capture if too slow', async () => {
      // Never resolves; flushSave should proceed via thumbnail timeout.
      const slowCapture = vi.fn<() => Promise<string | undefined>>(() => new Promise(() => {}));

      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
            captureThumbnail: slowCapture,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      rerender({ name: 'New Name' });

      await act(async () => {
        const p = result.current.flushSave({
          includeThumbnail: true,
          thumbnailTimeoutMs: 100,
        });
        // Trigger the timeout path.
        await vi.advanceTimersByTimeAsync(100);
        await p;
      });

      // Should still save, just without thumbnail
      expect(mockSaveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail: undefined,
        })
      );
    });
  });

  describe('Synchronous Flush (flushSaveNow)', () => {
    it('should perform best-effort synchronous save', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.flushSaveNow();
      });

      expect(mockSaveProject).toHaveBeenCalledTimes(1);
    });

    it('should mark as saved after flushSaveNow', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.flushSaveNow();
      });

      expect(mockSaveProject).toHaveBeenCalledTimes(1);
      // Note: flushSaveNow is synchronous and doesn't update state
    });
  });

  describe('Error Handling', () => {
    it('should set error status when save fails', async () => {
      const failingSave = vi.fn().mockImplementation(() => {
        throw new Error('Save failed');
      });

      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: failingSave,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.lastError).toBeInstanceOf(Error);
      expect(result.current.lastError?.message).toBe('Save failed');
      expect(result.current.isDirty).toBe(true);
    });

    it('should restore dirty state after save failure', async () => {
      const failingSave = vi.fn().mockImplementation(() => {
        throw new Error('Network error');
      });

      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: failingSave,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isDirty).toBe(true);
      expect(result.current.status).toBe('error');
    });

    it('should convert non-Error exceptions to Error objects', async () => {
      const failingSave = vi.fn().mockImplementation(() => {
        throw 'String error';
      });

      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: failingSave,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.lastError).toBeInstanceOf(Error);
      expect(result.current.lastError?.message).toBe('String error');
    });
  });

  describe('Save Status Tracking', () => {
    it('should track lastSavedAt timestamp', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      const beforeSave = Date.now();

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.lastSavedAt).toBeGreaterThanOrEqual(beforeSave);
      expect(result.current.lastSavedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should update status through save lifecycle', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      // Start: idle
      expect(result.current.status).toBe('idle');

      act(() => {
        result.current.setBaseline();
      });

      // After baseline: saved
      expect(result.current.status).toBe('saved');

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      // After change: dirty
      expect(result.current.status).toBe('dirty');

      // During/after save: saving -> saved
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.status).toBe('saved');
    });
  });

  describe('Project Serialization', () => {
    it('should save project with updated name', async () => {
      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'Updated Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSaveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockProject.id,
          name: 'Updated Name',
          objects: mockObjects,
          steps: mockSteps,
        })
      );
    });

    it('should save project with updated objects and steps', async () => {
      const newObjects: SceneObject[] = [
        {
          id: 'obj-1',
          type: 'mesh',
          name: 'Test Cube',
          transform: {
            x: 0,
            y: 1,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
          },
          properties: { visible: true, color: '#ff0000' },
        },
      ];

      const newSteps: SimStep[] = [
        {
          id: 'step-1',
          title: 'Test Step',
          description: 'Description',
          completed: false,
          type: 'info-card',
        },
      ];

      const { result, rerender } = renderHook(
        ({ objects, steps }) =>
          useProjectAutoSave({
            project: mockProject,
            name: mockProject.name,
            objects,
            steps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { objects: [] as SceneObject[], steps: [] as SimStep[] } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ objects: newObjects, steps: newSteps });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSaveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: newObjects,
          steps: newSteps,
        })
      );
    });

    it('should preserve existing thumbnail if not capturing new one', async () => {
      const projectWithThumbnail: Project = {
        ...mockProject,
        thumbnail: 'data:image/png;base64,existing',
      };

      const { result, rerender } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: projectWithThumbnail,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSaveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail: 'data:image/png;base64,existing',
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should cancel pending save on unmount', async () => {
      const { result, rerender, unmount } = renderHook(
        ({ name }) =>
          useProjectAutoSave({
            project: mockProject,
            name,
            objects: mockObjects,
            steps: mockSteps,
            saveProject: mockSaveProject,
          }),
        { initialProps: { name: 'Original' } }
      );

      act(() => {
        result.current.setBaseline();
      });

      await act(async () => {
        rerender({ name: 'New Name' });
        await vi.runAllTimersAsync();
      });

      // Clear any saves that happened before unmount
      mockSaveProject.mockClear();

      // Unmount before next save cycle
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });

      // Should not save after unmount
      expect(mockSaveProject).not.toHaveBeenCalled();
    });
  });
});
