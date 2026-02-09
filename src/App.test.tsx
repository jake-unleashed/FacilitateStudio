import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const WELCOME_TIMEOUT_MS = 6000;

// Mock the MainCanvas component since Three.js doesn't work in jsdom
vi.mock('./components/MainCanvas', () => ({
  MainCanvas: ({
    objects,
    onSelectObject,
    selectedObjectId,
    onCanvasReady,
    onFirstFrame,
  }: {
    objects: { id: string; name: string }[];
    selectedObjectId: string | null;
    onSelectObject: (id: string | null) => void;
    onUpdateObject: (obj: unknown) => void;
    onCameraControlsReady?: (controls: unknown) => void;
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
    onFirstFrame?: () => void;
    disableNavigation?: boolean;
  }) => {
    React.useEffect(() => {
      onCanvasReady?.(document.createElement('canvas'));
      onFirstFrame?.();
    }, [onCanvasReady, onFirstFrame]);

    return (
      <div data-testid="main-canvas" onClick={() => onSelectObject(null)}>
        {objects.map((obj) => (
          <button
            key={obj.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectObject(obj.id);
            }}
            data-testid={`select-${obj.id}`}
          >
            Select {obj.name}
          </button>
        ))}
        <span data-testid="selected-id">{selectedObjectId || 'none'}</span>
      </div>
    );
  },
}));

// Mock useProjects hook for EditorPage
vi.mock('./hooks/useProjects', () => ({
  useProjects: () => ({
    getProjectMetadata: () => [],
    getProject: () => undefined,
    deleteProject: vi.fn(),
    saveProject: vi.fn(),
    createProject: (name: string) => ({
      id: 'test-project-id',
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      objects: [],
      steps: [],
    }),
    isLoading: false,
  }),
}));

// Helper to render App with router context at the editor route
function renderApp(initialEntries: string[] = ['/editor']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  );
}

async function chooseStartFromScratch() {
  const user = userEvent.setup();
  const startButton = await screen.findByRole(
    'button',
    { name: /start from scratch/i },
    { timeout: WELCOME_TIMEOUT_MS }
  );
  await user.click(startButton);
  return user;
}

async function chooseGuidedSetup() {
  const user = userEvent.setup();
  // Disambiguate from the backdrop "Close guided setup modal" button
  const guidedButton = await screen.findByRole(
    'button',
    { name: /guided setup.*recommended/i },
    { timeout: WELCOME_TIMEOUT_MS }
  );
  await user.click(guidedButton);
  return user;
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Keep App tests snappy: treat reduced motion as enabled so visual transitions don't add delays.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('shows the guided setup welcome modal for new projects', async () => {
    renderApp();
    expect(
      await screen.findByText('Create Your Simulation', {}, { timeout: WELCOME_TIMEOUT_MS })
    ).toBeInTheDocument();
    // Editor chrome should be gated while welcome is shown
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  });

  it('shows step creation content when guided setup is selected', async () => {
    renderApp();
    await chooseGuidedSetup();
    expect(screen.getByText(/^add steps$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload an sop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add steps manually/i })).toBeInTheDocument();
  });

  it('disables Continue until at least one step exists', async () => {
    renderApp();
    const user = await chooseGuidedSetup();

    // Choice mode has no Continue button
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add steps manually/i }));

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    const titleInput = screen.getByLabelText(/new step title/i);
    await user.type(titleInput, 'Inspect workstation');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(continueButton).not.toBeDisabled();
  });

  it('starts progress indicator at step 1 during guided setup', async () => {
    renderApp();
    await chooseGuidedSetup();
    const progressbar = screen.getByRole('progressbar', { name: /setup progress/i });
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
  });

  it('renders the main application', async () => {
    renderApp();
    await chooseStartFromScratch();
    // Facilitate text appears twice in TopBar (gradient and solid overlay)
    const facilitateElements = screen.getAllByText('Facilitate');
    expect(facilitateElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Studio')).toBeInTheDocument();
  });

  it('renders the top bar with default simulation title', async () => {
    renderApp();
    await chooseStartFromScratch();
    expect(screen.getByText('New Simulation')).toBeInTheDocument();
  });

  it('renders the left sidebar navigation', async () => {
    renderApp();
    await chooseStartFromScratch();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
  });

  it('renders the mocked canvas', () => {
    renderApp();
    expect(screen.getByTestId('main-canvas')).toBeInTheDocument();
  });

  it('renders navigation help button', async () => {
    renderApp();
    await chooseStartFromScratch();
    expect(screen.getByLabelText('Open Navigation Help')).toBeInTheDocument();
  });

  it('opens Objects panel when Objects button is clicked', async () => {
    renderApp();
    await chooseStartFromScratch();
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Scene Objects')).toBeInTheDocument();
  });

  it('opens Steps panel when Steps button is clicked', async () => {
    renderApp();
    await chooseStartFromScratch();
    fireEvent.click(screen.getByText('Steps'));
    // The panel heading is "Steps", not "Training Flow"
    const stepsHeadings = screen.getAllByText('Steps');
    expect(stepsHeadings.length).toBeGreaterThan(0);
  });

  it('opens Add panel when Add button is clicked', async () => {
    renderApp();
    await chooseStartFromScratch();
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Add New')).toBeInTheDocument();
  });

  it('shows empty Objects panel for new project', async () => {
    renderApp();
    await chooseStartFromScratch();
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Scene Objects')).toBeInTheDocument();
    // No objects should be listed in empty project
    expect(screen.queryByRole('button', { name: /Select/ })).not.toBeInTheDocument();
  });

  it('shows empty Steps panel with Add Step button for new project', async () => {
    renderApp();
    await chooseStartFromScratch();
    fireEvent.click(screen.getByText('Steps'));
    // The panel heading is "Steps", not "Training Flow"
    const stepsHeadings = screen.getAllByText('Steps');
    expect(stepsHeadings.length).toBeGreaterThan(0);
    expect(screen.getByText('Add Step')).toBeInTheDocument();
  });

  it('shows Upload 3D Model option in Add panel', async () => {
    renderApp();
    await chooseStartFromScratch();
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
  });

  it('does not show right sidebar when no object is selected', async () => {
    renderApp();
    await chooseStartFromScratch();
    expect(screen.queryByText('Object Details')).not.toBeInTheDocument();
  });

  it('updates simulation title', async () => {
    renderApp();
    const user = await chooseStartFromScratch();

    // Click on title to edit
    await user.click(screen.getByText('New Simulation'));

    // Change the title
    const input = screen.getByDisplayValue('New Simulation');
    await user.clear(input);
    await user.type(input, 'My Training Sim');
    await user.keyboard('{Enter}');

    // Title should be updated
    expect(screen.getByText('My Training Sim')).toBeInTheDocument();
  });

  it('renders Preview and Publish buttons', async () => {
    renderApp();
    await chooseStartFromScratch();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('can close sidebar panels', async () => {
    renderApp();
    await chooseStartFromScratch();

    // Open Objects panel
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Scene Objects')).toBeInTheDocument();

    // Close it by clicking the same button again
    fireEvent.click(screen.getByText('Objects'));

    // Panel header should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText('Scene Objects')).not.toBeInTheDocument();
    });
  });
});
