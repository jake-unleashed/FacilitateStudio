import React from 'react';
import { Circle } from 'lucide-react';
import { SimStep, SceneObject } from '../types';

interface RecordingModeOverlayProps {
  recordingStep: SimStep | null;
  targetObject: SceneObject | null;
  onStopRecording: () => void;
}

export const RecordingModeOverlay: React.FC<RecordingModeOverlayProps> = ({
  recordingStep,
  targetObject,
  onStopRecording,
}) => {
  if (!recordingStep || !targetObject) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="pointer-events-auto rounded-[20px] border border-purple-300/60 bg-gradient-to-br from-purple-50/90 to-white/70 px-6 py-4 shadow-lg shadow-purple-500/20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Circle size={16} className="animate-pulse fill-purple-600 text-purple-600" />
            <div>
              <div className="text-sm font-semibold text-purple-700">Recording End Transform</div>
              <div className="text-xs text-purple-600">{targetObject.name}</div>
            </div>
          </div>
          <button
            onClick={onStopRecording}
            className="ml-4 rounded-[12px] border border-rose-300/60 bg-gradient-to-br from-rose-100/80 to-rose-200/60 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm shadow-rose-500/10 transition-all hover:border-rose-400/80 hover:bg-gradient-to-br hover:from-rose-200/90 hover:to-rose-300/70 hover:shadow-md hover:shadow-rose-500/20"
          >
            Stop Recording
          </button>
        </div>
      </div>
    </div>
  );
};
