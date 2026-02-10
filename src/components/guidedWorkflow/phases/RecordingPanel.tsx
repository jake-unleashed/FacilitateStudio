import { useEffect, useState } from 'react';
import { Circle, Square } from 'lucide-react';
import type { SceneObject, SimStep } from '../../../types';
import type { LatestRecordingEndTransformRefValue } from '../../../hooks/editor/useRecordingEndTransform';
import {
  PositionSubScreen,
  RotationSubScreen,
  ScaleSubScreen,
  TransformTypeScreen,
} from './recording/RecordingPanelScreens';
import { useRecordingPanelTransforms } from './recording/useRecordingPanelTransforms';

type RecordingScreen = 'transform-type' | 'adjust-position' | 'adjust-rotation' | 'adjust-scale';

interface RecordingPanelProps {
  step: SimStep;
  objects: SceneObject[];
  onUpdateObject: (obj: SceneObject) => void;
  onStopRecording: () => void;
  latestRecordingEndPositionRef?: React.MutableRefObject<LatestRecordingEndTransformRefValue | null>;
}

/**
 * Dedicated recording panel shown during step-configuration when recording
 * an end position for a move-item step. Replaces the normal step config UI.
 *
 * Mirrors the model-positioning adjustment flow:
 * - Adjustment type selection (Position / Rotation / Scale)
 * - Position: enables TransformGizmo via guidedPositionMode data attribute
 * - Rotation: inline RotationSection sliders
 * - Scale: inline ScaleSection slider
 */
export function RecordingPanel({
  step,
  objects,
  onUpdateObject,
  onStopRecording,
  latestRecordingEndPositionRef,
}: RecordingPanelProps): JSX.Element {
  const [screen, setScreen] = useState<RecordingScreen>('transform-type');

  const { ghostLikeObject, handleRotationChange, handleScaleChange } = useRecordingPanelTransforms({
    step,
    objects,
    onUpdateObject,
    latestRecordingEndPositionRef,
  });

  // Control TransformGizmo visibility: only show in position mode
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (screen === 'adjust-position') {
      document.body.dataset.guidedPositionMode = 'position';
    } else {
      delete document.body.dataset.guidedPositionMode;
    }
    return () => {
      delete document.body.dataset.guidedPositionMode;
    };
  }, [screen]);

  return (
    <div className="space-y-4">
      {/* Header — always visible */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">End position</h2>
        <div className="flex items-center gap-2 rounded-[12px] border border-blue-200/60 bg-blue-50/50 px-3 py-2">
          <Circle size={10} className="animate-pulse fill-blue-600 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">Recording end position…</span>
        </div>
      </div>

      {/* Stop Recording */}
      <button
        type="button"
        onClick={onStopRecording}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-rose-300/60 bg-rose-100/50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:border-rose-400/80 hover:bg-rose-200/60"
      >
        <Square size={12} className="fill-rose-600" />
        Stop Recording
      </button>

      {/* Sub-screen content */}
      <div className="border-t border-white/20 pt-4">
        <div key={screen} className="guided-fade-in">
          {screen === 'transform-type' && (
            <TransformTypeScreen
              onChoosePosition={() => setScreen('adjust-position')}
              onChooseRotation={() => setScreen('adjust-rotation')}
              onChooseScale={() => setScreen('adjust-scale')}
            />
          )}

          {screen === 'adjust-position' && (
            <PositionSubScreen onBack={() => setScreen('transform-type')} />
          )}

          {screen === 'adjust-rotation' && (
            <RotationSubScreen
              ghostObject={ghostLikeObject}
              onBack={() => setScreen('transform-type')}
              onRotationChange={handleRotationChange}
            />
          )}

          {screen === 'adjust-scale' && (
            <ScaleSubScreen
              ghostObject={ghostLikeObject}
              onBack={() => setScreen('transform-type')}
              onScaleChange={handleScaleChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
