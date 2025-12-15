import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditorPage } from './EditorPage';

// -------- Mocks --------

const saveProjectMock = vi.fn();
const captureThumbnailMock = vi.fn();

vi.mock('../hooks/useProjects', () => {
  return {
    useProjects: () => ({
      getProject: (id: string) => ({
        id,
        name: 'Test Project',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        thumbnail: undefined,
        steps: [],
        objects: [
          {
            id: 'obj-1',
            name: 'Cube 1',
            type: 'mesh',
            transform: {
              x: 0,
              y: 50,
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
        ],
      }),
      saveProject: saveProjectMock,
      createProject: (name: string) => ({
        id: 'new-project',
        name,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        thumbnail: undefined,
        steps: [],
        objects: [],
      }),
      isLoading: false,
    }),
  };
});

vi.mock('../utils/captureThumbnail', () => {
  return {
    captureThumbnail: (...args: unknown[]) => captureThumbnailMock(...args),
  };
});

// Mock heavy UI components we don't need for this behavior test
vi.mock('../components/TopBar', () => ({ TopBar: () => null }));
vi.mock('../components/LeftSidebar', () => ({ LeftSidebar: () => null }));
vi.mock('../components/NavigationHelp', () => ({ NavigationHelp: () => null }));
vi.mock('../components/CameraResetButton', () => ({ CameraResetButton: () => null }));
vi.mock('../components/DebugMenu', () => ({ DebugMenu: () => null }));

// Mock MainCanvas so we can deterministically select/update objects without Three.js
vi.mock('../components/MainCanvas', () => {
  const MockMainCanvas = (props: {
    objects: Array<{ id: string; name: string; transform: Record<string, unknown> }>;
    selectedObjectId: string | null;
    onSelectObject: (id: string | null) => void;
    onUpdateObject: (obj: unknown) => void;
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  }) => {
    const { objects, selectedObjectId, onSelectObject, onUpdateObject, onCanvasReady } = props;
    const first = objects[0];

    useEffect(() => {
      // Ensure autosave path that captures thumbnails is exercised.
      onCanvasReady?.(document.createElement('canvas'));
    }, [onCanvasReady]);

    return (
      <div data-testid="mock-main-canvas">
        <div data-testid="mock-selected">{selectedObjectId ?? 'none'}</div>
        <button onClick={() => onSelectObject(first?.id ?? null)}>Select First</button>
        <button
          onClick={() => {
            if (!first) return;
            onUpdateObject({
              ...first,
              name: `${first.name} Updated`,
            });
          }}
        >
          Update First
        </button>
      </div>
    );
  };

  return { MainCanvas: MockMainCanvas };
});

// -------- Tests --------

describe('EditorPage auto-save + selection stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureThumbnailMock.mockResolvedValue('data:image/png;base64,abc');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not clear selection during auto-save thumbnail capture (prevents RightSidebar flicker and preserves rotation axis state)', async () => {
    render(
      <MemoryRouter initialEntries={['/editor/test-id']}>
        <Routes>
          <Route path="/editor/:id" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initialization to complete (mock canvas renders only after loading state)
    await screen.findByTestId('mock-main-canvas');

    // Select the object so RightSidebar is mounted
    fireEvent.click(screen.getByRole('button', { name: 'Select First' }));
    expect(await screen.findByTestId('right-sidebar')).toBeInTheDocument();

    // Change axis to X (this state used to be lost due to unmount/remount every autosave)
    fireEvent.click(screen.getByTestId('axis-x-button'));
    expect(screen.getByTestId('axis-x-button')).toHaveAttribute('aria-pressed', 'true');

    // Switch to fake timers only after all Testing Library async queries are done.
    // This avoids deadlocks where `findBy*`/`waitFor` rely on timers.
    vi.useFakeTimers();

    // Trigger a change that causes auto-save (objects update)
    fireEvent.click(screen.getByRole('button', { name: 'Update First' }));

    // Auto-save is debounced by 1s
    await vi.advanceTimersByTimeAsync(1000);

    // Thumbnail capture happened, but selection should remain (sidebar stays mounted)
    expect(captureThumbnailMock).toHaveBeenCalledTimes(1);
    expect(saveProjectMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('axis-x-button')).toHaveAttribute('aria-pressed', 'true');
  });
});
