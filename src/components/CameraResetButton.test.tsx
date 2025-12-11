import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraResetButton } from './CameraResetButton';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../constants';

// Mock CameraControls
const createMockCameraControls = () => ({
  setLookAt: vi.fn(),
});

describe('CameraResetButton', () => {
  it('renders the reset button', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);
    expect(screen.getByLabelText('Reset camera to default view')).toBeInTheDocument();
  });

  it('has correct title attribute', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);
    expect(screen.getByTitle('Reset View')).toBeInTheDocument();
  });

  it('calls setLookAt with correct parameters when clicked', () => {
    const mockControls = createMockCameraControls();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRef = { current: mockControls as any };

    render(<CameraResetButton cameraControlsRef={mockRef} />);

    fireEvent.click(screen.getByLabelText('Reset camera to default view'));

    expect(mockControls.setLookAt).toHaveBeenCalledWith(
      ...DEFAULT_CAMERA_POSITION,
      ...DEFAULT_CAMERA_TARGET,
      true
    );
  });

  it('calls setLookAt only once per click', () => {
    const mockControls = createMockCameraControls();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRef = { current: mockControls as any };

    render(<CameraResetButton cameraControlsRef={mockRef} />);

    fireEvent.click(screen.getByLabelText('Reset camera to default view'));
    fireEvent.click(screen.getByLabelText('Reset camera to default view'));

    expect(mockControls.setLookAt).toHaveBeenCalledTimes(2);
  });

  it('does not throw when controls are null', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);

    // Should not throw
    expect(() => {
      fireEvent.click(screen.getByLabelText('Reset camera to default view'));
    }).not.toThrow();
  });

  it('has proper styling classes', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);

    const button = screen.getByLabelText('Reset camera to default view');
    expect(button).toHaveClass('rounded-[14px]');
    expect(button).toHaveClass('backdrop-blur-md');
    expect(button).toHaveClass('pointer-events-auto');
  });

  it('is positioned in bottom-left corner', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);

    const button = screen.getByLabelText('Reset camera to default view');
    expect(button).toHaveClass('bottom-6');
    expect(button).toHaveClass('left-6');
  });

  it('has hover styles', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);

    const button = screen.getByLabelText('Reset camera to default view');
    expect(button).toHaveClass('hover:bg-white/90');
    expect(button).toHaveClass('hover:shadow-md');
  });

  it('has active scale effect', () => {
    const mockRef = { current: null };
    render(<CameraResetButton cameraControlsRef={mockRef} />);

    const button = screen.getByLabelText('Reset camera to default view');
    expect(button).toHaveClass('active:scale-95');
  });
});
