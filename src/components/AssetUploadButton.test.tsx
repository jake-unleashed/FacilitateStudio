/**
 * Tests for AssetUploadButton component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetUploadButton } from './AssetUploadButton';
import type { UploadProgress } from '../types/model';
import { PopupProvider } from '../contexts/PopupContext';
import { GlobalPopup } from './GlobalPopup';
import { ReactElement } from 'react';
import { ACCEPTED_FORMATS } from './assetUpload/constants';

// Wrapper that provides PopupProvider and GlobalPopup for all tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PopupProvider>
      {children}
      <GlobalPopup />
    </PopupProvider>
  );
}

function renderWithPopupProvider(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
}

describe('AssetUploadButton', () => {
  // ===========================================================================
  // Test Setup
  // ===========================================================================

  const mockOnUpload = vi.fn();

  function createMockFile(name: string, size = 1024): File {
    const blob = new Blob(['x'.repeat(size)], { type: 'application/octet-stream' });
    return new File([blob], name, { type: 'application/octet-stream' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe('rendering', () => {
    it('renders upload button', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
    });

    it('shows supported formats hint', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      expect(screen.getByText(/drag model and texture files, or a folder/i)).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} className="custom-class" />
      );

      // Find the element with custom-class
      const customClassElement = document.querySelector('.custom-class');
      expect(customClassElement).toBeInTheDocument();
    });

    it('has hidden file input', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('hidden');
    });

    it('file input accepts correct file types', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', ACCEPTED_FORMATS);
    });

    it('has proper accessibility attributes', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('aria-label', 'Upload 3D model and texture files');

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      expect(uploadArea).toHaveAttribute('aria-label', 'Upload asset');
    });
  });

  // ===========================================================================
  // Click to Upload
  // ===========================================================================

  describe('click to upload', () => {
    it('opens file dialog on click', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      await userEvent.click(screen.getByRole('button', { name: 'Upload asset' }));

      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file dialog on Enter key', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');
      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });

      uploadArea.focus();
      fireEvent.keyDown(uploadArea, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not open file dialog when disabled', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      await userEvent.click(screen.getByRole('button', { name: 'Upload asset' }));

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('does not open file dialog when uploading', async () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      await userEvent.click(screen.getByRole('button', { name: 'Upload asset' }));

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // File Selection
  // ===========================================================================

  describe('file selection', () => {
    it('calls onUpload when valid OBJ file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file, []);
      });
    });

    it('calls onUpload when valid FBX file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.fbx');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file, []);
      });
    });

    it('calls onUpload when valid GLB file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.glb');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file, []);
      });
    });

    it('shows error for unsupported GLTF file (use GLB instead)', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.gltf'); // GLTF is not supported, only GLB

      // Simulate file selection directly
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(
        () => {
          expect(screen.getByText(/no 3d model found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('shows error for invalid file type', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.stl');

      // Simulate file selection directly (bypassing browser file picker restrictions)
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(
        () => {
          expect(screen.getByText(/no 3d model found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('shows loading state during upload', async () => {
      mockOnUpload.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });
    });

    it('shows success state after upload', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(
        () => {
          expect(screen.getByText('Added to scene!')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Wait for reset
      await waitFor(
        () => {
          expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('shows error in toast when upload fails, button stays usable', async () => {
      mockOnUpload.mockRejectedValue(new Error('Custom error message'));
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(() => {
        // Error is shown in toast
        expect(screen.getByText('Upload Failed')).toBeInTheDocument();
        expect(screen.getByText('Custom error message')).toBeInTheDocument();
        // Button should still say "Upload 3D Model" (usable state)
        expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Drag and Drop
  // ===========================================================================

  describe('drag and drop', () => {
    it('shows drop hint on drag enter', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });

      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Drop to upload')).toBeInTheDocument();
    });

    it('hides drop hint on drag leave', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });

      // Enter
      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Drop to upload')).toBeInTheDocument();

      // Leave
      fireEvent.dragLeave(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
    });

    it('handles file drop', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      const file = createMockFile('model.obj');

      fireEvent.drop(uploadArea, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file, []);
      });
    });

    it('shows error for dropped invalid file', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      const file = createMockFile('model.stl');

      fireEvent.drop(uploadArea, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/no 3d model found/i)).toBeInTheDocument();
      });

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('ignores drop when disabled', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      const file = createMockFile('model.obj');

      fireEvent.drop(uploadArea, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('ignores drop when uploading', async () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      const file = createMockFile('model2.obj');

      fireEvent.drop(uploadArea, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('handles drag counter correctly with nested elements', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });

      // Multiple drag enters (simulating nested elements)
      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Drop to upload')).toBeInTheDocument();

      // Multiple drag leaves
      fireEvent.dragLeave(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      // Should still show drop hint
      expect(screen.getByText('Drop to upload')).toBeInTheDocument();

      fireEvent.dragLeave(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      // Now should hide
      expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Progress Display (with external progress)
  // ===========================================================================

  describe('progress display', () => {
    it('shows validating stage', () => {
      const progress: UploadProgress = {
        stage: 'validating',
        fileName: 'model.obj',
        progress: 10,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText('Validating...')).toBeInTheDocument();
    });

    it('shows storing stage', () => {
      const progress: UploadProgress = {
        stage: 'storing',
        fileName: 'model.obj',
        progress: 25,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText('Storing...')).toBeInTheDocument();
    });

    it('shows processing stage', () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText('Processing model...')).toBeInTheDocument();
    });

    it('shows adding stage', () => {
      const progress: UploadProgress = {
        stage: 'adding',
        fileName: 'model.obj',
        progress: 85,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText('Adding to scene...')).toBeInTheDocument();
    });

    it('shows complete stage', () => {
      const progress: UploadProgress = {
        stage: 'complete',
        fileName: 'model.obj',
        progress: 100,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText('Added to scene!')).toBeInTheDocument();
    });

    it('shows file name during upload', () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'my-model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText('my-model.obj')).toBeInTheDocument();
    });

    it('shows progress bar with correct width', () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      const progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('hides format hint during upload', () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.queryByText(/drag model and texture files, or a folder/i)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Error Display (via Global Popup)
  // ===========================================================================

  describe('error display', () => {
    it('shows error popup when invalid file is uploaded', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.stl'); // Invalid extension

      // Simulate file selection directly
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      // Error should be shown in the global popup
      await waitFor(
        () => {
          // Check for dialog role (popup is showing)
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByText(/no 3d model found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
      // Button should still say "Upload Asset" (usable state)
      expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
    });

    it('keeps button usable when error occurs', async () => {
      mockOnUpload.mockRejectedValue(new Error('Network error'));
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(
        () => {
          // Button should be in normal state (not error styled) - it should say "Upload 3D Model"
          expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
          // Error is shown in popup (check for dialog)
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByText(/network error/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('popup can be dismissed by clicking OK button', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.stl'); // Invalid extension

      // Simulate file selection directly
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      // Wait for popup to appear
      await waitFor(
        () => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Find and click the OK button
      const okButton = screen.getByText('OK');
      fireEvent.click(okButton);

      // Wait for the popup to be dismissed
      await waitFor(
        () => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });

  // ===========================================================================
  // Warning Display
  // ===========================================================================

  describe('warning display', () => {
    it('shows warning message', () => {
      const progress: UploadProgress = {
        stage: 'storing',
        fileName: 'big-model.obj',
        progress: 25,
        error: null,
        warning: 'Large file may take longer to process',
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      expect(screen.getByText(/large file/i)).toBeInTheDocument();
    });

    it('shows warning icon', () => {
      const progress: UploadProgress = {
        stage: 'storing',
        fileName: 'big-model.obj',
        progress: 25,
        error: null,
        warning: 'Warning message',
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      const warningIcon = document.querySelector('svg[aria-hidden="true"]');
      expect(warningIcon).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Disabled State
  // ===========================================================================

  describe('disabled state', () => {
    it('applies disabled styling', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      expect(uploadArea).toHaveClass('cursor-not-allowed');
      expect(uploadArea).toHaveClass('opacity-60');
    });

    it('disables file input', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeDisabled();
    });

    it('sets aria-disabled attribute', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const uploadArea = screen.getByRole('button', { name: 'Upload asset' });
      expect(uploadArea).toHaveAttribute('aria-disabled', 'true');
    });

    it('removes hover effect when disabled', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const iconContainer = document.querySelector('div[class*="flex h-12 w-12"]');
      expect(iconContainer).toBeInTheDocument();
      // When disabled, hover effect class should not be present
      expect(iconContainer?.className).not.toContain('group-hover:scale-110');
    });
  });

  // ===========================================================================
  // Icon Display
  // ===========================================================================

  describe('icon display', () => {
    it('shows upload icon in idle state', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      // Icon should be present in the icon container
      const iconContainer = document.querySelector('div[class*="flex h-12 w-12"]');
      expect(iconContainer).toBeInTheDocument();
      const icon = iconContainer?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('shows loading icon during upload', () => {
      const progress: UploadProgress = {
        stage: 'processing',
        fileName: 'model.obj',
        progress: 50,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      const icon = document.querySelector('svg.animate-spin');
      expect(icon).toBeInTheDocument();
    });

    it('shows success icon on complete', () => {
      const progress: UploadProgress = {
        stage: 'complete',
        fileName: 'model.obj',
        progress: 100,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      const iconContainer = document.querySelector('div[class*="text-green-500"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('shows error icon in popup when error occurs', async () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.stl'); // Invalid extension

      // Simulate file selection directly
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(input);

      await waitFor(
        () => {
          // The error icon should be in the popup (which uses text-red-500)
          const popupErrorIcon = document.querySelector(
            '[role="dialog"] svg[class*="text-red-500"]'
          );
          expect(popupErrorIcon).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Button should show normal upload icon (not error icon)
      expect(screen.getByText('Upload 3D Model')).toBeInTheDocument();
    });

    it('shows file box icon when dragging', () => {
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen
        .getByText('Upload 3D Model')
        .closest('div[class*="cursor-pointer"]')!;

      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      // FileBox icon should be present (we can't easily test the specific icon type)
      const iconContainer = document.querySelector('div[class*="flex h-12 w-12"]');
      expect(iconContainer).toBeInTheDocument();
      const icon = iconContainer?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Internal State Management
  // ===========================================================================

  describe('internal state management', () => {
    it('uses internal state when no external progress provided', async () => {
      // Make upload take some time so we can see the processing state
      mockOnUpload.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      renderWithPopupProvider(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      // Should show processing or validating state (validation happens first)
      await waitFor(
        () => {
          const processingText = screen.queryByText(/processing/i);
          const validatingText = screen.queryByText(/validating/i);
          expect(processingText || validatingText).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('prioritizes external progress over internal state', () => {
      const progress: UploadProgress = {
        stage: 'storing',
        fileName: 'external.obj',
        progress: 25,
        error: null,
        warning: null,
      };

      renderWithPopupProvider(
        <AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />
      );

      // Should show external progress, not internal
      expect(screen.getByText('Storing...')).toBeInTheDocument();
      expect(screen.getByText('external.obj')).toBeInTheDocument();
    });
  });
});
