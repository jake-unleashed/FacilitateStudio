import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByText('Primary');
    expect(button).toHaveClass('bg-blue-600');
    expect(button).toHaveClass('text-white');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByText('Secondary');
    expect(button).toHaveClass('bg-white/60');
    expect(button).toHaveClass('text-slate-800');
  });

  it('applies ghost variant styles', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByText('Ghost');
    expect(button).toHaveClass('text-slate-600');
  });

  it('applies glass variant styles', () => {
    render(<Button variant="glass">Glass</Button>);
    const button = screen.getByText('Glass');
    expect(button).toHaveClass('bg-white/30');
    expect(button).toHaveClass('backdrop-blur-md');
  });

  it('applies guidance variant styles', () => {
    render(<Button variant="guidance">Guidance</Button>);
    const button = screen.getByText('Guidance');
    expect(button).toHaveClass('bg-purple-500/10');
  });

  it('applies small size styles', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByText('Small');
    expect(button).toHaveClass('text-xs');
    expect(button).toHaveClass('px-3');
    expect(button).toHaveClass('py-1.5');
  });

  it('applies medium size styles by default', () => {
    render(<Button>Medium</Button>);
    const button = screen.getByText('Medium');
    expect(button).toHaveClass('text-sm');
    expect(button).toHaveClass('px-5');
    expect(button).toHaveClass('py-2.5');
  });

  it('applies large size styles', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByText('Large');
    expect(button).toHaveClass('text-base');
    expect(button).toHaveClass('px-7');
    expect(button).toHaveClass('py-3.5');
  });

  it('applies icon size styles', () => {
    render(<Button size="icon">🔍</Button>);
    const button = screen.getByText('🔍');
    expect(button).toHaveClass('p-2.5');
    expect(button).toHaveClass('rounded-full');
  });

  it('can be disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
    expect(button).toHaveClass('disabled:cursor-not-allowed');
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('accepts custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByText('Custom');
    expect(button).toHaveClass('custom-class');
  });

  it('passes through additional HTML attributes', () => {
    render(
      <Button type="submit" aria-label="Submit form">
        Submit
      </Button>
    );
    const button = screen.getByText('Submit');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-label', 'Submit form');
  });
});
