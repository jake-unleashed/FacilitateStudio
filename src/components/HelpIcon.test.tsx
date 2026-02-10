import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { HelpIcon } from './HelpIcon';

describe('HelpIcon', () => {
  it('renders help icon', () => {
    render(<HelpIcon content="Test help text" />);
    const icon = screen.getByRole('button', { name: 'Help' });
    expect(icon).toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup();
    render(<HelpIcon content="Test help text" />);
    
    const icon = screen.getByRole('button', { name: 'Help' });
    await user.hover(icon);
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Test help text');
  });

  it('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup();
    render(<HelpIcon content="Test help text" />);
    
    const icon = screen.getByRole('button', { name: 'Help' });
    await user.hover(icon);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    
    await user.unhover(icon);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', async () => {
    const user = userEvent.setup();
    render(<HelpIcon content="Test help text" />);
    
    await user.tab(); // Focus the icon
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Test help text');
  });

  it('hides tooltip on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <HelpIcon content="Test help text" />
        <button>Other button</button>
      </>
    );
    
    await user.tab(); // Focus the icon
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    
    await user.tab(); // Focus next element (blur icon)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('hides tooltip on Escape key', async () => {
    const user = userEvent.setup();
    render(<HelpIcon content="Test help text" />);
    
    await user.tab(); // Focus the icon
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses custom aria-label when provided', () => {
    render(<HelpIcon content="Test help text" ariaLabel="Custom help label" />);
    expect(screen.getByRole('button', { name: 'Custom help label' })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<HelpIcon content="Test help text" className="custom-class" />);
    const icon = screen.getByRole('button', { name: 'Help' });
    expect(icon).toHaveClass('custom-class');
  });

  it('associates tooltip with icon via aria-describedby', async () => {
    const user = userEvent.setup();
    render(<HelpIcon content="Test help text" />);
    
    const icon = screen.getByRole('button', { name: 'Help' });
    await user.hover(icon);
    
    const tooltip = screen.getByRole('tooltip');
    const tooltipId = tooltip.getAttribute('id');
    expect(icon).toHaveAttribute('aria-describedby', tooltipId);
  });

  it('does not have aria-describedby when tooltip is hidden', () => {
    render(<HelpIcon content="Test help text" />);
    const icon = screen.getByRole('button', { name: 'Help' });
    expect(icon).not.toHaveAttribute('aria-describedby');
  });
});
