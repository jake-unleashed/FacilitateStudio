import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugMenu } from './DebugMenu';

describe('DebugMenu', () => {
  const defaultProps = {
    onAddCube: vi.fn(),
    hasSelectedObject: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the toggle button with bug icon', () => {
      render(<DebugMenu {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Toggle debug menu' })).toBeInTheDocument();
    });

    it('does not render panel when closed by default', () => {
      render(<DebugMenu {...defaultProps} />);
      // Panel should not be rendered when closed
      expect(screen.queryByTestId('debug-panel-wrapper')).not.toBeInTheDocument();
    });

    it('has correct accessibility label on toggle button', () => {
      render(<DebugMenu {...defaultProps} />);
      const button = screen.getByLabelText('Toggle debug menu');
      expect(button).toBeInTheDocument();
    });
  });

  describe('toggle behavior', () => {
    it('opens panel when toggle button is clicked', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      fireEvent.click(toggleButton);

      // Panel should be rendered when open
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();
    });

    it('closes panel when toggle button is clicked again', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      // Open
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();

      // Close
      fireEvent.click(toggleButton);
      expect(screen.queryByTestId('debug-panel-wrapper')).not.toBeInTheDocument();
    });

    it('applies active styling to toggle button when open', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      fireEvent.click(toggleButton);

      expect(toggleButton).toHaveClass('border-slate-300');
      expect(toggleButton).toHaveClass('bg-white/80');
    });

    it('applies inactive styling to toggle button when closed', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      expect(toggleButton).toHaveClass('border-white/40');
      expect(toggleButton).toHaveClass('bg-white/50');
    });
  });

  describe('panel content', () => {
    it('displays Debug Tools heading when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      expect(screen.getByRole('heading', { name: 'Debug Tools' })).toBeInTheDocument();
    });

    it('displays Add Objects section label when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      expect(screen.getByText('Add Objects')).toBeInTheDocument();
    });

    it('displays Add Cube button when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      expect(screen.getByRole('button', { name: /Add Cube/i })).toBeInTheDocument();
    });
  });

  describe('Add Cube functionality', () => {
    it('calls onAddCube when Add Cube button is clicked', () => {
      const onAddCube = vi.fn();
      render(<DebugMenu {...defaultProps} onAddCube={onAddCube} />);

      // Open menu first
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      // Click Add Cube
      fireEvent.click(screen.getByRole('button', { name: /Add Cube/i }));

      expect(onAddCube).toHaveBeenCalledTimes(1);
    });

    it('calls onAddCube handler', () => {
      const onAddCube = vi.fn();
      render(<DebugMenu {...defaultProps} onAddCube={onAddCube} />);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      fireEvent.click(screen.getByRole('button', { name: /Add Cube/i }));

      expect(onAddCube).toHaveBeenCalled();
    });

    it('allows multiple cube additions', () => {
      const onAddCube = vi.fn();
      render(<DebugMenu {...defaultProps} onAddCube={onAddCube} />);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      const addButton = screen.getByRole('button', { name: /Add Cube/i });

      fireEvent.click(addButton);
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      expect(onAddCube).toHaveBeenCalledTimes(3);
    });
  });

  describe('auto-close behavior', () => {
    it('closes when hasSelectedObject transitions from false to true', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      // Open menu
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();

      // Simulate object selection
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Panel should be closed (not rendered)
      expect(screen.queryByTestId('debug-panel-wrapper')).not.toBeInTheDocument();
    });

    it('does not close when hasSelectedObject is already true and menu is opened', () => {
      render(<DebugMenu {...defaultProps} hasSelectedObject={true} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      // Open menu when object is already selected
      fireEvent.click(toggleButton);

      // Panel should remain open
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();
    });

    it('allows reopening menu after auto-close', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      // Open and auto-close
      fireEvent.click(toggleButton);
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);
      expect(screen.queryByTestId('debug-panel-wrapper')).not.toBeInTheDocument();

      // Reopen
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();
    });

    it('does not close when hasSelectedObject transitions from true to false', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} hasSelectedObject={true} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      // Open menu
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();

      // Deselect object
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={false} />);

      // Panel should remain open
      expect(screen.getByTestId('debug-panel-wrapper')).toBeInTheDocument();
    });

    it('remains closed if not open when object is selected', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} />);

      // Menu is closed, select object
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Panel should still not be rendered
      expect(screen.queryByTestId('debug-panel-wrapper')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has glass panel styling when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      const panel = screen.getByTestId('debug-panel');
      expect(panel).toHaveClass('bg-white/70');
      expect(panel).toHaveClass('backdrop-blur-xl');
      expect(panel).toHaveClass('rounded-[32px]');
    });

    it('toggle button has proper rounded styling', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });
      expect(toggleButton).toHaveClass('rounded-[20px]');
    });
  });

  describe('animations', () => {
    it('has animation classes on panel wrapper when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('animate-in');
      expect(panelWrapper).toHaveClass('fade-in');
    });
  });

  describe('z-index layering', () => {
    it('has z-index higher than other UI panels to appear on top', () => {
      const { container } = render(<DebugMenu {...defaultProps} />);
      const outerDiv = container.firstChild as HTMLElement;
      // z-[100] ensures debug menu appears above RightSidebar (z-[60]) and TopBar (z-50)
      expect(outerDiv).toHaveClass('z-[100]');
    });
  });

  describe('pointer events', () => {
    it('outer container has pointer-events-none to allow 3D interaction', () => {
      const { container } = render(<DebugMenu {...defaultProps} />);
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('pointer-events-none');
    });

    it('toggle button has pointer-events-auto', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });
      expect(toggleButton).toHaveClass('pointer-events-auto');
    });

    it('panel wrapper has pointer-events-auto when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('pointer-events-auto');
    });
  });
});
