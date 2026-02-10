import React, { memo, useCallback, useState } from 'react';
import { Scaling } from 'lucide-react';
import { HelpIcon } from '../HelpIcon';

export interface ScaleSectionProps {
  currentScale: number;
  /** Called when user changes the scale slider (for real-time visual updates) */
  onScaleChange: (scale: number) => void;
  /** Called when user commits the scale change (mouseup - for undo/redo) */
  onScaleCommit: (scale: number) => void;
  /** Called when slider interaction starts (for undo/redo batching) */
  onBatchStart?: () => void;
  /** Called when slider interaction ends (for undo/redo batching) */
  onBatchEnd?: () => void;
}

export const ScaleSection = memo<ScaleSectionProps>(
  ({ currentScale, onScaleChange, onScaleCommit, onBatchStart, onBatchEnd }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        onScaleChange(newValue);
      },
      [onScaleChange]
    );

    const handleMouseDown = useCallback(() => {
      setIsDragging(true);
      onBatchStart?.();
    }, [onBatchStart]);

    const handleMouseUp = useCallback(() => {
      if (isDragging) {
        setIsDragging(false);
        onScaleCommit(currentScale);
        onBatchEnd?.();
      }
    }, [isDragging, currentScale, onScaleCommit, onBatchEnd]);

    const handleMouseLeave = useCallback(() => {
      if (isDragging) {
        handleMouseUp();
      }
    }, [isDragging, handleMouseUp]);

    return (
      <div
        className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm"
        data-testid="scale-section"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Scaling size={12} className="text-slate-500" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Scale</label>
            <HelpIcon content="Make the object bigger or smaller." />
          </div>
          <span
            className="rounded-[8px] border border-white/50 bg-white/50 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm"
            data-testid="scale-value"
          >
            {currentScale.toFixed(2)}x
          </span>
        </div>

        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={currentScale}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
          aria-label="Scale slider"
          data-testid="scale-slider"
        />
        <div className="mt-1 flex justify-between text-xs font-medium text-slate-400">
          <span>0.1x</span>
          <span>3.0x</span>
        </div>
      </div>
    );
  }
);
ScaleSection.displayName = 'ScaleSection';

