/**
 * Tests for AssetUploadButton component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetUploadButton } from './AssetUploadButton';
import type { UploadProgress } from '../types/model';

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
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      expect(screen.getByText('Upload Asset')).toBeInTheDocument();
    });

    it('shows supported formats hint', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      expect(screen.getByText(/supports.*obj.*fbx.*glb.*gltf.*models/i)).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(
        <AssetUploadButton onUpload={mockOnUpload} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('has hidden file input', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('hidden');
    });

    it('file input accepts correct file types', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', '.obj,.fbx,.glb,.gltf');
    });

    it('has proper accessibility attributes', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('aria-label', 'Upload 3D model file');

      const uploadArea = screen.getByRole('button');
      expect(uploadArea).toHaveAttribute('aria-label', 'Upload asset');
    });
  });

  // ===========================================================================
  // Click to Upload
  // ===========================================================================

  describe('click to upload', () => {
    it('opens file dialog on click', async () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]');
      await userEvent.click(uploadArea!);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not open file dialog when disabled', async () => {
      render(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor"]');
      await userEvent.click(uploadArea!);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const uploadArea = screen.getByText('Processing model...').closest('div[class*="cursor"]');
      await userEvent.click(uploadArea!);

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // File Selection
  // ===========================================================================

  describe('file selection', () => {
    it('calls onUpload when valid OBJ file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file);
      });
    });

    it('calls onUpload when valid FBX file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.fbx');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file);
      });
    });

    it('calls onUpload when valid GLB file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.glb');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file);
      });
    });

    it('calls onUpload when valid GLTF file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.gltf');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file);
      });
    });

    it('shows error for invalid file type', async () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

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
          expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('shows loading state during upload', async () => {
      mockOnUpload.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });
    });

    it('shows success state after upload', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

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
          expect(screen.getByText('Upload Asset')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('shows error state when upload fails', async () => {
      mockOnUpload.mockRejectedValue(new Error('Custom error message'));
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      await waitFor(() => {
        // Check that error label is displayed
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
        // Check that the actual error message is displayed
        expect(screen.getByText('Custom error message')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Drag and Drop
  // ===========================================================================

  describe('drag and drop', () => {
    it('shows drop hint on drag enter', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]')!;

      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Drop file here')).toBeInTheDocument();
    });

    it('hides drop hint on drag leave', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]')!;

      // Enter
      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Drop file here')).toBeInTheDocument();

      // Leave
      fireEvent.dragLeave(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Upload Asset')).toBeInTheDocument();
    });

    it('handles file drop', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]')!;
      const file = createMockFile('model.obj');

      fireEvent.drop(uploadArea, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(file);
      });
    });

    it('shows error for dropped invalid file', async () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]')!;
      const file = createMockFile('model.stl');

      fireEvent.drop(uploadArea, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });

      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it('ignores drop when disabled', async () => {
      render(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const uploadArea = screen.getByText('Upload Asset').closest('div')!;
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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      const uploadArea = screen.getByText('Processing model...').closest('div')!;
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
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]')!;

      // Multiple drag enters (simulating nested elements)
      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(screen.getByText('Drop file here')).toBeInTheDocument();

      // Multiple drag leaves
      fireEvent.dragLeave(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      // Should still show drop hint
      expect(screen.getByText('Drop file here')).toBeInTheDocument();

      fireEvent.dragLeave(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      // Now should hide
      expect(screen.getByText('Upload Asset')).toBeInTheDocument();
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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      expect(screen.queryByText(/supports.*models/i)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Error Display
  // ===========================================================================

  describe('error display', () => {
    it('shows error message from external progress', () => {
      const progress: UploadProgress = {
        stage: 'error',
        fileName: null,
        progress: 0,
        error: 'Something went wrong',
        warning: null,
      };

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      expect(screen.getByText('Upload failed')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('shows error styling when error occurs', () => {
      const progress: UploadProgress = {
        stage: 'error',
        fileName: null,
        progress: 0,
        error: 'Error message',
        warning: null,
      };

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      const uploadArea = screen.getByText('Upload failed').closest('div[class*="border-red-200"]');
      expect(uploadArea).toBeInTheDocument();
    });

    it('hides format hint when error is shown', () => {
      const progress: UploadProgress = {
        stage: 'error',
        fileName: null,
        progress: 0,
        error: 'Error message',
        warning: null,
      };

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      expect(screen.queryByText(/supports.*models/i)).not.toBeInTheDocument();
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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      const warningIcon = document.querySelector('svg[aria-hidden="true"]');
      expect(warningIcon).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Disabled State
  // ===========================================================================

  describe('disabled state', () => {
    it('applies disabled styling', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor"]');
      expect(uploadArea).toHaveClass('cursor-not-allowed');
      expect(uploadArea).toHaveClass('opacity-60');
    });

    it('disables file input', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeDisabled();
    });

    it('sets aria-disabled attribute', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} disabled />);

      const uploadArea = screen.getByRole('button');
      expect(uploadArea).toHaveAttribute('aria-disabled', 'true');
    });

    it('removes hover effect when disabled', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} disabled />);

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
      render(<AssetUploadButton onUpload={mockOnUpload} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      const iconContainer = document.querySelector('div[class*="text-green-500"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('shows error icon on error', () => {
      const progress: UploadProgress = {
        stage: 'error',
        fileName: null,
        progress: 0,
        error: 'Error message',
        warning: null,
      };

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      const iconContainer = document.querySelector('div[class*="text-red-500"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('shows file box icon when dragging', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const uploadArea = screen.getByText('Upload Asset').closest('div[class*="cursor-pointer"]')!;

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
      mockOnUpload.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<AssetUploadButton onUpload={mockOnUpload} />);

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

      render(<AssetUploadButton onUpload={mockOnUpload} uploadProgress={progress} />);

      // Should show external progress, not internal
      expect(screen.getByText('Storing...')).toBeInTheDocument();
      expect(screen.getByText('external.obj')).toBeInTheDocument();
    });
  });
});
