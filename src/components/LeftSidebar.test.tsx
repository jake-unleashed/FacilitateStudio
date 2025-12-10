import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftSidebar } from './LeftSidebar';
import { INITIAL_OBJECTS, INITIAL_STEPS } from '../constants';

describe('LeftSidebar', () => {
  const defaultProps = {
    activeTab: null as 'add' | 'steps' | 'scenes' | 'objects' | null,
    setActiveTab: vi.fn(),
    steps: INITIAL_STEPS,
    objects: INITIAL_OBJECTS,
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

    it('shows Recent section with assets', () => {
      render(<LeftSidebar {...defaultProps} activeTab="add" />);
      expect(screen.getByText('Recent')).toBeInTheDocument();
      expect(screen.getByText('Safety Cone')).toBeInTheDocument();
      expect(screen.getByText('Factory Wall')).toBeInTheDocument();
    });
  });

  describe('Steps Panel', () => {
    it('shows Training Flow title when steps tab is active', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      expect(screen.getByText('Training Flow')).toBeInTheDocument();
    });

    it('renders all steps', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      INITIAL_STEPS.forEach((step) => {
        expect(screen.getByText(step.description)).toBeInTheDocument();
      });
    });

    it('shows Add Step button', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      expect(screen.getByText('Add Step')).toBeInTheDocument();
    });

    it('renders step numbers', () => {
      render(<LeftSidebar {...defaultProps} activeTab="steps" />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('Objects Panel', () => {
    it('shows Scene Objects title when objects tab is active', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" />);
      expect(screen.getByText('Scene Objects')).toBeInTheDocument();
    });

    it('renders all objects', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" />);
      INITIAL_OBJECTS.forEach((obj) => {
        expect(screen.getByText(obj.name)).toBeInTheDocument();
      });
    });

    it('calls onSelectObject when object is clicked', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" />);
      fireEvent.click(screen.getByText('Primary Cube'));
      expect(defaultProps.onSelectObject).toHaveBeenCalledWith('obj-1');
    });

    it('highlights selected object', () => {
      render(<LeftSidebar {...defaultProps} activeTab="objects" selectedObjectId="obj-1" />);
      const objectItem = screen.getByText('Primary Cube').closest('div');
      expect(objectItem).toHaveClass('bg-blue-600');
      expect(objectItem).toHaveClass('text-white');
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
