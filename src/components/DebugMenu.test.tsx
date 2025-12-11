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

    it('renders in closed state by default', () => {
      render(<DebugMenu {...defaultProps} />);
      // Panel wrapper should have opacity-0 class when closed
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-0');
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

      // Panel wrapper should have opacity-100 class when open
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-100');
    });

    it('closes panel when toggle button is clicked again', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });

      // Open
      fireEvent.click(toggleButton);
      // Close
      fireEvent.click(toggleButton);

      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-0');
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
    it('displays Debug Tools heading', () => {
      render(<DebugMenu {...defaultProps} />);
      expect(screen.getByRole('heading', { name: 'Debug Tools' })).toBeInTheDocument();
    });

    it('displays Add Objects section label', () => {
      render(<DebugMenu {...defaultProps} />);
      expect(screen.getByText('Add Objects')).toBeInTheDocument();
    });

    it('displays Add Cube button', () => {
      render(<DebugMenu {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Add Cube/i })).toBeInTheDocument();
    });
  });

  describe('Add Cube functionality', () => {
    it('calls onAddCube when Add Cube button is clicked', () => {
      const onAddCube = vi.fn();
      render(<DebugMenu {...defaultProps} onAddCube={onAddCube} />);

      // Open panel first
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      // Click Add Cube
      fireEvent.click(screen.getByRole('button', { name: /Add Cube/i }));

      expect(onAddCube).toHaveBeenCalledTimes(1);
    });

    it('can add multiple cubes with multiple clicks', () => {
      const onAddCube = vi.fn();
      render(<DebugMenu {...defaultProps} onAddCube={onAddCube} />);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));
      fireEvent.click(screen.getByRole('button', { name: /Add Cube/i }));
      fireEvent.click(screen.getByRole('button', { name: /Add Cube/i }));
      fireEvent.click(screen.getByRole('button', { name: /Add Cube/i }));

      expect(onAddCube).toHaveBeenCalledTimes(3);
    });
  });

  describe('auto-close behavior', () => {
    it('closes when hasSelectedObject transitions from false to true', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} hasSelectedObject={false} />);

      // Open the menu
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      // Verify it's open
      let panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-100');

      // Simulate object selection (hasSelectedObject becomes true)
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Menu should now be closed
      panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-0');
    });

    it('does not close when hasSelectedObject is already true and menu is opened', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Open the menu while object is already selected
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      // Menu should remain open (prevHasSelectedObject was already true)
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-100');

      // Rerender with same prop - should stay open
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);
      expect(panelWrapper).toHaveClass('opacity-100');
    });

    it('allows reopening menu after auto-close', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} hasSelectedObject={false} />);

      // Open menu
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      // Trigger auto-close
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Verify closed
      let panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-0');

      // Reopen menu - should work now since hasSelectedObject didn't change
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-100');
    });

    it('does not close when hasSelectedObject transitions from true to false', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Open menu
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      // Deselect object
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={false} />);

      // Menu should stay open
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-100');
    });

    it('remains closed if not open when object is selected', () => {
      const { rerender } = render(<DebugMenu {...defaultProps} hasSelectedObject={false} />);

      // Don't open the menu

      // Simulate object selection
      rerender(<DebugMenu {...defaultProps} hasSelectedObject={true} />);

      // Menu should still be closed
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('opacity-0');
    });
  });

  describe('styling', () => {
    it('has glass panel styling', () => {
      render(<DebugMenu {...defaultProps} />);
      const panel = screen.getByTestId('debug-panel');
      expect(panel).toHaveClass('rounded-[32px]');
      expect(panel).toHaveClass('bg-white/70');
      expect(panel).toHaveClass('backdrop-blur-xl');
    });

    it('has correct z-index for floating UI', () => {
      const { container } = render(<DebugMenu {...defaultProps} />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('z-50');
    });

    it('is positioned in top-right corner', () => {
      const { container } = render(<DebugMenu {...defaultProps} />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('right-4');
      expect(wrapper).toHaveClass('top-4');
    });

    it('has pointer-events-none on wrapper for click-through', () => {
      const { container } = render(<DebugMenu {...defaultProps} />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('pointer-events-none');
    });

    it('has pointer-events-auto on interactive elements', () => {
      render(<DebugMenu {...defaultProps} />);
      const toggleButton = screen.getByRole('button', { name: 'Toggle debug menu' });
      expect(toggleButton).toHaveClass('pointer-events-auto');
    });
  });

  describe('animations', () => {
    it('has smooth transition on panel wrapper', () => {
      render(<DebugMenu {...defaultProps} />);
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('transition-all');
      expect(panelWrapper).toHaveClass('duration-300');
    });

    it('has scale transform when closed', () => {
      render(<DebugMenu {...defaultProps} />);
      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('scale-95');
    });

    it('has full scale when open', () => {
      render(<DebugMenu {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Toggle debug menu' }));

      const panelWrapper = screen.getByTestId('debug-panel-wrapper');
      expect(panelWrapper).toHaveClass('scale-100');
    });
  });
});
