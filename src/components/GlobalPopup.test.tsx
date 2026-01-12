/**
 * Tests for GlobalPopup component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PopupProvider, usePopup } from '../contexts/PopupContext';
import { GlobalPopup } from './GlobalPopup';

// =============================================================================
// Test Utilities
// =============================================================================

function TestTrigger({ type, title, message }: { type: 'error' | 'warning' | 'info' | 'success'; title: string; message: string }) {
  const { showPopup } = usePopup();
  return (
    <button onClick={() => showPopup({ type, title, message })} data-testid="trigger">
      Show Popup
    </button>
  );
}

function renderWithProvider(type: 'error' | 'warning' | 'info' | 'success', title: string, message: string) {
  return render(
    <PopupProvider>
      <TestTrigger type={type} title={title} message={message} />
      <GlobalPopup />
    </PopupProvider>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('GlobalPopup', () => {
  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe('rendering', () => {
    it('does not render when no popup is shown', () => {
      render(
        <PopupProvider>
          <GlobalPopup />
        </PopupProvider>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders popup dialog when triggered', async () => {
      renderWithProvider('error', 'Test Title', 'Test message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('renders title correctly', async () => {
      renderWithProvider('error', 'Custom Title', 'Custom message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByText('Custom Title')).toBeInTheDocument();
      });
    });

    it('renders message correctly', async () => {
      renderWithProvider('error', 'Title', 'This is the error message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByText('This is the error message')).toBeInTheDocument();
      });
    });

    it('renders OK button', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByText('OK')).toBeInTheDocument();
      });
    });

    it('renders backdrop', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const backdrop = document.querySelector('.bg-black\\/30');
        expect(backdrop).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Popup Types and Styling
  // ===========================================================================

  describe('popup types', () => {
    it('renders error popup with red styling', async () => {
      renderWithProvider('error', 'Error', 'Error message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        // Check for red-colored icon
        const icon = document.querySelector('svg.text-red-500');
        expect(icon).toBeInTheDocument();
      });
    });

    it('renders warning popup with amber styling', async () => {
      renderWithProvider('warning', 'Warning', 'Warning message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const icon = document.querySelector('svg.text-amber-500');
        expect(icon).toBeInTheDocument();
      });
    });

    it('renders info popup with blue styling', async () => {
      renderWithProvider('info', 'Info', 'Info message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const icon = document.querySelector('svg.text-blue-500');
        expect(icon).toBeInTheDocument();
      });
    });

    it('renders success popup with green styling', async () => {
      renderWithProvider('success', 'Success', 'Success message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const icon = document.querySelector('svg.text-green-500');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Dismissal
  // ===========================================================================

  describe('dismissal', () => {
    it('dismisses popup when OK button is clicked', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('OK'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('does not dismiss popup when clicking inside the card', async () => {
      renderWithProvider('error', 'Title', 'Test Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click on the message text (inside the popup card)
      fireEvent.click(screen.getByText('Test Message'));

      // Popup should still be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================

  describe('accessibility', () => {
    it('has role="dialog"', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('has aria-modal="true"', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
      });
    });

    it('has aria-labelledby pointing to title', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby', 'popup-title');
        expect(document.getElementById('popup-title')).toBeInTheDocument();
      });
    });

    it('has aria-describedby pointing to message', async () => {
      renderWithProvider('error', 'Title', 'Message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-describedby', 'popup-message');
        expect(document.getElementById('popup-message')).toBeInTheDocument();
      });
    });

    it('message text is selectable for copying', async () => {
      renderWithProvider('error', 'Title', 'Copy this message');

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        const messageElement = screen.getByText('Copy this message');
        expect(messageElement).toHaveClass('select-text');
      });
    });
  });

  // ===========================================================================
  // Multiple Popups
  // ===========================================================================

  describe('multiple popups', () => {
    it('only shows one popup at a time (latest wins)', async () => {
      const { rerender } = render(
        <PopupProvider>
          <TestTrigger type="error" title="First" message="First message" />
          <GlobalPopup />
        </PopupProvider>
      );

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
      });

      // Re-render with different trigger
      rerender(
        <PopupProvider>
          <TestTrigger type="success" title="Second" message="Second message" />
          <GlobalPopup />
        </PopupProvider>
      );

      fireEvent.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.queryByText('First')).not.toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
      });
    });
  });
});
