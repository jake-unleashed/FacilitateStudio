import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftSidebar } from './LeftSidebar';
import { SceneObject, SimStep } from '../types';

// Test data for when we need objects/steps
const TEST_OBJECTS: SceneObject[] = [
  {
    id: 'obj-1',
    name: 'Test Cube',
    type: 'mesh',
    transform: {
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
    properties: { visible: true, color: '#3b82f6' },
  },
  {
    id: 'obj-2',
    name: 'Test Sphere',
    type: 'mesh',
    transform: {
      x: 100,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    properties: { visible: true, color: '#eab308' },
  },
];

const TEST_STEPS: SimStep[] = [
  { id: 'step-1', title: 'Step 1', description: 'First test step', completed: true },
  { id: 'step-2', title: 'Step 2', description: 'Second test step', completed: false },
  { id: 'step-3', title: 'Step 3', description: 'Third test step', completed: false },
];

describe('LeftSidebar', () => {
  const defaultProps = {
    activeTab: null as 'add' | 'steps' | 'scenes' | 'objects' | null,
    setActiveTab: vi.fn(),
    steps: [] as SimStep[],
    objects: [] as SceneObject[],
    onSelectObject: vi.fn(),
    selectedObjectId: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders navigation buttons', () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
  });

  it('calls setActiveTab when Add button is clicked', () => {
    render(<LeftSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Add'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('add');
  });

  it('calls setActiveTab when Objects button is clicked', () => {
    render(<LeftSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Objects'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('objects');
  });

  it('calls setActiveTab when Steps button is clicked', () => {
    render(<LeftSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Steps'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('steps');
  });

  it('toggles tab off when clicking active tab', () => {
    render(<LeftSidebar {...defaultProps} activeTab="add" />);
    fireEvent.click(screen.getByText('Add'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith(null);
  });

  describe('Add Panel', () => {
    it('shows Library title when add tab is active', () => {
      render(<LeftSidebar {...defaultProps} activeTab="add" />);
      expect(screen.getByText('Library')).toBeInTheDocument();
    });

    it('shows Upload Asset section', () => {
      render(<LeftSidebar {...defaultProps} activeTab="add" />);
      expect(screen.getByText('Upload Asset')).toBeInTheDocument();
    });

    it('shows Recent section with empty state', () => {
      render(<LeftSidebar {...defaultProps} activeTab="add" />);
      expect(screen.getByText('Recent')).toBeInTheDocument();
      expect(screen.getByText('No recent assets')).toBeInTheDocument();
      expect(screen.getByText('Uploaded assets will appear here')).toBeInTheDocument();
    });
  });

  describe('Steps Panel', () => {
    it('shows Training Flow title when steps tab is active', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      expect(screen.getByText('Training Flow')).toBeInTheDocument();
    });

    it('renders all steps when provided', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" steps={TEST_STEPS} />);
      TEST_STEPS.forEach((step) => {
        expect(screen.getByText(step.description)).toBeInTheDocument();
      });
    });

    it('shows Add Step button', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      expect(screen.getByText('Add Step')).toBeInTheDocument();
    });

    it('renders step numbers when steps provided', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" steps={TEST_STEPS} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows only Add Step button when no steps', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      expect(screen.getByText('Add Step')).toBeInTheDocument();
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('Objects Panel', () => {
    it('shows Scene Objects title when objects tab is active', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" />);
      expect(screen.getByText('Scene Objects')).toBeInTheDocument();
    });

    it('renders all objects when provided', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" objects={TEST_OBJECTS} />);
      TEST_OBJECTS.forEach((obj) => {
        expect(screen.getByText(obj.name)).toBeInTheDocument();
      });
    });

    it('calls onSelectObject when object is clicked', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" objects={TEST_OBJECTS} />);
      fireEvent.click(screen.getByText('Test Cube'));
      expect(defaultProps.onSelectObject).toHaveBeenCalledWith('obj-1');
    });

    it('highlights selected object', () => {
      render(
        <LeftSidebar
          {...defaultProps}
          activeTab="objects"
          objects={TEST_OBJECTS}
          selectedObjectId="obj-1"
        />
      );
      const objectItem = screen.getByText('Test Cube').closest('div');
      expect(objectItem).toHaveClass('bg-blue-600');
      expect(objectItem).toHaveClass('text-white');
    });

    it('shows empty state when no objects', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" />);
      expect(screen.getByText('Scene Objects')).toBeInTheDocument();
      expect(screen.getByText('No objects in scene')).toBeInTheDocument();
      expect(screen.getByText('Library')).toBeInTheDocument();
    });

    it('opens Library panel when Library link is clicked in empty state', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" />);
      fireEvent.click(screen.getByText('Library'));
      expect(defaultProps.setActiveTab).toHaveBeenCalledWith('add');
    });

    it('uses fallback Box icon for unknown object types', () => {
      const unknownTypeObjects = [
        {
          id: 'obj-unknown',
          name: 'Unknown Object',
          type: 'unknown-type',
          transform: {
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
          properties: { visible: true, color: '#333' },
        },
      ];
      render(<LeftSidebar {...defaultProps} activeTab="objects" objects={unknownTypeObjects} />);
      expect(screen.getByText('Unknown Object')).toBeInTheDocument();
    });
  });

  it('has minimize button that closes the panel', () => {
    render(<LeftSidebar {...defaultProps} activeTab="add" />);
    fireEvent.click(screen.getByTitle('Minimize Sidebar'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith(null);
  });

  it('has proper glass styling on navigation strip', () => {
    const { container } = render(<LeftSidebar {...defaultProps} />);
    const navStrip = container.querySelector('.bg-white\\/70.backdrop-blur-xl.rounded-\\[32px\\]');
    expect(navStrip).toBeInTheDocument();
  });
});
