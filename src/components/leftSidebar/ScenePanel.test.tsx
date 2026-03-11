import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SceneBackgroundImage } from '../../types/sceneSettings';
import type { StarterAssetCatalogEntry } from '../../services/starterAssetService';
import { PopupProvider } from '../../contexts/PopupContext';
import { GlobalPopup } from '../GlobalPopup';
import { ScenePanel } from './ScenePanel';

const mockBackgroundImage: SceneBackgroundImage = {
  storageKey: 'bg://user/proj/bg/test.jpg',
  filename: 'panorama.jpg',
  fileSize: 5 * 1024 * 1024,
  signedUrl: 'https://example.com/bg/panorama.jpg',
};

const starterBackgrounds: StarterAssetCatalogEntry[] = [
  {
    id: 'starter:bg-desert',
    type: 'background',
    name: 'Desert Test',
    storageKey: 'backgrounds/desert.jpg',
    fileType: 'jpg',
    fileSize: 1234,
    sortOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    publicUrl: 'https://example.com/backgrounds/desert.jpg',
  },
];

function renderScenePanel(component: ReactElement) {
  return render(
    <PopupProvider>
      {component}
      <GlobalPopup />
    </PopupProvider>
  );
}

describe('ScenePanel', () => {
  it('shows only 360 upload by default when world environment is disabled', () => {
    renderScenePanel(<ScenePanel onUploadBackground={vi.fn()} onRemoveBackground={vi.fn()} />);

    expect(screen.getByText('Upload 360 Image')).toBeInTheDocument();
    expect(screen.queryByText('Generate 3D Environment')).not.toBeInTheDocument();
  });

  it('shows both environment entry options when world environment is enabled', () => {
    renderScenePanel(
      <ScenePanel onUploadBackground={vi.fn()} onRemoveBackground={vi.fn()} worldEnvironmentEnabled />
    );

    expect(screen.getByText('Upload 360 Image')).toBeInTheDocument();
    expect(screen.getByText('Generate 3D Environment')).toBeInTheDocument();
  });

  it('shows statusText when uploading', () => {
    renderScenePanel(
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
    renderScenePanel(
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
    renderScenePanel(
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
    renderScenePanel(<ScenePanel onUploadBackground={onUploadBackground} onRemoveBackground={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'background.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUploadBackground).toHaveBeenCalledWith(file);
  });

  it('shows thumbnail spinner and statusText while uploading a replacement image', () => {
    renderScenePanel(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isUploading
        statusText="Optimizing image..."
      />
    );

    expect(screen.getByText('Optimizing image...')).toBeInTheDocument();
    expect(screen.queryByAltText('360 background preview')).not.toBeInTheDocument();
  });

  it('shows Preparing scene... subtext while texture is loading after upload', () => {
    renderScenePanel(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isTextureLoading
      />
    );

    expect(screen.getByText('Preparing scene...')).toBeInTheDocument();
  });

  it('does not show file size in idle state', () => {
    renderScenePanel(
      <ScenePanel
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        backgroundImage={mockBackgroundImage}
        isTextureLoading={false}
      />
    );

    expect(screen.queryByText('5.0 MB')).not.toBeInTheDocument();
    expect(screen.queryByText('Preparing scene...')).not.toBeInTheDocument();
  });

  it('disables Replace and Remove buttons while texture is loading', () => {
    renderScenePanel(
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

  it('keeps starter backgrounds visible when a background is already applied', () => {
    renderScenePanel(
      <ScenePanel
        backgroundImage={mockBackgroundImage}
        starterBackgrounds={starterBackgrounds}
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        onSelectStarterBackground={vi.fn()}
      />
    );

    expect(screen.getByText('Starter backgrounds')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use starter background desert test/i })).toBeInTheDocument();
  });

  it('renders starter background cards as title-only buttons', () => {
    renderScenePanel(
      <ScenePanel
        starterBackgrounds={starterBackgrounds}
        onUploadBackground={vi.fn()}
        onRemoveBackground={vi.fn()}
        onSelectStarterBackground={vi.fn()}
      />
    );

    expect(screen.getByText('Desert Test')).toBeInTheDocument();
    expect(screen.queryByAltText('Desert Test')).not.toBeInTheDocument();
  });

  it('shows a popup when background upload fails', async () => {
    const onUploadBackground = vi.fn().mockRejectedValue(new Error('Upload exploded'));
    renderScenePanel(<ScenePanel onUploadBackground={onUploadBackground} onRemoveBackground={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'background.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Background upload failed')).toBeInTheDocument();
      expect(screen.getByText('Upload exploded')).toBeInTheDocument();
    });
  });
});
