import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationHelp } from './NavigationHelp';

describe('NavigationHelp', () => {
  it('renders the help button', () => {
    render(<NavigationHelp />);
    expect(screen.getByLabelText('Open Navigation Help')).toBeInTheDocument();
  });

  it('shows navigation controls when help button is clicked', () => {
    render(<NavigationHelp />);

    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    expect(screen.getByText('Navigation Controls')).toBeInTheDocument();
    expect(screen.getByText('Orbit / Rotate')).toBeInTheDocument();
    expect(screen.getByText('Pan View')).toBeInTheDocument();
    expect(screen.getByText('Zoom In/Out')).toBeInTheDocument();
  });

  it('shows control instructions', () => {
    render(<NavigationHelp />);
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    expect(screen.getByText('Left Click + Drag')).toBeInTheDocument();
    expect(screen.getByText('Right Click + Drag')).toBeInTheDocument();
    expect(screen.getByText('Scroll Wheel')).toBeInTheDocument();
  });

  it('closes when clicking the close button', () => {
    render(<NavigationHelp />);

    // Open
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));
    expect(screen.getByText('Navigation Controls')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByLabelText('Close Help'));

    // Check that navigation controls panel is hidden (has opacity-0)
    const panel = screen.getByText('Navigation Controls').closest('div');
    expect(panel).toHaveClass('opacity-0');
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

  it('has proper glass styling', () => {
    render(<NavigationHelp />);
    fireEvent.click(screen.getByLabelText('Open Navigation Help'));

    const panel = screen.getByText('Navigation Controls').closest('div');
    expect(panel).toHaveClass('bg-white/80');
    expect(panel).toHaveClass('backdrop-blur-xl');
    expect(panel).toHaveClass('rounded-[32px]');
  });
});
