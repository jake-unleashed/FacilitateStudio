import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightSidebar } from './RightSidebar';
import { SceneObject } from '../types';

describe('RightSidebar', () => {
  const mockObject: SceneObject = {
    id: 'test-obj',
    name: 'Test Object',
    type: 'mesh',
    transform: {
      x: 0,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 45,
      rotationZ: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      scaleZ: 1.5,
    },
    properties: {
      visible: true,
      grabbable: true,
      color: '#3b82f6',
    },
  };

  const defaultProps = {
    object: mockObject,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when object is null', () => {
    const { container } = render(<RightSidebar {...defaultProps} object={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders object details header', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('Object Details')).toBeInTheDocument();
  });

  it('renders object name input', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument();
  });

  it('calls onUpdate when name is changed', async () => {
    render(<RightSidebar {...defaultProps} />);

    const input = screen.getByDisplayValue('Test Object');
    fireEvent.change(input, { target: { value: 'New Name' } });

    expect(defaultProps.onUpdate).toHaveBeenCalled();
    const lastCall = defaultProps.onUpdate.mock.calls[defaultProps.onUpdate.mock.calls.length - 1];
    expect(lastCall[0].name).toBe('New Name');
  });

  it('renders visibility toggle', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByTitle('Toggle Visibility')).toBeInTheDocument();
  });

  it('toggles visibility when button is clicked', () => {
    render(<RightSidebar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Toggle Visibility'));

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          visible: false,
        }),
      })
    );
  });

  it('renders scale slider', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('Scale')).toBeInTheDocument();
    expect(screen.getByText('1.50x')).toBeInTheDocument();
  });

  it('renders rotation controls with axis toggles', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'z' })).toBeInTheDocument();
  });

  it('displays current rotation value', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('45°')).toBeInTheDocument();
  });

  it('renders Duplicate button', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('renders Delete button', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onDelete when Delete button is clicked', () => {
    render(<RightSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('test-obj');
  });

  it('calls onClose when close button is clicked', () => {
    render(<RightSidebar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('updates scale when slider is changed', () => {
    render(<RightSidebar {...defaultProps} />);
    const sliders = screen.getAllByRole('slider');
    const scaleSlider = sliders[0]; // First slider is scale

    fireEvent.change(scaleSlider, { target: { value: '2.0' } });

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        transform: expect.objectContaining({
          scaleX: 2.0,
          scaleY: 2.0,
          scaleZ: 2.0,
        }),
      })
    );
  });

  it('switches rotation axis when axis buttons are clicked', () => {
    render(<RightSidebar {...defaultProps} />);

    // Initially Y axis is selected (default)
    const xButton = screen.getByRole('button', { name: 'x' });
    fireEvent.click(xButton);

    // X button should now be styled as active
    expect(xButton).toHaveClass('bg-white');
  });

  it('has proper glass styling', () => {
    const { container } = render(<RightSidebar {...defaultProps} />);
    const panel = container.querySelector('.bg-white\\/70.backdrop-blur-xl.rounded-\\[32px\\]');
    expect(panel).toBeInTheDocument();
  });

  it('normalizes rotation angles correctly', () => {
    const objectWith200Rotation = {
      ...mockObject,
      transform: { ...mockObject.transform, rotationY: 200 },
    };
    render(<RightSidebar {...defaultProps} object={objectWith200Rotation} />);
    // 200 should be normalized to -160
    expect(screen.getByText('-160°')).toBeInTheDocument();
  });

  it('updates rotation when rotation slider is changed', () => {
    render(<RightSidebar {...defaultProps} />);
    const sliders = screen.getAllByRole('slider');
    const rotationSlider = sliders[1]; // Second slider is rotation

    fireEvent.change(rotationSlider, { target: { value: '90' } });

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        transform: expect.objectContaining({
          rotationY: 90,
        }),
      })
    );
  });

  it('updates correct rotation axis when X axis is selected', () => {
    render(<RightSidebar {...defaultProps} />);

    // Switch to X axis
    fireEvent.click(screen.getByRole('button', { name: 'x' }));

    // Change rotation
    const sliders = screen.getAllByRole('slider');
    const rotationSlider = sliders[1];
    fireEvent.change(rotationSlider, { target: { value: '45' } });

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        transform: expect.objectContaining({
          rotationX: 45,
        }),
      })
    );
  });

  it('updates correct rotation axis when Z axis is selected', () => {
    render(<RightSidebar {...defaultProps} />);

    // Switch to Z axis
    fireEvent.click(screen.getByRole('button', { name: 'z' }));

    // Change rotation
    const sliders = screen.getAllByRole('slider');
    const rotationSlider = sliders[1];
    fireEvent.change(rotationSlider, { target: { value: '30' } });

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        transform: expect.objectContaining({
          rotationZ: 30,
        }),
      })
    );
  });

  it('shows EyeOff icon when object is not visible', () => {
    const hiddenObject = {
      ...mockObject,
      properties: { ...mockObject.properties, visible: false },
    };
    render(<RightSidebar {...defaultProps} object={hiddenObject} />);

    const visibilityButton = screen.getByTitle('Toggle Visibility');
    expect(visibilityButton).toHaveClass('bg-slate-100/50');
  });

  it('normalizes negative rotation angles correctly', () => {
    const objectWithNegativeRotation = {
      ...mockObject,
      transform: { ...mockObject.transform, rotationY: -200 },
    };
    render(<RightSidebar {...defaultProps} object={objectWithNegativeRotation} />);
    // -200 should be normalized to 160
    expect(screen.getByText('160°')).toBeInTheDocument();
  });

  it('displays object type icon in header', () => {
    render(<RightSidebar {...defaultProps} />);
    const iconContainer = screen.getByTitle('Type: mesh');
    expect(iconContainer).toBeInTheDocument();
  });

  it('uses fallback Box icon for unknown object types', () => {
    const unknownTypeObject = {
      ...mockObject,
      type: 'unknown-type',
    };
    render(<RightSidebar {...defaultProps} object={unknownTypeObject} />);
    const iconContainer = screen.getByTitle('Type: unknown-type');
    expect(iconContainer).toBeInTheDocument();
  });
});
