import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { GuidedWorkflowProvider } from '../../contexts/GuidedWorkflowContext';
import { PopupProvider } from '../../contexts/PopupContext';
import { GuidedWorkflowOverlay } from './GuidedWorkflowOverlay';
import type { GuidedWorkflowOverlayProps } from './GuidedWorkflowOverlay';
import type { SceneObject } from '../../types';
import { DEFAULT_TRANSFORM } from '../../types';

const meshObject: SceneObject = {
  id: 'mesh-1',
  name: 'Test Model',
  type: 'mesh',
  transform: { ...DEFAULT_TRANSFORM },
  properties: { visible: true },
};

const defaultProps: GuidedWorkflowOverlayProps = {
  steps: [{ id: 'step-1', title: 'First step', description: '', completed: false, type: null }],
  onAddStep: vi.fn(),
  onUpdateStep: vi.fn(),
  onDeleteStep: vi.fn(),
  onReorderSteps: vi.fn(),
  onRequestHome: vi.fn(),
  objects: [meshObject],
  onUpdateObject: vi.fn(),
  onUploadAsset: vi.fn().mockResolvedValue(undefined),
};

function setGuidedState(projectId: string, state: Record<string, unknown>) {
  window.localStorage.setItem(`guided-workflow-${projectId}`, JSON.stringify(state));
}

describe('GuidedWorkflowOverlay phase transitions', () => {
  const projectId = 'test-overlay-transitions';

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.useFakeTimers();
    // Mock requestAnimationFrame to work with fake timers
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the current phase content on initial mount', () => {
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'model-upload',
    });

    render(<GuidedWorkflowOverlay {...defaultProps} />, {
      wrapper: ({ children }) => (
        <PopupProvider>
          <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>
        </PopupProvider>
      ),
    });

    // Model upload phase content should be visible (model already uploaded)
    expect(screen.getByText(/more 3d models to add/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip setup/i })).toBeInTheDocument();
  });

  it('keeps old content visible during exit animation before showing new content', () => {
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'model-upload',
    });

    render(<GuidedWorkflowOverlay {...defaultProps} />, {
      wrapper: ({ children }) => (
        <PopupProvider>
          <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>
        </PopupProvider>
      ),
    });

    // Verify model-upload content is present
    expect(screen.getByText(/more 3d models to add/i)).toBeInTheDocument();

    // Click Continue to trigger phase change to model-positioning
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // During the exit animation (before timeout fires), the OLD content
    // should still be displayed (displayedPhase hasn't changed yet)
    expect(screen.getByText(/more 3d models to add/i)).toBeInTheDocument();
  });

  it('shows new phase content after transition completes', () => {
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'model-upload',
    });

    render(<GuidedWorkflowOverlay {...defaultProps} />, {
      wrapper: ({ children }) => (
        <PopupProvider>
          <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>
        </PopupProvider>
      ),
    });

    // Click Continue → triggers nextPhase (model-upload → model-positioning)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Advance past exit animation (250ms) + entering rAFs
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Model upload content should be gone, model positioning content should appear
    expect(screen.queryByText(/more 3d models to add/i)).not.toBeInTheDocument();
  });

  it('disables skip button during phase transition', () => {
    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'model-upload',
    });

    render(<GuidedWorkflowOverlay {...defaultProps} />, {
      wrapper: ({ children }) => (
        <PopupProvider>
          <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>
        </PopupProvider>
      ),
    });

    const skipButton = screen.getByRole('button', { name: /skip setup/i });
    expect(skipButton).toBeEnabled();

    // Trigger transition
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Skip button should be disabled during animation
    expect(skipButton).toBeDisabled();

    // After transition completes, skip button should be enabled again
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(skipButton).toBeEnabled();
  });

  it('skips animation when prefers-reduced-motion is set', () => {
    // Mock matchMedia to report reduced motion preference
    const originalMatchMedia = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    setGuidedState(projectId, {
      isActive: true,
      hasDismissedWelcome: true,
      currentPhase: 'model-upload',
    });

    render(<GuidedWorkflowOverlay {...defaultProps} />, {
      wrapper: ({ children }) => (
        <PopupProvider>
          <GuidedWorkflowProvider projectId={projectId}>{children}</GuidedWorkflowProvider>
        </PopupProvider>
      ),
    });

    // Click Continue
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // With reduced motion, content should switch immediately (no timeout needed)
    expect(screen.queryByText(/more 3d models to add/i)).not.toBeInTheDocument();

    // Skip button should NOT be disabled (no transition in progress)
    expect(screen.getByRole('button', { name: /skip setup/i })).toBeEnabled();

    // Restore
    vi.stubGlobal('matchMedia', originalMatchMedia);
  });
});
