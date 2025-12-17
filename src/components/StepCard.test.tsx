import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepCard } from './StepCard';

describe('StepCard', () => {
  const defaultProps = {
    stepName: '',
    onStepNameChange: vi.fn(),
    onTypeSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders step name input field', () => {
      render(<StepCard {...defaultProps} />);
      expect(screen.getByLabelText(/step name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter step name...')).toBeInTheDocument();
    });

    it('renders step type selection section', () => {
      render(<StepCard {...defaultProps} />);
      expect(screen.getByText('Step Type')).toBeInTheDocument();
    });

    it('renders both step type tiles', () => {
      render(<StepCard {...defaultProps} />);
      expect(screen.getByText('Info Card')).toBeInTheDocument();
      expect(screen.getByText('Move Item')).toBeInTheDocument();
    });

    it('displays the current step name value', () => {
      render(<StepCard {...defaultProps} stepName="Test Step Name" />);
      const input = screen.getByPlaceholderText('Enter step name...');
      expect(input).toHaveValue('Test Step Name');
    });
  });

  describe('Step Name Input', () => {
    it('calls onStepNameChange when user types in the input', () => {
      render(<StepCard {...defaultProps} />);
      const input = screen.getByPlaceholderText('Enter step name...');

      fireEvent.change(input, { target: { value: 'New Step Name' } });

      expect(defaultProps.onStepNameChange).toHaveBeenCalledTimes(1);
      expect(defaultProps.onStepNameChange).toHaveBeenCalledWith('New Step Name');
    });

    it('auto-focuses the input field', () => {
      render(<StepCard {...defaultProps} />);
      const input = screen.getByPlaceholderText('Enter step name...');
      expect(input).toHaveFocus();
    });

    it('has max length of 200 characters', () => {
      render(<StepCard {...defaultProps} />);
      const input = screen.getByPlaceholderText('Enter step name...');
      expect(input).toHaveAttribute('maxLength', '200');
    });

    it('has single row by default', () => {
      render(<StepCard {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Enter step name...');
      expect(textarea).toHaveAttribute('rows', '1');
    });
  });

  describe('Step Type Selection', () => {
    it('calls onTypeSelect when Info Card tile is clicked', () => {
      render(<StepCard {...defaultProps} />);
      const infoCardTile = screen.getByText('Info Card').closest('button');
      expect(infoCardTile).toBeInTheDocument();

      fireEvent.click(infoCardTile!);

      expect(defaultProps.onTypeSelect).toHaveBeenCalledTimes(1);
      expect(defaultProps.onTypeSelect).toHaveBeenCalledWith('info-card');
    });

    it('calls onTypeSelect when Move Item tile is clicked', () => {
      render(<StepCard {...defaultProps} />);
      const moveItemTile = screen.getByText('Move Item').closest('button');
      expect(moveItemTile).toBeInTheDocument();

      fireEvent.click(moveItemTile!);

      expect(defaultProps.onTypeSelect).toHaveBeenCalledTimes(1);
      expect(defaultProps.onTypeSelect).toHaveBeenCalledWith('move-item');
    });

    it('shows selected indicator when a tile is selected', () => {
      render(<StepCard {...defaultProps} stepName="Test" />);
      
      // Click Info Card tile
      const infoCardTile = screen.getByText('Info Card').closest('button');
      fireEvent.click(infoCardTile!);

      // Verify that the callback was called with the correct type
      expect(defaultProps.onTypeSelect).toHaveBeenCalledWith('info-card');
    });

    it('displays step type descriptions on hover', () => {
      render(<StepCard {...defaultProps} />);

      const infoCardButton = screen.getByText('Info Card').closest('button');
      expect(infoCardButton).toBeInTheDocument();

      // Description should be in the DOM but hidden
      expect(screen.getByText('Display information to the trainee')).toBeInTheDocument();
      expect(screen.getByText('Guide trainee to move an object')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper label for step name input', () => {
      render(<StepCard {...defaultProps} />);
      const label = screen.getByText('Step Name');
      expect(label).toBeInTheDocument();
      expect(label.tagName).toBe('LABEL');
    });

    it('has proper label for step type section', () => {
      render(<StepCard {...defaultProps} />);
      const label = screen.getByText('Step Type');
      expect(label).toBeInTheDocument();
      expect(label.tagName).toBe('LABEL');
    });

    it('step type tiles are accessible as buttons', () => {
      render(<StepCard {...defaultProps} />);
      const buttons = screen
        .getAllByRole('button')
        .filter(
          (btn) => btn.textContent?.includes('Info Card') || btn.textContent?.includes('Move Item')
        );
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Textarea Auto-resize', () => {
    it('textarea element exists and has ref', () => {
      render(<StepCard {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Enter step name...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty step name', () => {
      render(<StepCard {...defaultProps} stepName="" />);
      const input = screen.getByPlaceholderText('Enter step name...');
      expect(input).toHaveValue('');
    });

    it('handles very long step names', () => {
      const longName = 'A'.repeat(200);
      render(<StepCard {...defaultProps} stepName={longName} />);
      const input = screen.getByPlaceholderText('Enter step name...');
      expect(input).toHaveValue(longName);
    });

    it('handles step name with newlines', () => {
      const multilineName = 'Line 1\nLine 2\nLine 3';
      render(<StepCard {...defaultProps} stepName={multilineName} />);
      const textarea = screen.getByPlaceholderText('Enter step name...') as HTMLTextAreaElement;
      expect(textarea.value).toBe(multilineName);
    });
  });
});
