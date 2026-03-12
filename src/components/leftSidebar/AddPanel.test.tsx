import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PopupProvider } from '../../contexts/PopupContext';
import type { GenerationTask } from '../../types/modelGeneration';
import { GlobalPopup } from '../GlobalPopup';
import { AddPanel } from './AddPanel';

function renderAddPanel(props?: Partial<ComponentProps<typeof AddPanel>>) {
  return render(
    <PopupProvider>
      <AddPanel
        onRequestModel={vi.fn()}
        generations={[]}
        {...props}
      />
      <GlobalPopup />
    </PopupProvider>
  );
}

describe('AddPanel', () => {
  it('returns to the main panel and shows a generation card after selecting an image', async () => {
    function Harness(): JSX.Element {
      const [generations, setGenerations] = useState<GenerationTask[]>([]);

      return (
        <PopupProvider>
          <AddPanel
            onRequestModel={vi.fn()}
            generations={generations}
            onGenerateFromImage={async (file) => {
              setGenerations([
                {
                  id: 'gen-1',
                  taskId: 'task-1',
                  name: file.name,
                  imagePreviewDataUrl: 'data:image/png;base64,abc',
                  provider: 'meshy',
                  stage: 'generating',
                  progress: 25,
                  status: 'processing',
                  error: null,
                  createdAt: new Date().toISOString(),
                },
              ]);
            }}
          />
          <GlobalPopup />
        </PopupProvider>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByText('Add New 3D Model'));

    const input = document.querySelector('input[type="file"]:not([multiple])') as HTMLInputElement;
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Active generations (1)')).toBeInTheDocument();
      expect(screen.getByText('reference.png')).toBeInTheDocument();
      expect(screen.queryByText('How would you like to add your 3D model?')).not.toBeInTheDocument();
    });
  });

  it('shows an upload popup when model upload fails from the new-model flow', async () => {
    const onUploadAsset = vi.fn().mockRejectedValue(new Error('Upload service unavailable'));
    renderAddPanel({ onUploadAsset });

    fireEvent.click(screen.getByText('Add New 3D Model'));

    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    const file = new File(['glb'], 'asset.glb', { type: 'model/gltf-binary' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Upload Failed')).toBeInTheDocument();
      expect(screen.getByText('Upload service unavailable')).toBeInTheDocument();
    });
  });

  it('shows a popup when image generation fails from the new-model flow', async () => {
    const onGenerateFromImage = vi.fn().mockRejectedValue(new Error('Generator offline'));
    renderAddPanel({ onGenerateFromImage });

    fireEvent.click(screen.getByText('Add New 3D Model'));

    const input = document.querySelector('input[type="file"]:not([multiple])') as HTMLInputElement;
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Image generation failed')).toBeInTheDocument();
      expect(screen.getByText('Generator offline')).toBeInTheDocument();
    });
  });
});
