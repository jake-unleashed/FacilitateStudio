import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import { PopupProvider } from '../contexts/PopupContext';
import type { Project } from '../types/project';
import { copyToClipboard, generatePublishURL } from '../utils/publishUtils';
import { getExistingPublish, unpublishProject } from '../services/publishService';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../utils/publishUtils', () => ({
  copyToClipboard: vi.fn(),
  generatePublishURL: vi.fn(),
}));

vi.mock('../services/publishService', () => ({
  getExistingPublish: vi.fn(),
  unpublishProject: vi.fn(),
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

// Mock window.open
const mockOpen = vi.fn();
window.open = mockOpen;

const mockGeneratePublishURL = vi.mocked(generatePublishURL);
const mockCopyToClipboard = vi.mocked(copyToClipboard);
const mockGetExistingPublish = vi.mocked(getExistingPublish);
const mockUnpublishProject = vi.mocked(unpublishProject);

const mockProject: Project = {
  id: 'test-project-123',
  name: 'Test Simulation',
  objects: [],
  steps: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockProjectWithReadyStep: Project = {
  ...mockProject,
  steps: [
    {
      id: 'step-1',
      title: 'Step 1',
      description: 'Do something',
      completed: false,
      type: 'info-card',
      heading: 'Hello',
      bodyText: 'World',
      buttonText: 'Next',
      cardColor: 'blue',
    },
  ],
};

const mockProjectWithUnconfiguredStep: Project = {
  ...mockProject,
  steps: [
    {
      id: 'step-1',
      title: '',
      description: '',
      completed: false,
      type: null,
    },
  ],
};

function renderWithContext(ui: React.ReactElement) {
  return render(<PopupProvider>{ui}</PopupProvider>);
}

describe('PublishModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExistingPublish.mockResolvedValue(null);
    mockGeneratePublishURL.mockResolvedValue({
      shareToken: 'token-123',
      url: `${window.location.origin}/published?token=token-123`,
    });
    mockCopyToClipboard.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithContext(
      <PublishModal project={mockProject} isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when isOpen is true', async () => {
    renderWithContext(<PublishModal project={mockProject} isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockGetExistingPublish).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Check project name is displayed somewhere in the modal
    expect(screen.getByText(/test simulation/i)).toBeInTheDocument();
  });

  it('shows empty URL when not yet published', async () => {
    renderWithContext(<PublishModal project={mockProject} isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockGetExistingPublish).toHaveBeenCalled());
    expect(screen.queryByLabelText(/published link/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProject} isOpen={true} onClose={onClose} />);

    // Use the specific aria-label for the close button (not the backdrop)
    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProject} isOpen={true} onClose={onClose} />);

    const backdrop = screen.getByLabelText(/close publish modal/i);
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when Escape key is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProject} isOpen={true} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('publishes asynchronously when Publish button is clicked', async () => {
    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProjectWithReadyStep} isOpen={true} onClose={vi.fn()} />);

    const publishButton = screen.getByRole('button', { name: /^publish$/i });
    await user.click(publishButton);

    expect(mockGeneratePublishURL).toHaveBeenCalledWith(mockProjectWithReadyStep, 'user-1');
    await waitFor(() => {
      const input = screen.getByLabelText(/published link/i) as HTMLInputElement;
      expect(input.value).toContain('/published?token=token-123');
    });
  });

  it('opens URL in new tab when Open in new tab button is clicked', async () => {
    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProjectWithReadyStep} isOpen={true} onClose={vi.fn()} />);

    const publishButton = screen.getByRole('button', { name: /^publish$/i });
    await user.click(publishButton);

    const openButton = screen.getByRole('button', { name: /open in new tab/i });
    await user.click(openButton);

    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('/published?token=token-123'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('selects URL text when input is focused', async () => {
    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProjectWithReadyStep} isOpen={true} onClose={vi.fn()} />);

    const publishButton = screen.getByRole('button', { name: /^publish$/i });
    await user.click(publishButton);

    const input = screen.getByLabelText(/published link/i) as HTMLInputElement;
    await user.click(input);

    // Input should be focused and text selected
    expect(input).toHaveFocus();
    // Note: selection can't be directly tested in jsdom, but the onFocus handler is there
  });

  it('handles invalid project ID gracefully', async () => {
    const projectWithEmptyId: Project = {
      ...mockProject,
      id: '',
    };
    renderWithContext(
      <PublishModal project={projectWithEmptyId} isOpen={true} onClose={vi.fn()} />
    );

    // Should render without crashing
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const publishButton = screen.getByRole('button', { name: /^publish$/i });
    expect(publishButton).toBeDisabled();
  });

  it('does not show copy/open controls before a link exists', async () => {
    renderWithContext(<PublishModal project={mockProjectWithReadyStep} isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockGetExistingPublish).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open in new tab/i })).not.toBeInTheDocument();
  });

  it('disables publish when there are no usable steps', async () => {
    renderWithContext(
      <PublishModal project={mockProjectWithUnconfiguredStep} isOpen={true} onClose={vi.fn()} />
    );
    await waitFor(() => expect(mockGetExistingPublish).toHaveBeenCalled());

    const publishButton = screen.getByRole('button', { name: /^publish$/i });
    expect(publishButton).toBeDisabled();
    expect(screen.getAllByText(/choose a step type before publishing/i).length).toBeGreaterThan(0);
  });

  it('shows existing published URL when already published', async () => {
    mockGetExistingPublish.mockResolvedValue({
      shareToken: 'existing-token',
      url: `${window.location.origin}/published?token=existing-token`,
      isActive: true,
    });

    renderWithContext(<PublishModal project={mockProjectWithReadyStep} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const input = screen.getByLabelText(/published link/i) as HTMLInputElement;
      expect(input.value).toContain('/published?token=existing-token');
    });
    expect(screen.getByRole('button', { name: /update publish/i })).toBeInTheDocument();
  });

  it('can unpublish an existing link', async () => {
    mockGetExistingPublish.mockResolvedValue({
      shareToken: 'existing-token',
      url: `${window.location.origin}/published?token=existing-token`,
      isActive: true,
    });

    const user = userEvent.setup();
    renderWithContext(<PublishModal project={mockProjectWithReadyStep} isOpen={true} onClose={vi.fn()} />);

    const moreOptions = await screen.findByRole('button', { name: /more options/i });
    await user.click(moreOptions);
    const unpublishButton = await screen.findByRole('button', { name: /unpublish/i });
    await user.click(unpublishButton);

    expect(mockUnpublishProject).toHaveBeenCalledWith(mockProjectWithReadyStep.id, 'user-1');
  });

  it('has proper accessibility attributes', async () => {
    renderWithContext(<PublishModal project={mockProject} isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockGetExistingPublish).toHaveBeenCalled());

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Publish simulation');

    // Verify close button exists with aria-label
    const closeButton = screen.getByLabelText('Close');
    expect(closeButton).toBeInTheDocument();

    // Verify backdrop exists
    const backdrop = screen.getByLabelText(/close publish modal/i);
    expect(backdrop).toBeInTheDocument();
  });
});
