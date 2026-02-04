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

describe('Guided model positioning flow', () => {
  const projectId = 'test-guided-model-positioning';

  const baseProps = {
    steps: [],
    onAddStep: vi.fn(),
    onUpdateStep: vi.fn(),
    onDeleteStep: vi.fn(),
    onReorderSteps: vi.fn(),
    objects: [] as SceneObject[],
    selectedObjectId: null as string | null,
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
      currentPhase: 'model-positioning',
    });
  });

  it('renders object selection screen', () => {
    render(<GuidedWorkflowOverlay {...baseProps} />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    expect(screen.getByText('Do any models need adjusting?')).toBeInTheDocument();
    expect(
      screen.getByText(/select a model to adjust its position, rotation, or scale/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select a model to adjust/i })).toBeInTheDocument();
  });

  it('disables Continue when no mesh objects exist', () => {
    render(<GuidedWorkflowOverlay {...baseProps} />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    const continueBtn = screen.getByRole('button', { name: 'Looks good, continue' });
    expect(continueBtn).toBeDisabled();
  });

  it('enables Continue when at least one mesh object exists', () => {
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

    render(<GuidedWorkflowOverlay {...baseProps} objects={objects} />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    const continueBtn = screen.getByRole('button', { name: 'Looks good, continue' });
    expect(continueBtn).toBeEnabled();
  });

  it('selecting Rotation shows rotation section', async () => {
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

    render(<GuidedWorkflowOverlay {...baseProps} objects={objects} selectedObjectId="obj-1" />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    await userEvent.click(screen.getByRole('button', { name: /adjust chair/i }));
    await userEvent.click(screen.getByRole('button', { name: /rotation/i }));
    expect(screen.getByTestId('rotation-section')).toBeInTheDocument();
  });

  it('selecting Scale shows scale section', async () => {
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

    render(<GuidedWorkflowOverlay {...baseProps} objects={objects} selectedObjectId="obj-1" />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    await userEvent.click(screen.getByRole('button', { name: /adjust chair/i }));
    await userEvent.click(screen.getByRole('button', { name: /scale/i }));
    expect(screen.getByTestId('scale-section')).toBeInTheDocument();
  });
});

