import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ReactElement, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { PublishedSimulationPage } from './PublishedSimulationPage';
import { PopupProvider } from '../contexts/PopupContext';
import { fetchPublishedSnapshotByToken } from '../services/publishService';
import { frameShowcaseObjects } from '../utils/showcaseCamera';
import type { PublishedSnapshot } from '../types/publish';

vi.mock('../services/publishService', () => ({
  fetchPublishedSnapshotByToken: vi.fn(),
}));

vi.mock('../components/MainCanvas', () => ({
  MainCanvas: ({ onCameraControlsReady }: { onCameraControlsReady?: (controls: { setLookAt: () => void }) => void }) => {
    useEffect(() => {
      onCameraControlsReady?.({ setLookAt: vi.fn() });
    }, [onCameraControlsReady]);

    return <div>Main Canvas Mock</div>;
  },
}));

vi.mock('../components/preview/PreviewStepExecutor', () => ({
  PreviewStepExecutor: () => <div>Preview Step Executor Mock</div>,
}));

vi.mock('../utils/showcaseCamera', () => ({
  getShowcaseObjects: (objects: Array<{ properties?: { modelAssetId?: string } }>) =>
    objects.filter((object) => Boolean(object.properties?.modelAssetId)),
  frameShowcaseObjects: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/modelCache', () => ({
  setAssetResolver: vi.fn(),
  clearAssetResolver: vi.fn(),
}));

const mockFetchPublishedSnapshotByToken = vi.mocked(fetchPublishedSnapshotByToken);
const mockFrameShowcaseObjects = vi.mocked(frameShowcaseObjects);

// Mock useSearchParams
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

function renderWithContext(ui: ReactElement) {
  return render(
    <BrowserRouter>
      <PopupProvider>{ui}</PopupProvider>
    </BrowserRouter>
  );
}

describe('PublishedSimulationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('token');
    mockFetchPublishedSnapshotByToken.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows error when token is missing', async () => {
    renderWithContext(<PublishedSimulationPage />);
    expect(await screen.findByText(/invalid published link/i)).toBeInTheDocument();
    expect(screen.getByText(/this link is missing a token/i)).toBeInTheDocument();
  });

  it('renders simulation when token resolves to a snapshot', async () => {
    mockSearchParams.set('token', 'token-123');
    mockFetchPublishedSnapshotByToken.mockResolvedValue({
      name: 'Published Snapshot',
      objects: [],
      steps: [],
      assetManifest: {},
    });

    renderWithContext(<PublishedSimulationPage />);

    expect(screen.queryByText(/invalid published link/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/interactive training/i)).toBeInTheDocument();
    expect(await screen.findByText('Published Snapshot')).toBeInTheDocument();
    const startButton = await screen.findByRole('button', { name: /start/i });
    expect(startButton).not.toBeDisabled();
  });

  it('shows Powered by Facilitate on landing only', async () => {
    mockSearchParams.set('token', 'token-123');
    mockFetchPublishedSnapshotByToken.mockResolvedValue({
      name: 'Published Snapshot',
      objects: [],
      steps: [],
      assetManifest: {},
    });

    renderWithContext(<PublishedSimulationPage />);

    expect(await screen.findByText(/powered by facilitate/i)).toBeInTheDocument();

    const startButton = await screen.findByRole('button', { name: /start/i });
    // After starting, the landing footer should disappear.
    vi.useFakeTimers();
    await act(async () => {
      startButton.click();
      vi.advanceTimersByTime(600);
    });
    await act(async () => {
      // Flush any pending microtasks from state updates.
      await Promise.resolve();
    });
    expect(screen.queryByText(/powered by facilitate/i)).not.toBeInTheDocument();
  });

  it('does not show exit button in published view', async () => {
    mockSearchParams.set('token', 'token-123');
    mockFetchPublishedSnapshotByToken.mockResolvedValue({
      name: 'Published Snapshot',
      objects: [],
      steps: [],
      assetManifest: {},
    });

    renderWithContext(<PublishedSimulationPage />);
    expect(await screen.findByText(/interactive training/i)).toBeInTheDocument();

    // Exit button should not be present (unlike PreviewPage)
    expect(screen.queryByRole('button', { name: /exit/i })).not.toBeInTheDocument();
  });

  it('shows invalid link when token does not resolve', async () => {
    mockSearchParams.set('token', 'token-123');
    mockFetchPublishedSnapshotByToken.mockResolvedValue(null);

    renderWithContext(<PublishedSimulationPage />);

    expect(await screen.findByText(/invalid published link/i)).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
  });

  it('disables Start while loading, then enables after snapshot loads', async () => {
    mockSearchParams.set('token', 'token-123');

    let resolveSnapshot!: (value: PublishedSnapshot | null) => void;
    const deferred = new Promise<PublishedSnapshot | null>((resolve) => {
      resolveSnapshot = resolve;
    });
    mockFetchPublishedSnapshotByToken.mockReturnValue(deferred);

    renderWithContext(<PublishedSimulationPage />);

    const loadingButton = await screen.findByRole('button', { name: /loading/i });
    expect(loadingButton).toBeDisabled();

    await act(async () => {
      resolveSnapshot({
        name: 'Published Snapshot',
        objects: [],
        steps: [],
        assetManifest: {},
      });
    });

    const startButton = await screen.findByRole('button', { name: /start/i });
    expect(startButton).not.toBeDisabled();
  });

  it('opens model-only published showcases directly in the scene', async () => {
    mockSearchParams.set('token', 'token-123');
    mockFetchPublishedSnapshotByToken.mockResolvedValue({
      name: 'Showcase Snapshot',
      objects: [
        {
          id: 'obj-1',
          name: 'Model',
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
        },
      ],
      steps: [],
      assetManifest: {},
    });

    renderWithContext(<PublishedSimulationPage />);

    expect(await screen.findByText('Main Canvas Mock')).toBeInTheDocument();
    expect(screen.queryByText(/interactive training/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/powered by facilitate/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Preview Step Executor Mock')).not.toBeInTheDocument();
    expect(mockFrameShowcaseObjects).toHaveBeenCalledTimes(1);
  });
});
