import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepCard } from './StepCard';
import type { SimStep, SceneObject } from '../types';

describe('StepCard - Recording Mode', () => {
  const mockObjects: SceneObject[] = [
    {
      id: 'cube-1',
      name: 'Test Cube 1',
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
    },
    {
      id: 'cube-2',
      name: 'Test Cube 2',
      type: 'mesh',
      transform: {
        x: 100,
        y: 50,
        z: 100,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      properties: {
        visible: true,
        color: '#ef4444',
      },
    },
  ];

  const mockMoveItemStep: SimStep = {
    id: 'step-1',
    title: 'Move the cube',
    description: '',
    type: 'move-item',
    completed: false,
    targetObjectId: 'cube-1',
    startPosition: { x: 0, y: 50, z: 0 },
  };

  const mockOnUpdate = vi.fn();
  const mockOnMinimize = vi.fn();
  const mockOnStartRecording = vi.fn();
  const mockOnStopRecording = vi.fn();
  const mockOnFocusObject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Target Object Selection', () => {
    it('should show "Use Selected Object" button when an object is selected', () => {
      const stepWithoutTarget: SimStep = {
        ...mockMoveItemStep,
        targetObjectId: undefined,
        startPosition: undefined,
      };

      render(
        <StepCard
          step={stepWithoutTarget}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId="cube-1"
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.getByText('Use Selected Object')).toBeInTheDocument();
    });

    it('should call onUpdate with targetObjectId and startPosition when "Use Selected Object" is clicked', async () => {
      const user = userEvent.setup();
      const stepWithoutTarget: SimStep = {
        ...mockMoveItemStep,
        targetObjectId: undefined,
        startPosition: undefined,
      };

      render(
        <StepCard
          step={stepWithoutTarget}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId="cube-1"
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      const useButton = screen.getByText('Use Selected Object');
      await user.click(useButton);

      expect(mockOnUpdate).toHaveBeenCalled();
      const updatedStep = mockOnUpdate.mock.calls[0][0];
      expect(updatedStep.targetObjectId).toBe('cube-1');
      expect(updatedStep.startPosition).toEqual({ x: 0, y: 50, z: 0 });
    });

    it('should disable "Use Selected Object" button when no object is selected', () => {
      const stepWithoutTarget: SimStep = {
        ...mockMoveItemStep,
        targetObjectId: undefined,
        startPosition: undefined,
      };

      render(
        <StepCard
          step={stepWithoutTarget}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      const useButton = screen.getByText('Use Selected Object').closest('button');
      expect(useButton).toBeDisabled();
    });

    it('should display target object name and icon when target is set', () => {
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.getByText('Test Cube 1')).toBeInTheDocument();
    });

    it('should call onFocusObject when target object pill is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      const targetButton = screen.getByText('Test Cube 1').closest('button');
      expect(targetButton).toBeInTheDocument();
      await user.click(targetButton!);

      expect(mockOnFocusObject).toHaveBeenCalledWith(mockObjects[0]);
    });

    it('should remove target object when X button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      // Hover over the target object button to reveal the X button
      const targetButton = screen.getByText('Test Cube 1').closest('.group') as HTMLElement | null;
      expect(targetButton).toBeInTheDocument();

      // Find and click the remove button (X icon)
      const removeButton = within(targetButton!).getByTitle('Remove target object');
      await user.click(removeButton);

      expect(mockOnUpdate).toHaveBeenCalled();
      const updatedStep = mockOnUpdate.mock.calls[0][0];
      expect(updatedStep.targetObjectId).toBeUndefined();
      expect(updatedStep.startPosition).toBeUndefined();
      expect(updatedStep.endPosition).toBeUndefined();
    });
  });

  describe('Recording End Transform', () => {
    it('should show "Record End Transform" button when target object is set', () => {
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.getByText('Record End Transform')).toBeInTheDocument();
    });

    it('should call onStartRecording when "Record End Transform" button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      const recordButton = screen.getByText('Record End Transform');
      await user.click(recordButton);

      expect(mockOnStartRecording).toHaveBeenCalledOnce();
    });

    it('should show recording state when isRecordingPosition is true', () => {
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={true}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(
        screen.getByText(/Recording\.\.\. Move\/rotate\/scale the object to its end transform/)
      ).toBeInTheDocument();
      expect(screen.getByText('Stop Recording')).toBeInTheDocument();
    });

    it('should call onStopRecording when "Stop Recording" button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={true}
          onFocusObject={mockOnFocusObject}
        />
      );

      const stopButton = screen.getByText('Stop Recording');
      await user.click(stopButton);

      expect(mockOnStopRecording).toHaveBeenCalledOnce();
    });

    it('should show "End transform recorded" status when endPosition is set', () => {
      const stepWithEndPosition: SimStep = {
        ...mockMoveItemStep,
        endPosition: { x: 200, y: 50, z: 200 },
      };

      render(
        <StepCard
          step={stepWithEndPosition}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.getByText('End transform recorded')).toBeInTheDocument();
    });

    it('should change button text to "Record New Transform" when endPosition exists', () => {
      const stepWithEndPosition: SimStep = {
        ...mockMoveItemStep,
        endPosition: { x: 200, y: 50, z: 200 },
      };

      render(
        <StepCard
          step={stepWithEndPosition}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.getByText('Record New Transform')).toBeInTheDocument();
    });

    it('should show warning when target object is deleted', () => {
      const stepWithMissingObject: SimStep = {
        ...mockMoveItemStep,
        targetObjectId: 'deleted-object',
      };

      render(
        <StepCard
          step={stepWithMissingObject}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.getByText('Object not found. It may have been deleted.')).toBeInTheDocument();
    });
  });

  describe('Info Card Type', () => {
    it('should not show recording controls for info-card type', () => {
      const infoCardStep: SimStep = {
        id: 'step-2',
        title: 'Information Step',
        description: '',
        type: 'info-card',
        completed: false,
        heading: 'Test Heading',
        bodyText: 'Test Body',
        buttonText: 'OK',
      };

      render(
        <StepCard
          step={infoCardStep}
          isOpen={true}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(screen.queryByText('Record End Transform')).not.toBeInTheDocument();
      expect(screen.queryByText('Target Object')).not.toBeInTheDocument();
    });
  });

  describe('Minimized State', () => {
    it('should not render any content when isOpen is false', () => {
      const { container } = render(
        <StepCard
          step={mockMoveItemStep}
          isOpen={false}
          onUpdate={mockOnUpdate}
          onMinimize={mockOnMinimize}
          selectedObjectId={null}
          objects={mockObjects}
          onStartRecording={mockOnStartRecording}
          onStopRecording={mockOnStopRecording}
          isRecordingPosition={false}
          onFocusObject={mockOnFocusObject}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
