import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TopBar } from './TopBar';

// Helper to render with router context
function renderTopBar(props: { title: string; onTitleChange: (title: string) => void }) {
  return render(
    <MemoryRouter>
      <TopBar {...props} />
    </MemoryRouter>
  );
}

describe('TopBar', () => {
  const defaultProps = {
    title: 'Test Simulation',
    onTitleChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the brand name', () => {
    renderTopBar(defaultProps);
    // Facilitate text appears twice (gradient and solid overlay)
    const facilitateElements = screen.getAllByText('Facilitate');
    expect(facilitateElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Studio')).toBeInTheDocument();
  });

  it('renders the simulation title', () => {
    renderTopBar(defaultProps);
    expect(screen.getByText('Test Simulation')).toBeInTheDocument();
  });

  it('renders control buttons', () => {
    renderTopBar(defaultProps);
    expect(screen.getByLabelText('Save')).toBeInTheDocument();
    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });

  it('renders Preview and Publish buttons', () => {
    renderTopBar(defaultProps);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('disables Undo button initially', () => {
    renderTopBar(defaultProps);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
  });

  it('enters edit mode when title is clicked', async () => {
    const user = userEvent.setup();
    renderTopBar(defaultProps);

    await user.click(screen.getByText('Test Simulation'));

    const input = screen.getByDisplayValue('Test Simulation');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('calls onTitleChange when title is edited and saved', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    renderTopBar({ title: 'Old Title', onTitleChange });

    await user.click(screen.getByText('Old Title'));

    const input = screen.getByDisplayValue('Old Title');
    await user.clear(input);
    await user.type(input, 'New Title');
    await user.keyboard('{Enter}');

    expect(onTitleChange).toHaveBeenCalledWith('New Title');
  });

  it('reverts to original title on Escape', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    renderTopBar({ title: 'Original Title', onTitleChange });

    await user.click(screen.getByText('Original Title'));

    const input = screen.getByDisplayValue('Original Title');
    await user.clear(input);
    await user.type(input, 'Modified Title');
    await user.keyboard('{Escape}');

    expect(onTitleChange).not.toHaveBeenCalled();
    expect(screen.getByText('Original Title')).toBeInTheDocument();
  });

  it('saves title on blur', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    renderTopBar({ title: 'Original', onTitleChange });

    await user.click(screen.getByText('Original'));

    const input = screen.getByDisplayValue('Original');
    await user.clear(input);
    await user.type(input, 'Blurred Title');
    fireEvent.blur(input);

    expect(onTitleChange).toHaveBeenCalledWith('Blurred Title');
  });

  it('does not save empty title', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    renderTopBar({ title: 'Original', onTitleChange });

    await user.click(screen.getByText('Original'));

    const input = screen.getByDisplayValue('Original');
    await user.clear(input);
    fireEvent.blur(input);

    // Should not call with empty string, should revert
    expect(onTitleChange).not.toHaveBeenCalledWith('');
  });

  it('has proper glass styling', () => {
    renderTopBar(defaultProps);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-white/70');
    expect(header).toHaveClass('backdrop-blur-xl');
    expect(header).toHaveClass('rounded-[32px]');
  });

  it('brand logo uses font-bold to match app typography', () => {
    renderTopBar(defaultProps);
    // Find the h1 that contains the brand name
    const brandHeading = screen.getByRole('heading', { level: 1 });
    expect(brandHeading).toHaveClass('font-bold');
  });
});
