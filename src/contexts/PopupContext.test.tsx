/**
 * Tests for PopupContext
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  PopupProvider,
  usePopup,
  createErrorPopup,
  createWarningPopup,
  createInfoPopup,
  createSuccessPopup,
} from './PopupContext';
import { GlobalPopup } from '../components/GlobalPopup';
import React from 'react';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Test component that exposes popup context methods
 */
function TestConsumer({ onReady }: { onReady: (api: ReturnType<typeof usePopup>) => void }) {
  const popupApi = usePopup();
  React.useEffect(() => {
    onReady(popupApi);
  }, [popupApi, onReady]);
  return null;
}

/**
 * Render a test setup with PopupProvider and GlobalPopup
 */
function renderWithPopup(onReady: (api: ReturnType<typeof usePopup>) => void) {
  return render(
    <PopupProvider>
      <TestConsumer onReady={onReady} />
      <GlobalPopup />
    </PopupProvider>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('PopupContext', () => {
  // ===========================================================================
  // usePopup Hook
  // ===========================================================================

  describe('usePopup hook', () => {
    it('throws error when used outside PopupProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponent = () => {
        usePopup();
        return null;
      };

      expect(() => render(<TestComponent />)).toThrow(
        'usePopup must be used within a PopupProvider'
      );

      consoleSpy.mockRestore();
    });

    it('provides showPopup and dismissPopup functions', () => {
      let capturedApi: ReturnType<typeof usePopup> | null = null;

      render(
        <PopupProvider>
          <TestConsumer
            onReady={(api) => {
              capturedApi = api;
            }}
          />
        </PopupProvider>
      );

      expect(capturedApi).not.toBeNull();
      expect(typeof capturedApi!.showPopup).toBe('function');
      expect(typeof capturedApi!.dismissPopup).toBe('function');
      expect(capturedApi!.popup).toBeNull();
    });
  });

  // ===========================================================================
  // showPopup
  // ===========================================================================

  describe('showPopup', () => {
    it('displays error popup', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'error', title: 'Error Title', message: 'Error message here' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Error Title')).toBeInTheDocument();
        expect(screen.getByText('Error message here')).toBeInTheDocument();
      });
    });

    it('displays warning popup', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'warning', title: 'Warning Title', message: 'Warning message' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Warning Title')).toBeInTheDocument();
      });
    });

    it('displays info popup', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'info', title: 'Info Title', message: 'Info message' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Info Title')).toBeInTheDocument();
      });
    });

    it('displays success popup', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'success', title: 'Success!', message: 'Operation completed' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Success!')).toBeInTheDocument();
      });
    });

    it('replaces existing popup when called again', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'error', title: 'First Popup', message: 'First message' });

      await waitFor(() => {
        expect(screen.getByText('First Popup')).toBeInTheDocument();
      });

      api!.showPopup({ type: 'success', title: 'Second Popup', message: 'Second message' });

      await waitFor(() => {
        expect(screen.queryByText('First Popup')).not.toBeInTheDocument();
        expect(screen.getByText('Second Popup')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // dismissPopup
  // ===========================================================================

  describe('dismissPopup', () => {
    it('dismisses popup when called', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'error', title: 'Test Popup', message: 'Test message' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      api!.dismissPopup();

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('dismisses popup when OK button is clicked', async () => {
      let api: ReturnType<typeof usePopup>;
      renderWithPopup((popupApi) => {
        api = popupApi;
      });

      api!.showPopup({ type: 'error', title: 'Test Popup', message: 'Test message' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const okButton = screen.getByText('OK');
      fireEvent.click(okButton);

      await waitFor(
        () => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  describe('helper functions', () => {
    it('createErrorPopup creates correct options', () => {
      const options = createErrorPopup('Error Title', 'Error message');
      expect(options).toEqual({
        type: 'error',
        title: 'Error Title',
        message: 'Error message',
      });
    });

    it('createWarningPopup creates correct options', () => {
      const options = createWarningPopup('Warning Title', 'Warning message');
      expect(options).toEqual({
        type: 'warning',
        title: 'Warning Title',
        message: 'Warning message',
      });
    });

    it('createInfoPopup creates correct options', () => {
      const options = createInfoPopup('Info Title', 'Info message');
      expect(options).toEqual({
        type: 'info',
        title: 'Info Title',
        message: 'Info message',
      });
    });

    it('createSuccessPopup creates correct options', () => {
      const options = createSuccessPopup('Success Title', 'Success message');
      expect(options).toEqual({
        type: 'success',
        title: 'Success Title',
        message: 'Success message',
      });
    });
  });

  // ===========================================================================
  // Popup State
  // ===========================================================================

  describe('popup state', () => {
    it('popup is null initially', () => {
      let api: ReturnType<typeof usePopup>;
      render(
        <PopupProvider>
          <TestConsumer
            onReady={(popupApi) => {
              api = popupApi;
            }}
          />
        </PopupProvider>
      );

      expect(api!.popup).toBeNull();
    });

    it('popup contains correct data after showPopup', async () => {
      let api: ReturnType<typeof usePopup>;
      const { rerender } = render(
        <PopupProvider>
          <TestConsumer
            onReady={(popupApi) => {
              api = popupApi;
            }}
          />
        </PopupProvider>
      );

      api!.showPopup({ type: 'error', title: 'Test', message: 'Message' });

      // Force re-render to get updated state
      rerender(
        <PopupProvider>
          <TestConsumer
            onReady={(popupApi) => {
              api = popupApi;
            }}
          />
        </PopupProvider>
      );

      await waitFor(() => {
        expect(api!.popup).not.toBeNull();
        expect(api!.popup?.type).toBe('error');
        expect(api!.popup?.title).toBe('Test');
        expect(api!.popup?.message).toBe('Message');
        expect(api!.popup?.id).toBeDefined();
      });
    });
  });
});
