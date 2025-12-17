import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepCard } from './StepCard';
import { SimStep } from '../types';

const DEFAULT_STEP: SimStep = {
  id: 'step-1',
  title: 'Test Step',
  description: '',
  completed: false,
  type: null,
};

describe('StepCard', () => {
  const mockOnUpdate = vi.fn();
  const mockOnMinimize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={1}
          isOpen={false}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render step number correctly', () => {
      render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={3}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render step title as editable textarea', () => {
      const step = { ...DEFAULT_STEP, title: 'My Test Step' };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      const textarea = screen.getByPlaceholderText('Enter step name...');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('My Test Step');
    });

    it('should show minimize button', () => {
      render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      const minimizeButton = screen.getByTitle('Minimize step');
      expect(minimizeButton).toBeInTheDocument();
    });
  });

  describe('Step Type Selection', () => {
    it('should show step type selection when type is null', () => {
      render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Info Card')).toBeInTheDocument();
      expect(screen.getByText('Move Item')).toBeInTheDocument();
    });

    it('should show selected step type badge when type is selected', () => {
      const step = { ...DEFAULT_STEP, type: 'info-card' as const };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Info Card')).toBeInTheDocument();
      expect(screen.queryByText('Move Item')).not.toBeInTheDocument();
    });

    it('should allow changing step type', async () => {
      const user = userEvent.setup();
      render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );

      const moveItemButton = screen.getByText('Move Item').closest('button');
      expect(moveItemButton).toBeInTheDocument();
      if (moveItemButton) {
        await user.click(moveItemButton);
        await waitFor(() => {
          expect(mockOnUpdate).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Info Card Fields', () => {
    it('should show Info Card preview when info-card type is selected', () => {
      const step = { ...DEFAULT_STEP, type: 'info-card' as const };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('should display heading text when provided', () => {
      const step = {
        ...DEFAULT_STEP,
        type: 'info-card' as const,
        heading: 'Test Heading',
      };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Test Heading')).toBeInTheDocument();
    });

    it('should display body text when provided', () => {
      const step = {
        ...DEFAULT_STEP,
        type: 'info-card' as const,
        bodyText: 'Test body text content',
      };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Test body text content')).toBeInTheDocument();
    });

    it('should display button text when provided', () => {
      const step = {
        ...DEFAULT_STEP,
        type: 'info-card' as const,
        buttonText: 'Continue',
      };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('should show default button text when buttonText is empty', () => {
      const step = { ...DEFAULT_STEP, type: 'info-card' as const };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('OK')).toBeInTheDocument();
    });
  });

  describe('Inline Editing', () => {
    it('should show edit icons for heading, body text, and button', () => {
      const step = {
        ...DEFAULT_STEP,
        type: 'info-card' as const,
        heading: 'Test',
        bodyText: 'Test body',
        buttonText: 'Click me',
      };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      // Edit icons should be visible (they're always visible now, not just on hover)
      const editButtons = screen.getAllByTitle(/Edit/);
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should allow editing heading by clicking on it', async () => {
      const user = userEvent.setup();
      const step = {
        ...DEFAULT_STEP,
        type: 'info-card' as const,
        heading: 'Original Heading',
      };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );

      const headingElement = screen.getByText('Original Heading');
      await user.click(headingElement);

      const textarea = screen.getByDisplayValue('Original Heading');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Color Selection', () => {
    it('should show color picker for Info Card', () => {
      const step = { ...DEFAULT_STEP, type: 'info-card' as const };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      // Color picker buttons should be present
      const colorButtons = screen.getAllByTitle(/^(Blue|Green|Yellow|Red|Gray)$/);
      expect(colorButtons.length).toBe(5);
    });

    it('should default to blue color', () => {
      const step = { ...DEFAULT_STEP, type: 'info-card' as const };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      const blueButton = screen.getByTitle('Blue');
      expect(blueButton).toHaveClass('ring-2'); // Selected state
    });

    it('should allow changing card color', async () => {
      const user = userEvent.setup();
      const step = { ...DEFAULT_STEP, type: 'info-card' as const };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );

      const greenButton = screen.getByTitle('Green');
      await user.click(greenButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });

      // Check that the update includes the new color
      const updateCall = mockOnUpdate.mock.calls[0][0];
      expect(updateCall.cardColor).toBe('green');
    });
  });

  describe('Auto-save', () => {
    it.skip('should auto-save step name changes after debounce delay', async () => {
      // TODO: Fix fake timers integration with userEvent and debounce
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
      render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );

      const textarea = screen.getByPlaceholderText('Enter step name...');
      await user.clear(textarea);
      await user.type(textarea, 'New Step Name');

      expect(mockOnUpdate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500); // Debounce delay (400ms) + buffer

      await waitFor(
        () => {
          expect(mockOnUpdate).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      vi.useRealTimers();
    });
  });

  describe('Minimize functionality', () => {
    it.skip('should call onMinimize when minimize button is clicked', async () => {
      // TODO: Fix userEvent click timing issue
      const user = userEvent.setup();
      render(
        <StepCard
          step={DEFAULT_STEP}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );

      const minimizeButton = screen.getByTitle('Minimize step');
      expect(minimizeButton).toBeInTheDocument();
      await user.click(minimizeButton);

      await waitFor(() => {
        expect(mockOnMinimize).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Completed state', () => {
    it('should show blue background for completed step number', () => {
      const step = { ...DEFAULT_STEP, completed: true };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      const stepNumber = screen.getByText('1');
      expect(stepNumber.closest('div')).toHaveClass('bg-blue-500');
    });

    it('should show gray background for incomplete step number', () => {
      const step = { ...DEFAULT_STEP, completed: false };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      const stepNumber = screen.getByText('1');
      expect(stepNumber.closest('div')).toHaveClass('bg-slate-200');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty step title', () => {
      const step = { ...DEFAULT_STEP, title: '' };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      const textarea = screen.getByPlaceholderText('Enter step name...');
      expect(textarea).toHaveValue('');
    });

    it('should handle step with all Info Card fields populated', () => {
      const step = {
        ...DEFAULT_STEP,
        type: 'info-card' as const,
        heading: 'Heading',
        bodyText: 'Body text',
        buttonText: 'Button',
        cardColor: 'green' as const,
      };
      render(
        <StepCard
          step={step}
          stepNumber={1}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
        />
      );
      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText('Body text')).toBeInTheDocument();
      expect(screen.getByText('Button')).toBeInTheDocument();
    });
  });
});
