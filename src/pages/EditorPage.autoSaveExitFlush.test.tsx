import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditorPage } from './EditorPage';

// -------- Mocks --------

const saveProjectMock = vi.fn().mockResolvedValue(undefined);
const captureThumbnailMock = vi.fn();

vi.mock('../hooks/useProjects', () => {
  return {
    useProjects: () => ({
      getProject: (id: string) => ({
        id,
        name: 'Test Project',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        thumbnail: 'old-thumb',
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

vi.mock('../utils/starterAssets/seedStarterAssets', () => ({
  seedStarterAssets: vi.fn().mockResolvedValue(0),
  shouldReseedLibrary: vi.fn().mockReturnValue(false),
  getStarterAssetIds: vi.fn().mockReturnValue([]),
  STARTER_LIBRARY_VERSION: '4',
}));

// Minimal Home stub so we can assert navigation occurred.
function HomeStub() {
  return <div data-testid="home-page">Home</div>;
}

// Mock MainCanvas to allow deterministic object edits and canvas setup.
vi.mock('../components/MainCanvas', () => {
  const MockMainCanvas = (props: {
    objects: Array<{ id: string; name: string; transform: Record<string, unknown> }>;
    onUpdateObject: (obj: unknown) => void;
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  }) => {
    const { objects, onUpdateObject, onCanvasReady } = props;
    const first = objects[0];
    return (
      <div data-testid="mock-main-canvas">
        <button
          onClick={() => {
            onCanvasReady?.(document.createElement('canvas'));
          }}
        >
          Set Canvas
        </button>
        <button
          onClick={() => {
            if (!first) return;
            onUpdateObject({ ...first, name: `${first.name} Updated` });
          }}
        >
          Update First
        </button>
      </div>
    );
  };
  return { MainCanvas: MockMainCanvas };
});

// Keep other heavy components light.
vi.mock('../components/LeftSidebar', () => {
  const LeftSidebar = React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(
      ref,
      () => ({
        flushPendingEdits: () => {},
      }),
      []
    );
    return null;
  });
  LeftSidebar.displayName = 'MockLeftSidebar';
  return { LeftSidebar };
});
vi.mock('../components/RightSidebar', () => ({ RightSidebar: () => null }));
vi.mock('../components/NavigationHelp', () => ({ NavigationHelp: () => null }));
vi.mock('../components/CameraResetButton', () => ({ CameraResetButton: () => null }));
vi.mock('../components/DebugMenu', () => ({ DebugMenu: () => null }));

describe('EditorPage exit flush (Home click)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureThumbnailMock.mockResolvedValue('data:image/png;base64,newthumb');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes latest changes and attempts thumbnail capture before navigating Home', async () => {
    render(
      <MemoryRouter initialEntries={['/editor/test-id']}>
        <Routes>
          <Route path="/" element={<HomeStub />} />
          <Route path="/editor/:id" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for editor to mount.
    await screen.findByTestId('mock-main-canvas');

    // Set canvas to allow thumbnail capture.
    fireEvent.click(screen.getByRole('button', { name: 'Set Canvas' }));

    // Make a change (dirty).
    fireEvent.click(screen.getByRole('button', { name: 'Update First' }));

    // Click the Home logo button (it has title="Back to Home").
    fireEvent.click(screen.getByTitle('Back to Home'));

    // Save should have been called, and capture attempted.
    // Thumbnail capture is time-boxed; in this test it resolves quickly.
    await waitFor(() => {
      expect(captureThumbnailMock).toHaveBeenCalledTimes(1);
    });

    // Wait for navigation.
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();

    // Verify we saved the updated object name and thumbnail.
    const lastCall = saveProjectMock.mock.calls.at(-1)?.[0];
    expect(lastCall.objects[0].name).toBe('Cube 1 Updated');
    expect(lastCall.thumbnail).toBe('data:image/png;base64,newthumb');
  });
});
