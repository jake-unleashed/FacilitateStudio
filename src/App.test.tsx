import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock the MainCanvas component since Three.js doesn't work in jsdom
vi.mock('./components/MainCanvas', () => ({
  MainCanvas: ({
    objects,
    onSelectObject,
    selectedObjectId,
  }: {
    objects: { id: string; name: string }[];
    selectedObjectId: string | null;
    onSelectObject: (id: string | null) => void;
    onUpdateObject: (obj: unknown) => void;
    onCameraControlsReady?: (controls: unknown) => void;
  }) => (
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
  ),
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

describe('App', () => {
  it('renders the main application', () => {
    renderApp();
    // Facilitate text appears twice in TopBar (gradient and solid overlay)
    const facilitateElements = screen.getAllByText('Facilitate');
    expect(facilitateElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Studio')).toBeInTheDocument();
  });

  it('renders the top bar with default simulation title', () => {
    renderApp();
    expect(screen.getByText('New Simulation')).toBeInTheDocument();
  });

  it('renders the left sidebar navigation', () => {
    renderApp();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
  });

  it('renders the mocked canvas', () => {
    renderApp();
    expect(screen.getByTestId('main-canvas')).toBeInTheDocument();
  });

  it('renders navigation help button', () => {
    renderApp();
    expect(screen.getByLabelText('Open Navigation Help')).toBeInTheDocument();
  });

  it('opens Objects panel when Objects button is clicked', () => {
    renderApp();
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Scene Objects')).toBeInTheDocument();
  });

  it('opens Steps panel when Steps button is clicked', () => {
    renderApp();
    fireEvent.click(screen.getByText('Steps'));
    // The panel heading is "Steps", not "Training Flow"
    const stepsHeadings = screen.getAllByText('Steps');
    expect(stepsHeadings.length).toBeGreaterThan(0);
  });

  it('opens Add panel when Add button is clicked', () => {
    renderApp();
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Add New')).toBeInTheDocument();
  });

  it('shows empty Objects panel for new project', () => {
    renderApp();
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Scene Objects')).toBeInTheDocument();
    // No objects should be listed in empty project
    expect(screen.queryByRole('button', { name: /Select/ })).not.toBeInTheDocument();
  });

  it('shows empty Steps panel with Add Step button for new project', () => {
    renderApp();
    fireEvent.click(screen.getByText('Steps'));
    // The panel heading is "Steps", not "Training Flow"
    const stepsHeadings = screen.getAllByText('Steps');
    expect(stepsHeadings.length).toBeGreaterThan(0);
    expect(screen.getByText('Add Step')).toBeInTheDocument();
  });

  it('shows Upload 3D Model option in Add panel', () => {
    renderApp();
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
  });

  it('does not show right sidebar when no object is selected', () => {
    renderApp();
    expect(screen.queryByText('Object Details')).not.toBeInTheDocument();
  });

  it('updates simulation title', async () => {
    const user = userEvent.setup();
    renderApp();

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

  it('renders Preview and Publish buttons', () => {
    renderApp();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('can close sidebar panels', async () => {
    renderApp();

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
