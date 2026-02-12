import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PublishedSimulationPage } from './PublishedSimulationPage';
import { PopupProvider } from '../contexts/PopupContext';
import type { Project } from '../types/project';
import { fetchPublishedSnapshotByToken } from '../services/publishService';

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

// Mock useProjects
const mockGetProject = vi.fn();
const mockUseProjects = {
  getProject: mockGetProject,
  isLoading: false,
};

vi.mock('../hooks/useProjects', () => ({
  useProjects: () => mockUseProjects,
}));

const mockProject: Project = {
  id: 'test-project',
  name: 'Test Published Simulation',
  objects: [],
  steps: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderWithContext(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      <PopupProvider>{ui}</PopupProvider>
    </BrowserRouter>
  );
}

describe('PublishedSimulationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('projectId');
    mockSearchParams.delete('token');
    mockUseProjects.isLoading = false;
    mockFetchPublishedSnapshotByToken.mockResolvedValue(null);
  });

  it('shows loading state initially', () => {
    mockUseProjects.isLoading = true;
    renderWithContext(<PublishedSimulationPage />);
    expect(screen.getByText(/loading published simulation/i)).toBeInTheDocument();
  });

  it('shows error when projectId is missing', async () => {
    // Don't set projectId in search params
    renderWithContext(<PublishedSimulationPage />);
    expect(await screen.findByText(/invalid published link/i)).toBeInTheDocument();
    expect(screen.getByText(/this link is missing a token/i)).toBeInTheDocument();
  });

  it('shows error when project is not found', async () => {
    mockSearchParams.set('projectId', 'nonexistent-project');
    mockGetProject.mockResolvedValue(undefined);

    renderWithContext(<PublishedSimulationPage />);

    expect(await screen.findByText(/simulation.*available/i)).toBeInTheDocument();
  });

  it('renders simulation when project is found', async () => {
    mockSearchParams.set('projectId', 'test-project');
    mockGetProject.mockResolvedValue(mockProject);

    renderWithContext(<PublishedSimulationPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading published simulation/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/invalid published link/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/available/i)).not.toBeInTheDocument();
  });

  it('displays branding badge', async () => {
    mockSearchParams.set('projectId', 'test-project');
    mockGetProject.mockResolvedValue(mockProject);

    renderWithContext(<PublishedSimulationPage />);

    expect(await screen.findByText(/powered by facilitate/i)).toBeInTheDocument();
  });

  it('does not show exit button in published view', async () => {
    mockSearchParams.set('projectId', 'test-project');
    mockGetProject.mockResolvedValue(mockProject);

    renderWithContext(<PublishedSimulationPage />);

    // Exit button should not be present (unlike PreviewPage)
    await waitFor(() => {
      expect(screen.queryByText(/loading published simulation/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /exit/i })).not.toBeInTheDocument();
  });

  it('shows invalid link when token does not resolve', async () => {
    mockSearchParams.set('token', 'token-123');
    mockFetchPublishedSnapshotByToken.mockResolvedValue(null);

    renderWithContext(<PublishedSimulationPage />);

    expect(await screen.findByText(/invalid published link/i)).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.queryByText(/loading published simulation/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/invalid published link/i)).not.toBeInTheDocument();
  });
});
