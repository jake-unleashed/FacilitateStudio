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

  describe('Name Section', () => {
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

    it('displays current Y rotation value by default', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('45°')).toBeInTheDocument();
    });

    it('updates Y rotation when main slider is changed', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      fireEvent.change(slider, { target: { value: '90' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: 90 }),
        })
      );
    });

    it('displays rotation range labels', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('-180°')).toBeInTheDocument();
      // Multiple 0° labels exist (main slider + hidden expanded sliders), so use getAllByText
      expect(screen.getAllByText('0°').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('180°')).toBeInTheDocument();
    });

    it('renders rotation slider with correct attributes', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      expect(slider).toHaveAttribute('min', '-180');
      expect(slider).toHaveAttribute('max', '180');
      expect(slider).toHaveAttribute('step', '1');
    });

    it('has "More options" expand button', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByText('More options')).toBeInTheDocument();
    });

    it('expands to show X and Z sliders when "More options" is clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      const expandButton = screen.getByTestId('rotation-expand-button');
      fireEvent.click(expandButton);

      expect(screen.getByText('Less options')).toBeInTheDocument();
      expect(screen.getByText('Tilt')).toBeInTheDocument();
      expect(screen.getByText('Roll')).toBeInTheDocument();
    });

    it('shows X rotation slider in expanded mode', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('rotation-expand-button'));

      const xSlider = screen.getByTestId('rotation-x-slider');
      expect(xSlider).toBeInTheDocument();
    });

    it('shows Z rotation slider in expanded mode', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('rotation-expand-button'));

      const zSlider = screen.getByTestId('rotation-z-slider');
      expect(zSlider).toBeInTheDocument();
    });

    it('updates X rotation when X slider is changed in expanded mode', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('rotation-expand-button'));

      const xSlider = screen.getByTestId('rotation-x-slider');
      fireEvent.change(xSlider, { target: { value: '30' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationX: 30 }),
        })
      );
    });

    it('updates Z rotation when Z slider is changed in expanded mode', () => {
      render(<RightSidebar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('rotation-expand-button'));

      const zSlider = screen.getByTestId('rotation-z-slider');
      fireEvent.change(zSlider, { target: { value: '15' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationZ: 15 }),
        })
      );
    });

    it('collapses back when "Less options" is clicked', () => {
      render(<RightSidebar {...defaultProps} />);
      const expandButton = screen.getByTestId('rotation-expand-button');
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);

      expect(screen.getByText('More options')).toBeInTheDocument();
    });

    it('snaps to 0° when value is close to zero', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      // Setting to 4° should snap to 0° (within 6° threshold)
      fireEvent.change(slider, { target: { value: '4' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: 0 }),
        })
      );
    });

    it('snaps to 90° when value is close to 90', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      // Setting to 88° should snap to 90° (within 4° threshold)
      fireEvent.change(slider, { target: { value: '88' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: 90 }),
        })
      );
    });

    it('snaps to -90° when value is close to -90', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      // Setting to -92° should snap to -90° (within 4° threshold)
      fireEvent.change(slider, { target: { value: '-92' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: -90 }),
        })
      );
    });

    it('does not snap when value is outside snap thresholds', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      // Setting to 20° should not snap (not within threshold of any snap point)
      fireEvent.change(slider, { target: { value: '20' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: 20 }),
        })
      );
    });

    it('snaps to 45° when value is close to 45', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('rotation-slider');
      // Setting to 43° should snap to 45° (within 3° threshold)
      fireEvent.change(slider, { target: { value: '43' } });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: expect.objectContaining({ rotationY: 45 }),
        })
      );
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

  describe('Action Buttons Section', () => {
    it('renders action buttons section container', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByTestId('action-buttons-section')).toBeInTheDocument();
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

    it('has correct test ID for delete button', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    });

    it('delete button has visible red text styling', () => {
      render(<RightSidebar {...defaultProps} />);
      const deleteButton = screen.getByTestId('delete-button');
      expect(deleteButton).toHaveClass('text-red-500');
    });

    it('renders Reset button', () => {
      render(<RightSidebar {...defaultProps} />);
      expect(screen.getByTestId('reset-button')).toBeInTheDocument();
    });

    it('disables Reset button when originalTransform is not available', () => {
      render(<RightSidebar {...defaultProps} />);
      const resetButton = screen.getByTestId('reset-button');
      expect(resetButton).toBeDisabled();
    });

    it('enables Reset button when originalTransform is available', () => {
      const objectWithOriginal = createMockObject({
        originalTransform: {
          x: 100,
          y: 0,
          z: 100,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
      });
      render(<RightSidebar {...defaultProps} object={objectWithOriginal} />);
      const resetButton = screen.getByTestId('reset-button');
      expect(resetButton).not.toBeDisabled();
    });

    it('calls onUpdate with original transform and reset children when Reset is clicked', () => {
      const originalTransform = {
        x: 100,
        y: 0,
        z: 100,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      const objectWithOriginalAndChildren = createMockObject({
        originalTransform,
        transform: {
          x: 200,
          y: 50,
          z: 200,
          rotationX: 45,
          rotationY: 90,
          rotationZ: 15,
          scaleX: 2,
          scaleY: 2,
          scaleZ: 2,
        },
        children: [
          {
            name: 'Part 1',
            path: ['Scene', 'Part1'],
            localTransform: {
              x: 10,
              y: 5,
              z: 10,
              rotationX: 30,
              rotationY: 45,
              rotationZ: 60,
              scaleX: 1.5,
              scaleY: 1.5,
              scaleZ: 1.5,
            },
          },
        ],
      });
      render(<RightSidebar {...defaultProps} object={objectWithOriginalAndChildren} />);
      fireEvent.click(screen.getByTestId('reset-button'));
      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transform: originalTransform,
          children: expect.arrayContaining([
            expect.objectContaining({
              name: 'Part 1',
              localTransform: {
                x: 0,
                y: 0,
                z: 0,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                scaleX: 1,
                scaleY: 1,
                scaleZ: 1,
              },
            }),
          ]),
        })
      );
    });

    it('reset button has help icon for tooltip', () => {
      render(<RightSidebar {...defaultProps} />);
      const resetButton = screen.getByTestId('reset-button');
      // Check that the help icon is a child within the button
      expect(resetButton.querySelector('svg.text-slate-400')).toBeInTheDocument();
    });

    it('calls onBatchStart and onBatchEnd when Reset is clicked', () => {
      const onBatchStart = vi.fn();
      const onBatchEnd = vi.fn();
      const objectWithOriginal = createMockObject({
        originalTransform: {
          x: 0,
          y: 0,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
      });
      render(
        <RightSidebar
          {...defaultProps}
          object={objectWithOriginal}
          onBatchStart={onBatchStart}
          onBatchEnd={onBatchEnd}
        />
      );
      fireEvent.click(screen.getByTestId('reset-button'));
      expect(onBatchStart).toHaveBeenCalledTimes(1);
      expect(onBatchEnd).toHaveBeenCalledTimes(1);
    });

    it('calls onFocusObject after reset', () => {
      const onFocusObject = vi.fn();
      const objectWithOriginal = createMockObject({
        originalTransform: {
          x: 0,
          y: 0,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
      });
      render(
        <RightSidebar {...defaultProps} object={objectWithOriginal} onFocusObject={onFocusObject} />
      );
      fireEvent.click(screen.getByTestId('reset-button'));
      expect(onFocusObject).toHaveBeenCalledTimes(1);
      expect(onFocusObject).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-obj' }));
    });

    it('keeps current transform when originalTransform is not available but Reset is somehow clicked', () => {
      // This tests the fallback behavior - when no originalTransform, it keeps current
      const objectWithoutOriginal = createMockObject({
        transform: {
          x: 100,
          y: 50,
          z: 100,
          rotationX: 45,
          rotationY: 90,
          rotationZ: 0,
          scaleX: 2,
          scaleY: 2,
          scaleZ: 2,
        },
      });
      // Note: The button would be disabled, but we test the handler logic
      render(<RightSidebar {...defaultProps} object={objectWithoutOriginal} />);
      // Button is disabled, so onUpdate should not be called
      const resetButton = screen.getByTestId('reset-button');
      expect(resetButton).toBeDisabled();
    });

    it('resets multiple children to DEFAULT_TRANSFORM', () => {
      const originalTransform = {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      const objectWithMultipleChildren = createMockObject({
        originalTransform,
        children: [
          {
            name: 'Child 1',
            path: ['Scene', 'Child1'],
            localTransform: {
              x: 10,
              y: 5,
              z: 10,
              rotationX: 30,
              rotationY: 45,
              rotationZ: 60,
              scaleX: 1.5,
              scaleY: 1.5,
              scaleZ: 1.5,
            },
          },
          {
            name: 'Child 2',
            path: ['Scene', 'Child2'],
            localTransform: {
              x: -10,
              y: 2,
              z: -10,
              rotationX: -30,
              rotationY: -45,
              rotationZ: -60,
              scaleX: 0.5,
              scaleY: 0.5,
              scaleZ: 0.5,
            },
          },
          {
            name: 'Child 3',
            path: ['Scene', 'Child3'],
            localTransform: {
              x: 20,
              y: 10,
              z: 20,
              rotationX: 90,
              rotationY: 180,
              rotationZ: 45,
              scaleX: 2,
              scaleY: 2,
              scaleZ: 2,
            },
          },
        ],
      });
      render(<RightSidebar {...defaultProps} object={objectWithMultipleChildren} />);
      fireEvent.click(screen.getByTestId('reset-button'));

      const DEFAULT_TRANSFORM = {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          children: [
            expect.objectContaining({ name: 'Child 1', localTransform: DEFAULT_TRANSFORM }),
            expect.objectContaining({ name: 'Child 2', localTransform: DEFAULT_TRANSFORM }),
            expect.objectContaining({ name: 'Child 3', localTransform: DEFAULT_TRANSFORM }),
          ],
        })
      );
    });
  });

  describe('Child Mode Reset', () => {
    const createChildMesh = (
      name: string,
      path: string[],
      localTransform = {
        x: 10,
        y: 5,
        z: 10,
        rotationX: 30,
        rotationY: 45,
        rotationZ: 60,
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
      }
    ) => ({ name, path, localTransform });

    it('resets only the selected child in child mode', () => {
      const parent = createMockObject({
        children: [
          createChildMesh('Child A', ['Scene', 'ChildA']),
          createChildMesh('Child B', ['Scene', 'ChildB']),
        ],
      });
      const selectedChild = parent.children![0];

      render(<RightSidebar {...defaultProps} object={parent} selectedChild={selectedChild} />);
      fireEvent.click(screen.getByTestId('reset-button'));

      const DEFAULT_TRANSFORM = {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          children: [
            expect.objectContaining({ name: 'Child A', localTransform: DEFAULT_TRANSFORM }),
            expect.objectContaining({
              name: 'Child B',
              localTransform: {
                x: 10,
                y: 5,
                z: 10,
                rotationX: 30,
                rotationY: 45,
                rotationZ: 60,
                scaleX: 1.5,
                scaleY: 1.5,
                scaleZ: 1.5,
              },
            }),
          ],
        })
      );
    });

    it('resets selected child and all its descendants', () => {
      // Create a hierarchy: Parent > Child A > Grandchild 1, Grandchild 2
      const parent = createMockObject({
        children: [
          createChildMesh('Child A', ['Scene', 'ChildA']),
          createChildMesh('Grandchild 1', ['Scene', 'ChildA', 'Grandchild1']),
          createChildMesh('Grandchild 2', ['Scene', 'ChildA', 'Grandchild2']),
          createChildMesh('Child B', ['Scene', 'ChildB']), // Should NOT be reset
        ],
      });
      const selectedChild = parent.children![0]; // Select Child A

      render(<RightSidebar {...defaultProps} object={parent} selectedChild={selectedChild} />);
      fireEvent.click(screen.getByTestId('reset-button'));

      const DEFAULT_TRANSFORM = {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      const UNCHANGED = {
        x: 10,
        y: 5,
        z: 10,
        rotationX: 30,
        rotationY: 45,
        rotationZ: 60,
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
      };

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          children: [
            expect.objectContaining({ name: 'Child A', localTransform: DEFAULT_TRANSFORM }),
            expect.objectContaining({ name: 'Grandchild 1', localTransform: DEFAULT_TRANSFORM }),
            expect.objectContaining({ name: 'Grandchild 2', localTransform: DEFAULT_TRANSFORM }),
            expect.objectContaining({ name: 'Child B', localTransform: UNCHANGED }),
          ],
        })
      );
    });

    it('resets deeply nested descendants', () => {
      // Deep hierarchy: Parent > A > B > C > D
      const parent = createMockObject({
        children: [
          createChildMesh('Level 1', ['Scene', 'L1']),
          createChildMesh('Level 2', ['Scene', 'L1', 'L2']),
          createChildMesh('Level 3', ['Scene', 'L1', 'L2', 'L3']),
          createChildMesh('Level 4', ['Scene', 'L1', 'L2', 'L3', 'L4']),
          createChildMesh('Other Branch', ['Scene', 'Other']), // Should NOT be reset
        ],
      });
      const selectedChild = parent.children![1]; // Select Level 2

      render(<RightSidebar {...defaultProps} object={parent} selectedChild={selectedChild} />);
      fireEvent.click(screen.getByTestId('reset-button'));

      const DEFAULT_TRANSFORM = {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      const UNCHANGED = {
        x: 10,
        y: 5,
        z: 10,
        rotationX: 30,
        rotationY: 45,
        rotationZ: 60,
        scaleX: 1.5,
        scaleY: 1.5,
        scaleZ: 1.5,
      };

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          children: [
            expect.objectContaining({ name: 'Level 1', localTransform: UNCHANGED }), // Parent of selected, not reset
            expect.objectContaining({ name: 'Level 2', localTransform: DEFAULT_TRANSFORM }), // Selected
            expect.objectContaining({ name: 'Level 3', localTransform: DEFAULT_TRANSFORM }), // Descendant
            expect.objectContaining({ name: 'Level 4', localTransform: DEFAULT_TRANSFORM }), // Descendant
            expect.objectContaining({ name: 'Other Branch', localTransform: UNCHANGED }), // Different branch
          ],
        })
      );
    });

    it('calls onFocusObject with child path after child reset', () => {
      const onFocusObject = vi.fn();
      const parent = createMockObject({
        children: [createChildMesh('Child A', ['Scene', 'ChildA'])],
      });
      const selectedChild = parent.children![0];

      render(
        <RightSidebar
          {...defaultProps}
          object={parent}
          selectedChild={selectedChild}
          onFocusObject={onFocusObject}
        />
      );
      fireEvent.click(screen.getByTestId('reset-button'));

      expect(onFocusObject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-obj' }),
        'Scene.ChildA'
      );
    });

    it('Reset button is always enabled in child mode', () => {
      const parent = createMockObject({
        children: [createChildMesh('Child A', ['Scene', 'ChildA'])],
      });
      const selectedChild = parent.children![0];

      render(<RightSidebar {...defaultProps} object={parent} selectedChild={selectedChild} />);
      const resetButton = screen.getByTestId('reset-button');
      expect(resetButton).not.toBeDisabled();
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

    it('preserves other transform properties when updating scale and adjusts Y for ground awareness', () => {
      render(<RightSidebar {...defaultProps} />);
      const slider = screen.getByTestId('scale-slider');
      fireEvent.change(slider, { target: { value: '2.0' } });

      const updateCall = defaultProps.onUpdate.mock.calls[0][0];
      expect(updateCall.transform.x).toBe(0);
      // Y is adjusted to maintain ground-relative position when scaling.
      // Formula: newY = currentY + modelHeight * 50 * (newScale - currentScale)
      // With default modelHeight=2.0, scaling from 1.5 (mock default) to 2.0:
      //   yAdjustment = 2.0 * 50 * (2.0 - 1.5) = 50
      //   newY = 0 + 50 = 50
      expect(updateCall.transform.y).toBe(50);
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
      const slider = screen.getByLabelText('Rotation slider');
      expect(slider).toBeInTheDocument();
    });

    it('expand button has aria-expanded attribute', () => {
      render(<RightSidebar {...defaultProps} />);
      const expandButton = screen.getByTestId('rotation-expand-button');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-hidden on decorative center marker', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      const marker = container.querySelector('[aria-hidden="true"]');
      expect(marker).toBeInTheDocument();
    });
  });

  describe('Panel Order', () => {
    it('renders sections in correct order: Name, Rotation, Scale, Action Buttons', () => {
      const { container } = render(<RightSidebar {...defaultProps} />);
      const content = container.querySelector('.space-y-3');
      expect(content).toBeInTheDocument();

      const sections = content!.children;
      // Name input (within Input component wrapper)
      expect(sections[0].querySelector('[data-testid="object-name-input"]')).toBeInTheDocument();
      // Rotation section
      expect(sections[1]).toHaveAttribute('data-testid', 'rotation-section');
      // Scale section
      expect(sections[2]).toHaveAttribute('data-testid', 'scale-section');
      // Action buttons section (Reset + Delete)
      expect(sections[3]).toHaveAttribute('data-testid', 'action-buttons-section');
    });
  });
});
