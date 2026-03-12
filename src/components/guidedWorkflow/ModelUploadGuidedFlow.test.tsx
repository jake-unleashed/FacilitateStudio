import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AssetMetadata } from '../../types/model';
import type { SceneObject } from '../../types';
import { PopupProvider } from '../../contexts/PopupContext';
import { GlobalPopup } from '../GlobalPopup';
import { GuidedWorkflowProvider } from '../../contexts/GuidedWorkflowContext';
import { GuidedWorkflowOverlay } from './GuidedWorkflowOverlay';

function TestWrapper({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: string;
}) {
  return (
    <PopupProvider>
      <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>
      <GlobalPopup />
    </PopupProvider>
  );
}

function setGuidedState(projectId: string, state: Record<string, unknown>) {
  window.localStorage.setItem(`guided-workflow-${projectId}`, JSON.stringify(state));
}

describe('Guided model upload flow', () => {
  const projectId = 'test-guided-model-upload';

  const baseProps = {
    steps: [],
    onAddStep: vi.fn(),
    onUpdateStep: vi.fn(),
    onDeleteStep: vi.fn(),
    onReorderSteps: vi.fn(),
    onRequestHome: vi.fn(),
    objects: [] as SceneObject[],
    onUpdateObject: vi.fn(),
    onUploadAsset: vi.fn(async () => undefined),
    uploadProgress: undefined,
    recentAssets: [] as AssetMetadata[],
    onAddRecentAsset: vi.fn(),
    onDeleteObject: vi.fn(),
    onFocusObject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'model-upload',
    });
  });

  it('shows overlay Back/Continue on model-upload main screen', () => {
    render(<GuidedWorkflowOverlay {...baseProps} />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    expect(continueBtn).toBeInTheDocument();
    expect(continueBtn).toBeDisabled(); // requires at least 1 model
  });

  it('hides overlay Back/Continue when library submenu is open', async () => {
    const recentAssets: AssetMetadata[] = [
      {
        id: 'asset-1',
        name: 'chair.glb',
        fileType: 'glb',
        fileSize: 123,
        uploadDate: new Date().toISOString(),
      },
    ];

    render(
      <GuidedWorkflowOverlay
        {...baseProps}
        recentAssets={recentAssets}
        onAddRecentAsset={vi.fn()}
      />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
      }
    );

    await userEvent.click(screen.getByRole('button', { name: /choose from your library/i }));

    // Only the submenu "Back" should remain; overlay Back/Continue are hidden.
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('applies scrollable classes to content wrapper only when library submenu is open', async () => {
    const recentAssets: AssetMetadata[] = [
      {
        id: 'asset-1',
        name: 'chair.glb',
        fileType: 'glb',
        fileSize: 123,
        uploadDate: new Date().toISOString(),
      },
    ];

    const { container } = render(
      <GuidedWorkflowOverlay
        {...baseProps}
        recentAssets={recentAssets}
        onAddRecentAsset={vi.fn()}
      />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
      }
    );

    // Before opening library: content wrapper should NOT be scrollable
    expect(container.querySelector('.overflow-y-auto')).not.toBeInTheDocument();

    // Open the library submenu
    await userEvent.click(screen.getByRole('button', { name: /choose from your library/i }));

    // After opening: content wrapper should have overflow-y-auto (scrollable)
    expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument();
    expect(container.querySelector('.custom-scrollbar')).toBeInTheDocument();
  });

  it('clicking a model in the list focuses it', async () => {
    const onFocusObject = vi.fn();
    const objects: SceneObject[] = [
      {
        id: 'obj-1',
        name: 'Chair',
        type: 'mesh',
        transform: {
          x: 0,
          y: 0,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: { visible: true },
      },
    ];

    render(
      <GuidedWorkflowOverlay {...baseProps} objects={objects} onFocusObject={onFocusObject} />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
      }
    );

    await userEvent.click(screen.getByText('Chair'));

    expect(onFocusObject).toHaveBeenCalledTimes(1);
    expect(onFocusObject).toHaveBeenCalledWith(objects[0], undefined, 'explicit');
  });
});

