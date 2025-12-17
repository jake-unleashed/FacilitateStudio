import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordingModeOverlay } from './RecordingModeOverlay';
import type { SimStep, SceneObject } from '../types';

describe('RecordingModeOverlay', () => {
  const mockTargetObject: SceneObject = {
    id: 'test-object-1',
    name: 'Test Cube',
    type: 'mesh',
    transform: {
      x: 0,
      y: 50,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    properties: {
      visible: true,
      color: '#3b82f6',
    },
  };

  const mockRecordingStep: SimStep = {
    id: 'step-1',
    title: 'Move the cube',
    type: 'move-item',
    completed: false,
    targetObjectId: 'test-object-1',
    startPosition: { x: 0, y: 50, z: 0 },
  };

  const mockOnStopRecording = vi.fn();

  it('should not render when recordingStep is null', () => {
    const { container } = render(
      <RecordingModeOverlay
        recordingStep={null}
        targetObject={mockTargetObject}
        onStopRecording={mockOnStopRecording}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render when targetObject is null', () => {
    const { container } = render(
      <RecordingModeOverlay
        recordingStep={mockRecordingStep}
        targetObject={null}
        onStopRecording={mockOnStopRecording}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render overlay with correct content when both props are provided', () => {
    render(
      <RecordingModeOverlay
        recordingStep={mockRecordingStep}
        targetObject={mockTargetObject}
        onStopRecording={mockOnStopRecording}
      />
    );

    expect(screen.getByText('Recording End Position')).toBeInTheDocument();
    expect(screen.getByText('Test Cube')).toBeInTheDocument();
    expect(screen.getByText('Stop Recording')).toBeInTheDocument();
  });

  it('should call onStopRecording when Stop Recording button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RecordingModeOverlay
        recordingStep={mockRecordingStep}
        targetObject={mockTargetObject}
        onStopRecording={mockOnStopRecording}
      />
    );

    const stopButton = screen.getByText('Stop Recording');
    await user.click(stopButton);

    expect(mockOnStopRecording).toHaveBeenCalledOnce();
  });

  it('should display the recording animation icon', () => {
    const { container } = render(
      <RecordingModeOverlay
        recordingStep={mockRecordingStep}
        targetObject={mockTargetObject}
        onStopRecording={mockOnStopRecording}
      />
    );

    // Check for the animated circle icon (pulse animation class)
    const animatedIcon = container.querySelector('.animate-pulse');
    expect(animatedIcon).toBeInTheDocument();
  });

  it('should be positioned below the top bar (pt-20)', () => {
    const { container } = render(
      <RecordingModeOverlay
        recordingStep={mockRecordingStep}
        targetObject={mockTargetObject}
        onStopRecording={mockOnStopRecording}
      />
    );

    const overlay = container.querySelector('.pt-20');
    expect(overlay).toBeInTheDocument();
  });

  it('should have pointer-events-auto on the overlay content', () => {
    const { container } = render(
      <RecordingModeOverlay
        recordingStep={mockRecordingStep}
        targetObject={mockTargetObject}
        onStopRecording={mockOnStopRecording}
      />
    );

    const overlay = container.querySelector('.pointer-events-auto');
    expect(overlay).toBeInTheDocument();
  });
});

