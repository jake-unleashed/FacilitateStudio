/**
 * Tests for AssetUploadButton component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    it('shows drag and drop hint', () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
      expect(screen.getByText(/max 100.0 MB/i)).toBeInTheDocument();
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
  });

  // ===========================================================================
  // File Selection
  // ===========================================================================

  describe('file selection', () => {
    it('calls onUpload when valid file is selected', async () => {
      mockOnUpload.mockResolvedValue(undefined);
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.obj');

      await userEvent.upload(input, file);

      expect(mockOnUpload).toHaveBeenCalledWith(file);
    });

    it('shows error for invalid file type', async () => {
      render(<AssetUploadButton onUpload={mockOnUpload} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('model.stl');

      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });

      expect(mockOnUpload).not.toHaveBeenCalled();
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
  });

  // ===========================================================================
  // Error Display
  // ===========================================================================

  describe('error display', () => {
    it('shows error message', () => {
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
  });
});

