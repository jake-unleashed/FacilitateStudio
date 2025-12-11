import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightSidebar } from './RightSidebar';
import { SceneObject } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockObject = (overrides: Partial<SceneObject> = {}): SceneObject => ({
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
  ...overrides,
});

const createDefaultProps = () => ({
  object: createMockObject(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
});

// ============================================================================
// Main Component Tests
// ============================================================================

describe('RightSidebar', () => {
  let defaultProps: ReturnType<typeof createDefaultProps>;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps = createDefaultProps();
  });

  describe('Rendering', () => {
    it('renders nothing when object is null', () => {
      const { container } = render(<RightSidebar {...defaultProps} object={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the sidebar container with correct structure', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
    });

    it('renders object details header', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('Object Details')).toBeInTheDocument();
    });

    it('has proper glass styling on the panel', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      const panel = container.querySelector('.bg-white\\/70.backdrop-blur-xl.rounded-\\[32px\\]');
      expect(panel).toBeInTheDocument();
    });

    it('has correct z-index for layering above other UI elements', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      const sidebar = container.querySelector('.z-\\[60\\]');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays object type icon with correct title', () => {
      render(<RightSidebar {...defaultProps} />);
      const iconContainer = screen.getByTitle('Type: mesh');
      expect(iconContainer).toBeInTheDocument();
    });

    it('uses fallback Box icon for unknown object types', () => {
      const unknownTypeObject = createMockObject({
        type: 'unknown-type' as SceneObject['type'],
      });
      render(<RightSidebar {...defaultProps} object={unknownTypeObject} />);
      const iconContainer = screen.getByTitle('Type: unknown-type');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders close button with correct aria-label', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('stops propagation when close button is clicked', () => {
      const parentClickHandler = vi.fn();
      render(
        <div onClick={parentClickHandler}>
          <RightSidebar {...defaultProps} />
        </div>
      );
      fireEvent.click(screen.getByLabelText('Close'));
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Name and Visibility Section', () => {
    it('renders object name input with current value', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument();
    });

    it('calls onUpdate when name is changed', () => {
      render(<RightSidebar {...defaultProps} />);
      const input = screen.getByDisplayValue('Test Object');
      fireEvent.change(input, { target: { value: 'New Name' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' })
      );
    });

    it('renders visibility toggle button', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByTitle('Toggle Visibility')).toBeInTheDocument();
    });

    it('shows Eye icon when object is visible', () => {
      render(<RightSidebar {...defaultProps} />);
      const visibilityButton = screen.getByTitle('Toggle Visibility');
      expect(visibilityButton).toHaveClass('text-blue-600');
    });

    it('shows EyeOff icon styling when object is not visible', () => {
      const hiddenObject = createMockObject({
        properties: { visible: false },
      });
      render(<RightSidebar {...defaultProps} object={hiddenObject} />);
      const visibilityButton = screen.getByTitle('Toggle Visibility');
      expect(visibilityButton).toHaveClass('bg-slate-100/50');
    });

    it('toggles visibility when button is clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Toggle Visibility'));

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ visible: false }),
        })
      );
    });

    it('has correct aria-label for visible state', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Hide object')).toBeInTheDocument();
    });

    it('has correct aria-label for hidden state', () => {
      const hiddenObject = createMockObject({
        properties: { visible: false },
      });
      render(<RightSidebar {...defaultProps} object={hiddenObject} />);
      expect(screen.getByLabelText('Show object')).toBeInTheDocument();
    });
  });

  describe('Scale Section', () => {
    it('renders scale section with label', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('Scale')).toBeInTheDocument();
    });

    it('displays current scale value', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('1.50x')).toBeInTheDocument();
    });

    it('renders scale slider with correct attributes', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('scale-slider');
      expect(slider).toHaveAttribute('min', '0.1');
      expect(slider).toHaveAttribute('max', '3.0');
      expect(slider).toHaveAttribute('step', '0.1');
    });

    it('updates all scale axes when slider is changed', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('scale-slider');
      fireEvent.change(slider, { target: { value: '2.0' } });

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

    it('has aria-label for accessibility', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Scale slider')).toBeInTheDocument();
    });

    it('displays scale range labels', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('0.1x')).toBeInTheDocument();
      expect(screen.getByText('3.0x')).toBeInTheDocument();
    });
  });

  describe('Rotation Section', () => {
    it('renders rotation section with label', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('Rotation')).toBeInTheDocument();
    });

    it('displays current rotation value', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('45°')).toBeInTheDocument();
    });

    it('renders all three axis buttons', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'x' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'y' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'z' })).toBeInTheDocument();
    });

    it('has Y axis selected by default', () => {
      render(<RightSidebar {...defaultProps} />);
      const yButton = screen.getByRole('button', { name: 'y' });
      expect(yButton).toHaveClass('bg-white');
    });

    it('switches rotation axis when axis buttons are clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      const xButton = screen.getByRole('button', { name: 'x' });
      fireEvent.click(xButton);
      expect(xButton).toHaveClass('bg-white');
    });

    it('has aria-pressed attribute on axis buttons', () => {
      render(<RightSidebar {...defaultProps} />);
      const yButton = screen.getByRole('button', { name: 'y' });
      const xButton = screen.getByRole('button', { name: 'x' });
      expect(yButton).toHaveAttribute('aria-pressed', 'true');
      expect(xButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('updates rotation when slider is changed', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      fireEvent.change(slider, { target: { value: '90' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: 90 }),
        })
      );
    });

    it('updates correct rotation axis when X axis is selected', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'x' }));

      const slider = screen.getByTestId('rotation-slider');
      fireEvent.change(slider, { target: { value: '45' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationX: 45 }),
        })
      );
    });

    it('updates correct rotation axis when Z axis is selected', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'z' }));

      const slider = screen.getByTestId('rotation-slider');
      fireEvent.change(slider, { target: { value: '30' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationZ: 30 }),
        })
      );
    });

    it('displays rotation range labels', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('-180°')).toBeInTheDocument();
      expect(screen.getByText('0°')).toBeInTheDocument();
      expect(screen.getByText('180°')).toBeInTheDocument();
    });

    it('renders rotation slider with correct attributes', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      expect(slider).toHaveAttribute('min', '-180');
      expect(slider).toHaveAttribute('max', '180');
      expect(slider).toHaveAttribute('step', '1');
    });
  });

  describe('Angle Normalization', () => {
    it('normalizes rotation angle 200 to -160', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: 200,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByText('-160°')).toBeInTheDocument();
    });

    it('normalizes rotation angle -200 to 160', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: -200,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByText('160°')).toBeInTheDocument();
    });

    it('normalizes rotation angle 360 to 0', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: 360,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByTestId('rotation-value')).toHaveTextContent('0°');
    });

    it('normalizes rotation angle -360 to 0', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: -360,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByTestId('rotation-value')).toHaveTextContent('0°');
    });

    it('normalizes rotation angle 540 to 180', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: 540,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByTestId('rotation-value')).toHaveTextContent('180°');
    });

    it('keeps angles within range unchanged', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: 90,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByText('90°')).toBeInTheDocument();
    });

    it('handles negative angles within range', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: -90,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByText('-90°')).toBeInTheDocument();
    });

    it('handles boundary angle 180', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: 180,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByTestId('rotation-value')).toHaveTextContent('180°');
    });

    it('handles boundary angle -180', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          rotationY: -180,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByTestId('rotation-value')).toHaveTextContent('-180°');
    });
  });

  describe('Actions Section', () => {
    it('renders Duplicate button', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
    });

    it('renders Delete button', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('calls onDelete with object id when Delete is clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByText('Delete'));
      expect(defaultProps.onDelete).toHaveBeenCalledWith('test-obj');
    });

    it('does not throw when Duplicate is clicked (no-op)', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(() => {
        fireEvent.click(screen.getByText('Duplicate'));
      }).not.toThrow();
    });

    it('has correct test IDs for action buttons', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByTestId('duplicate-button')).toBeInTheDocument();
      expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    });
  });

  describe('Different Object Types', () => {
    const objectTypes: SceneObject['type'][] = [
      'mesh',
      'light',
      'camera',
      'zone',
      'text-popup',
      'wire',
    ];

    objectTypes.forEach((type) => {
      it(`renders correctly for ${type} object type`, () => {
        const object = createMockObject({ type });
        render(<RightSidebar {...defaultProps} object={object} />);
        expect(screen.getByTitle(`Type: ${type}`)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles object with zero scale', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          scaleX: 0,
          scaleY: 0,
          scaleZ: 0,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByText('0.00x')).toBeInTheDocument();
    });

    it('handles object with maximum scale', () => {
      const object = createMockObject({
        transform: {
          ...createMockObject().transform,
          scaleX: 3,
          scaleY: 3,
          scaleZ: 3,
        },
      });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByText('3.00x')).toBeInTheDocument();
    });

    it('handles object with empty name', () => {
      const object = createMockObject({ name: '' });
      render(<RightSidebar {...defaultProps} object={object} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('handles object with very long name', () => {
      const longName = 'A'.repeat(100);
      const object = createMockObject({ name: longName });
      render(<RightSidebar {...defaultProps} object={object} />);
      expect(screen.getByDisplayValue(longName)).toBeInTheDocument();
    });

    it('preserves other transform properties when updating scale', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('scale-slider');
      fireEvent.change(slider, { target: { value: '2.0' } });

      const updateCall = defaultProps.onUpdate.mock.calls[0][0];
      expect(updateCall.transform.x).toBe(0);
      expect(updateCall.transform.y).toBe(0);
      expect(updateCall.transform.z).toBe(0);
      expect(updateCall.transform.rotationX).toBe(0);
      expect(updateCall.transform.rotationY).toBe(45);
      expect(updateCall.transform.rotationZ).toBe(0);
    });

    it('preserves other object properties when updating name', () => {
      render(<RightSidebar {...defaultProps} />);
      const input = screen.getByDisplayValue('Test Object');
      fireEvent.change(input, { target: { value: 'New Name' } });

      const updateCall = defaultProps.onUpdate.mock.calls[0][0];
      expect(updateCall.id).toBe('test-obj');
      expect(updateCall.type).toBe('mesh');
      expect(updateCall.properties.visible).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('has accessible close button', () => {
      render(<RightSidebar {...defaultProps} />);
      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    it('has accessible scale slider', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByLabelText('Scale slider');
      expect(slider).toBeInTheDocument();
    });

    it('has accessible rotation slider', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByLabelText(/Rotation .* axis slider/);
      expect(slider).toBeInTheDocument();
    });

    it('has role group for axis selection', () => {
      render(<RightSidebar {...defaultProps} />);
      const group = screen.getByRole('group', { name: 'Rotation axis selection' });
      expect(group).toBeInTheDocument();
    });

    it('has aria-hidden on decorative center marker', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      const marker = container.querySelector('[aria-hidden="true"]');
      expect(marker).toBeInTheDocument();
    });
  });
});
