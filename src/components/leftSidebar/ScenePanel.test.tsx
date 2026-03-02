import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SceneBackgroundImage } from '../../types/sceneSettings';
import { ScenePanel } from './ScenePanel';

const mockBackgroundImage: SceneBackgroundImage = {
  storageKey: 'bg://user/proj/bg/test.jpg',
  filename: 'panorama.jpg',
  fileSize: 5 * 1024 * 1024,
  signedUrl: 'https://example.com/bg/panorama.jpg',
};

describe('ScenePanel', () => {
  it('shows only 360 upload by default when world environment is disabled', () => {
    render(<ScenePanel onUploadBackground={vi.fn()} onRemoveBackground={vi.fn()} />);

    expect(screen.getByText('Upload 360 Image')).toBeInTheDocument();
    expect(screen.queryByText('Generate 3D Environment')).not.toBeInTheDocument();
  });

  it('shows both environment entry options when world environment is enabled', () => {
    render(<ScenePanel onUploadBackground={vi.fn()} onRemoveBackground={vi.fn()} worldEnvironmentEnabled />);

    expect(screen.getByText('Upload 360 Image')).toBeInTheDocument();
    expect(screen.getByText('Generate 3D Environment')).toBeInTheDocument();
  });

  it('shows statusText when uploading', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isUploading
        statusText="Optimizing image..."
      />
    );

    expect(screen.getByText('Optimizing image...')).toBeInTheDocument();
  });

  it('supports phase-driven loading state without legacy booleans', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        phase="preparingScene"
        statusText="Preparing scene..."
      />
    );

    expect(screen.getByText('Preparing scene...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replace/i })).toBeDisabled();
  });

  it('falls back to default uploading text when statusText is missing', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isUploading
      />
    );

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('calls onUploadBackground when user picks a file', () => {
    const onUploadBackground = vi.fn().mockResolvedValue(undefined);
    render(<ScenePanel onUploadBackground={onUploadBackground} onRemoveBackground={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'background.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUploadBackground).toHaveBeenCalledWith(file);
  });

  it('shows thumbnail spinner and statusText while uploading a replacement image', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isUploading
        statusText="Optimizing image..."
      />
    );

    expect(screen.getByText('Optimizing image...')).toBeInTheDocument();
    expect(screen.queryByText(/5\.0 MB/)).not.toBeInTheDocument();
    // thumbnail area shows spinner, not the old preview image
    expect(screen.queryByAltText('360 background preview')).not.toBeInTheDocument();
  });

  it('shows Preparing scene... subtext while texture is loading after upload', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isTextureLoading
      />
    );

    expect(screen.getByText('Preparing scene...')).toBeInTheDocument();
    expect(screen.queryByText(/5\.0 MB/)).not.toBeInTheDocument();
  });

  it('shows file size once texture is ready', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isTextureLoading={false}
      />
    );

    expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    expect(screen.queryByText('Preparing scene...')).not.toBeInTheDocument();
  });

  it('disables Replace and Remove buttons while texture is loading', () => {
    render(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isTextureLoading
      />
    );

    expect(screen.getByRole('button', { name: /replace/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
  });
});
