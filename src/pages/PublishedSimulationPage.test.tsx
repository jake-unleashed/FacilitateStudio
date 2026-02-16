import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { PublishedSimulationPage } from './PublishedSimulationPage';
import { PopupProvider } from '../contexts/PopupContext';
import { fetchPublishedSnapshotByToken } from '../services/publishService';
import type { PublishedSnapshot } from '../types/publish';

vi.mock('../services/publishService', () => ({
  fetchPublishedSnapshotByToken: vi.fn(),
}));

vi.mock('../utils/modelCache', () => ({
  setAssetResolver: vi.fn(),
  clearAssetResolver: vi.fn(),
}));

vi.mock('../utils/starterAssets/seedStarterAssets', () => ({
  shouldReseedLibrary: () => false,
  seedStarterAssets: vi.fn(),
}));

const mockFetchPublishedSnapshotByToken = vi.mocked(fetchPublishedSnapshotByToken);

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
});
