import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('App', () => {
  it('renders the main application', () => {
    render(<App />);
    expect(screen.getByText('Facilitate')).toBeInTheDocument();
    expect(screen.getByText('Studio')).toBeInTheDocument();
  });

  it('renders the top bar with default simulation title', () => {
    render(<App />);
    expect(screen.getByText('New Simulation')).toBeInTheDocument();
  });

  it('renders the left sidebar navigation', () => {
    render(<App />);
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
  });

  it('renders the mocked canvas', () => {
    render(<App />);
    expect(screen.getByTestId('main-canvas')).toBeInTheDocument();
  });

  it('renders navigation help button', () => {
    render(<App />);
    expect(screen.getByLabelText('Open Navigation Help')).toBeInTheDocument();
  });

  it('opens Objects panel when Objects button is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Scene Objects')).toBeInTheDocument();
  });

  it('opens Steps panel when Steps button is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Steps'));
    expect(screen.getByText('Training Flow')).toBeInTheDocument();
  });

  it('opens Add panel when Add button is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('shows right sidebar when object is selected', async () => {
    render(<App />);

    // Select an object via the mocked canvas
    fireEvent.click(screen.getByTestId('select-obj-1'));

    // Wait for state update
    await waitFor(() => {
      expect(screen.getByText('Object Details')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Primary Cube')).toBeInTheDocument();
  });

  it('hides right sidebar when object is deselected', async () => {
    render(<App />);

    // Select an object
    fireEvent.click(screen.getByTestId('select-obj-1'));
    await waitFor(() => {
      expect(screen.getByText('Object Details')).toBeInTheDocument();
    });

    // Deselect by clicking canvas
    fireEvent.click(screen.getByTestId('main-canvas'));

    // Right sidebar should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Object Details')).not.toBeInTheDocument();
    });
  });

  it('can delete an object', async () => {
    render(<App />);

    // Open Objects panel and verify initial count
    fireEvent.click(screen.getByText('Objects'));
    expect(screen.getByText('Primary Cube')).toBeInTheDocument();

    // Select an object via the left sidebar
    fireEvent.click(screen.getByText('Primary Cube'));

    // Wait for sidebar to appear
    await waitFor(() => {
      expect(screen.getByText('Object Details')).toBeInTheDocument();
    });

    // Delete the object
    fireEvent.click(screen.getByText('Delete'));

    // Object should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('Primary Cube')).not.toBeInTheDocument();
    });
  });

  it('updates simulation title', async () => {
    const user = userEvent.setup();
    render(<App />);

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

  it('can update object properties', async () => {
    render(<App />);

    // Open objects panel first
    fireEvent.click(screen.getByText('Objects'));

    // Select an object via the objects list
    fireEvent.click(screen.getByText('Primary Cube'));

    // Wait for sidebar
    await waitFor(() => {
      expect(screen.getByText('Object Details')).toBeInTheDocument();
    });

    // Change the name
    const nameInput = screen.getByDisplayValue('Primary Cube');
    fireEvent.change(nameInput, { target: { value: 'Renamed Cube' } });

    // Check that the name was updated in the objects list
    expect(screen.getByText('Renamed Cube')).toBeInTheDocument();
  });

  it('closes right sidebar when close button is clicked', async () => {
    render(<App />);

    // Open objects panel and select an object
    fireEvent.click(screen.getByText('Objects'));
    fireEvent.click(screen.getByText('Primary Cube'));

    await waitFor(() => {
      expect(screen.getByText('Object Details')).toBeInTheDocument();
    });

    // Close via close button
    fireEvent.click(screen.getByLabelText('Close'));

    // Right sidebar should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Object Details')).not.toBeInTheDocument();
    });
  });

  it('renders Preview and Publish buttons', () => {
    render(<App />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('shows steps in the Steps panel', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Steps'));

    expect(screen.getByText('Locate and verify power supply.')).toBeInTheDocument();
    expect(screen.getByText('Ensure all safety barriers are in place.')).toBeInTheDocument();
    expect(screen.getByText('Turn on the main industrial pump.')).toBeInTheDocument();
    expect(screen.getByText('Wait for pressure to stabilize.')).toBeInTheDocument();
  });
});
