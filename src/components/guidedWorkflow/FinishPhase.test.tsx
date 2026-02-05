import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidedWorkflowProvider } from '../../contexts/GuidedWorkflowContext';
import { FinishPhase } from './phases/FinishPhase';

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

describe('FinishPhase', () => {
  const projectId = 'test-finish-phase';

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('shows the preview prompt before previewing', async () => {
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'finish',
      hasPreviewedInFinishPhase: false,
    });

    const onPreviewClick = vi.fn();

    render(<FinishPhase onPreviewClick={onPreviewClick} />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    expect(screen.getByText(/simulation complete/i)).toBeInTheDocument();
    const previewButton = screen.getByRole('button', { name: /preview/i });
    await userEvent.click(previewButton);
    expect(onPreviewClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/ready to share/i)).toBeInTheDocument();
  });

  it('shows publish options after previewing', async () => {
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'finish',
      hasPreviewedInFinishPhase: true,
    });

    const onPublishClick = vi.fn();

    render(<FinishPhase onPublishClick={onPublishClick} />, {
      wrapper: ({ children }) => <TestWrapper projectId={projectId}>{children}</TestWrapper>,
    });

    expect(screen.getByText(/ready to share/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /publish/i }));
    expect(onPublishClick).toHaveBeenCalledTimes(1);
  });
});
