import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PopupProvider } from '../contexts/PopupContext';
import { GlobalPopup } from './GlobalPopup';
import { ImageGenerationCard } from './ImageGenerationCard';

function renderCard(onGenerate: (file: File) => Promise<void> | void) {
  return render(
    <PopupProvider>
      <ImageGenerationCard onGenerate={onGenerate} />
      <GlobalPopup />
    </PopupProvider>
  );
}

describe('ImageGenerationCard', () => {
  it('shows the selected file name after choosing an image', async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    renderCard(onGenerate);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledWith(file);
      expect(screen.getByText('Selected: reference.png')).toBeInTheDocument();
    });
  });

  it('shows a popup when generation cannot be started', async () => {
    const onGenerate = vi.fn().mockRejectedValue(new Error('Generation backend unavailable'));
    renderCard(onGenerate);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Image generation failed')).toBeInTheDocument();
      expect(screen.getByText('Generation backend unavailable')).toBeInTheDocument();
    });
  });
});
