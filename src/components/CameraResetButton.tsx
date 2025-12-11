import React from 'react';
import { Scan } from 'lucide-react';
import CameraControlsImpl from 'camera-controls';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../constants';

interface CameraResetButtonProps {
  cameraControlsRef: React.RefObject<CameraControlsImpl | null>;
}

export const CameraResetButton: React.FC<CameraResetButtonProps> = ({ cameraControlsRef }) => {
  const handleReset = () => {
    const controls = cameraControlsRef.current;
    if (controls) {
      controls.setLookAt(
        ...DEFAULT_CAMERA_POSITION,
        ...DEFAULT_CAMERA_TARGET,
        true // smooth transition
      );
    }
  };

  return (
    <button
      onClick={handleReset}
      className="
        pointer-events-auto absolute bottom-6 left-6 z-50
        flex h-9 w-9 items-center justify-center rounded-[14px]
        border border-white/50 bg-white/70 text-slate-500
        shadow-sm backdrop-blur-md
        transition-all duration-200
        hover:bg-white/90 hover:text-slate-700 hover:shadow-md
        active:scale-95
      "
      title="Reset View"
      aria-label="Reset camera to default view"
    >
      <Scan size={15} strokeWidth={2} />
    </button>
  );
};
