import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationHelp } from './NavigationHelp';

describe('NavigationHelp', () => {
  it('renders the help button', () => {
    render(<NavigationHelp />);
    expect(screen.getByLabelText('Open Navigation Help')).toBeInTheDocument();
  });

  it('shows navigation panel when help button is clicked', () => {
    render(<NavigationHelp />);

    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Orbit')).toBeInTheDocument();
    expect(screen.getByText('Pan')).toBeInTheDocument();
    expect(screen.getByText('Zoom')).toBeInTheDocument();
  });

  it('shows basic control instructions', () => {
    render(<NavigationHelp />);
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    expect(screen.getByText('Left Click + Drag')).toBeInTheDocument();
    expect(screen.getByText('Right Click + Drag')).toBeInTheDocument();
    expect(screen.getByText('Scroll Wheel')).toBeInTheDocument();
  });

  it('has expandable keyboard shortcuts section', () => {
    render(<NavigationHelp />);
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    // Keyboard shortcuts section is collapsed by default
    const keyboardButton = screen.getByText('Keyboard Shortcuts');
    expect(keyboardButton).toBeInTheDocument();

    // Expand keyboard shortcuts
    fireEvent.click(keyboardButton);

    // Check keyboard shortcuts are visible
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Rotate')).toBeInTheDocument();
    expect(screen.getByText('Focus Object')).toBeInTheDocument();
    expect(screen.getByText('Reset View')).toBeInTheDocument();
  });

  it('shows keyboard key badges when expanded', () => {
    render(<NavigationHelp />);
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    // Check key badges are visible
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('closes panel when not open', () => {
    render(<NavigationHelp />);

    // Panel should not be visible initially
    expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
  });

  it('closes when clicking the close button', () => {
    render(<NavigationHelp />);

    // Open
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));
    expect(screen.getByText('Navigation')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByLabelText('Close Help'));

    // Panel should be hidden
    expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
  });

  it('has default position without sidebar offset', () => {
    const { container } = render(<NavigationHelp />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('translate-x-0');
  });

  it('applies offset when sidebar is open', () => {
    const { container } = render(<NavigationHelp offsetForSidebar />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('-translate-x-[22rem]');
  });

  it('changes button label when open', () => {
    render(<NavigationHelp />);

    // Initially shows "Open Navigation Help"
    expect(screen.getByLabelText('Open Navigation Help')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    // After opening, shows "Close Help"
    expect(screen.getByLabelText('Close Help')).toBeInTheDocument();
  });

  it('has proper glass styling on button', () => {
    render(<NavigationHelp />);
    const button = screen.getByLabelText('Open Navigation Help');
    expect(button).toHaveClass('backdrop-blur-md');
    expect(button).toHaveClass('rounded-full');
  });
});
