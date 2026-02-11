import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SimStep } from '../../types';
import { GuidedWorkflowProvider } from '../../contexts/GuidedWorkflowContext';
import { StepConfigurationPhase } from './phases/StepConfigurationPhase';

function TestWrapper({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: string;
}) {
  return <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>;
}

function setGuidedState(projectId: string, state: Record<string, unknown>) {
  window.localStorage.setItem(`guided-workflow-${projectId}`, JSON.stringify(state));
}

describe('StepConfigurationPhase', () => {
  const projectId = 'test-step-configuration';
  const steps: SimStep[] = [
    { id: 'step-1', title: 'Inspect equipment', description: '', completed: false, type: null },
    { id: 'step-2', title: 'Attach harness', description: '', completed: false, type: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      hasSeenStepSetupIntro: true,
      currentPhase: 'step-configuration',
      currentStepIndex: 0,
    });
  });

  it('allows leaving a step blank and continuing', async () => {
    const onUpdateStep = vi.fn();

    render(
      <StepConfigurationPhase
        steps={steps}
        objects={[]}
        selectedObjectId={null}
        onUpdateStep={onUpdateStep}
        onUpdateObject={vi.fn()}
      />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
      }
    );

    await userEvent.click(screen.getByRole('button', { name: /start step 1/i }));
    expect(await screen.findByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave blank for now/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /leave blank for now/i }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /Info Card/i }));
    expect(onUpdateStep).toHaveBeenCalled();
    // After choosing a type, Continue should take us to settings.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('navigates to the next step after selection', async () => {
    const onUpdateStep = vi.fn();

    render(
      <StepConfigurationPhase
        steps={steps}
        objects={[]}
        selectedObjectId={null}
        onUpdateStep={onUpdateStep}
        onUpdateObject={vi.fn()}
      />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
      }
    );

    await userEvent.click(screen.getByRole('button', { name: /start step 1/i }));
    await screen.findByText('Step 1 of 2');
    await userEvent.click(screen.getByRole('button', { name: /Info Card/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Attach harness')).toBeInTheDocument();
  });

  it('shows an intro screen before step setup', async () => {
    const introProjectId = 'test-step-configuration-intro';
    window.localStorage.clear();
    setGuidedState(introProjectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'step-configuration',
      currentStepIndex: 0,
    });

    render(
      <StepConfigurationPhase steps={steps} objects={[]} selectedObjectId={null} onUpdateStep={vi.fn()} onUpdateObject={vi.fn()} />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={introProjectId}>{children}</TestWrapper>,
      }
    );

    expect(screen.getByText(/set up your steps/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /start step 1/i }));

    expect(await screen.findByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Inspect equipment')).toBeInTheDocument();
  });

  it('restores leave blank selection when revisiting a blank step', async () => {
    const blankRestoreProjectId = 'test-step-configuration-blank-restore';
    window.localStorage.clear();
    setGuidedState(blankRestoreProjectId, {
      isActive: true,
      hasDismissedWelcome: true,
      hasSeenStepSetupIntro: true,
      currentPhase: 'step-configuration',
      currentStepIndex: 0,
      stepSetupBlankStepIds: ['step-1'],
    });

    render(
      <StepConfigurationPhase steps={steps} objects={[]} selectedObjectId={null} onUpdateStep={vi.fn()} onUpdateObject={vi.fn()} />,
      {
        wrapper: ({ children }) => <TestWrapper projectId={blankRestoreProjectId}>{children}</TestWrapper>,
      }
    );

    await userEvent.click(screen.getByRole('button', { name: /start step 1/i }));
    await screen.findByText('Step 1 of 2');
    expect(screen.getByRole('button', { name: /leave blank for now/i })).toBeEnabled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });
  });
});
