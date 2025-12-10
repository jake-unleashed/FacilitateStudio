import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  const defaultProps = {
    title: 'Test Simulation',
    onTitleChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the brand name', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('Facilitate')).toBeInTheDocument();
    expect(screen.getByText('Studio')).toBeInTheDocument();
  });

  it('renders the simulation title', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('Test Simulation')).toBeInTheDocument();
  });

  it('renders control buttons', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByLabelText('Save')).toBeInTheDocument();
    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });

  it('renders Preview and Publish buttons', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('disables Undo button initially', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
  });

  it('enters edit mode when title is clicked', async () => {
    const user = userEvent.setup();
    render(<TopBar {...defaultProps} />);

    await user.click(screen.getByText('Test Simulation'));

    const input = screen.getByDisplayValue('Test Simulation');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('calls onTitleChange when title is edited and saved', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    render(<TopBar title="Old Title" onTitleChange={onTitleChange} />);

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
    render(<TopBar title="Original Title" onTitleChange={onTitleChange} />);

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
    render(<TopBar title="Original" onTitleChange={onTitleChange} />);

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
    render(<TopBar title="Original" onTitleChange={onTitleChange} />);

    await user.click(screen.getByText('Original'));

    const input = screen.getByDisplayValue('Original');
    await user.clear(input);
    fireEvent.blur(input);

    // Should not call with empty string, should revert
    expect(onTitleChange).not.toHaveBeenCalledWith('');
  });

  it('has proper glass styling', () => {
    render(<TopBar {...defaultProps} />);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-white/70');
    expect(header).toHaveClass('backdrop-blur-xl');
    expect(header).toHaveClass('rounded-[32px]');
  });
});
