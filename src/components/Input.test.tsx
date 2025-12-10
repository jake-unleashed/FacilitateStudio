import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders without label', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Input label="Name" />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('displays the correct value', () => {
    render(<Input value="test value" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('test value');
  });

  it('applies mono font when mono prop is true', () => {
    render(<Input mono />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('font-mono');
  });

  it('applies sans font when mono prop is false', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('font-sans');
  });

  it('accepts custom className', () => {
    render(<Input className="custom-class" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  it('passes through additional HTML attributes', () => {
    render(<Input type="email" aria-label="Email address" maxLength={50} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('aria-label', 'Email address');
    expect(input).toHaveAttribute('maxLength', '50');
  });

  it('can be disabled', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('can be readonly', () => {
    render(<Input readOnly value="readonly value" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readonly');
  });

  it('applies proper styling classes', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('w-full');
    expect(input).toHaveClass('px-4');
    expect(input).toHaveClass('py-2.5');
    expect(input).toHaveClass('text-sm');
    expect(input).toHaveClass('rounded-[20px]');
  });

  it('has proper focus styles', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('focus:outline-none');
    expect(input).toHaveClass('focus:ring-4');
  });
});
