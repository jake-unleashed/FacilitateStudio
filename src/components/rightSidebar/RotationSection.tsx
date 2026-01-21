import React, { memo, useCallback, useRef, useState } from 'react';
import { ChevronDown, Rotate3d } from 'lucide-react';

import type { RotationAxis } from './types';
import { normalizeAngle } from './utils';

export interface RotationSectionProps {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  onRotationChange: (axis: RotationAxis, rotation: number) => void;
  onRotationCommit: (axis: RotationAxis, rotation: number) => void;
  onBatchStart?: () => void;
  onBatchEnd?: () => void;
}

const ROTATION_SNAP_POINTS = [
  { value: 0, threshold: 6 },
  { value: 90, threshold: 4 },
  { value: -90, threshold: 4 },
  { value: 180, threshold: 4 },
  { value: -180, threshold: 4 },
  { value: 45, threshold: 3 },
  { value: -45, threshold: 3 },
  { value: 135, threshold: 3 },
  { value: -135, threshold: 3 },
];

const snapRotation = (value: number): number => {
  for (const snap of ROTATION_SNAP_POINTS) {
    if (Math.abs(value - snap.value) <= snap.threshold) {
      return snap.value;
    }
  }
  return value;
};

const ROTATION_TICK_MARKS = [-90, 0, 90];

const AxisSlider = memo<{
  axis: RotationAxis;
  label?: string;
  value: number;
  onChange: (value: number) => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  showLabel?: boolean;
}>(({ axis, label, value, onChange, onMouseDown, onMouseUp, onMouseLeave, showLabel = true }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = parseFloat(e.target.value);
      const snappedValue = snapRotation(rawValue);
      onChange(snappedValue);
    },
    [onChange]
  );

  const displayRotation = normalizeAngle(value);

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label || axis.toUpperCase()}
          </span>
          <span className="font-mono text-xs font-medium text-slate-400">{Math.round(displayRotation)}°</span>
        </div>
      )}
      <div className="relative">
        {ROTATION_TICK_MARKS.map((tick) => {
          const position = ((tick + 180) / 360) * 100;
          const isCenter = tick === 0;
          return (
            <div
              key={tick}
              className={`absolute top-0 z-0 w-px ${isCenter ? 'h-full bg-slate-300/60' : 'h-full bg-slate-300/30'}`}
              style={{ left: `${position}%` }}
              aria-hidden="true"
            />
          );
        })}
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={displayRotation}
          onChange={handleChange}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          className="relative z-10 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
          aria-label={`Rotation ${axis.toUpperCase()} axis slider`}
          data-testid={`rotation-${axis}-slider`}
        />
      </div>
    </div>
  );
});
AxisSlider.displayName = 'AxisSlider';

export const RotationSection = memo<RotationSectionProps>(
  ({ rotationX, rotationY, rotationZ, onRotationChange, onRotationCommit, onBatchStart, onBatchEnd }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const activeAxisRef = useRef<RotationAxis>('y');

    const handleMouseDown = useCallback(
      (axis: RotationAxis) => {
        setIsDragging(true);
        activeAxisRef.current = axis;
        onBatchStart?.();
      },
      [onBatchStart]
    );

    const handleMouseUp = useCallback(() => {
      if (isDragging) {
        setIsDragging(false);
        const axis = activeAxisRef.current;
        const value = axis === 'x' ? rotationX : axis === 'y' ? rotationY : rotationZ;
        onRotationCommit(axis, value);
        onBatchEnd?.();
      }
    }, [isDragging, rotationX, rotationY, rotationZ, onRotationCommit, onBatchEnd]);

    const handleMouseLeave = useCallback(() => {
      if (isDragging) {
        handleMouseUp();
      }
    }, [isDragging, handleMouseUp]);

    const handleYChange = useCallback(
      (value: number) => {
        const snappedValue = snapRotation(value);
        onRotationChange('y', snappedValue);
      },
      [onRotationChange]
    );
    const handleXChange = useCallback(
      (value: number) => {
        const snappedValue = snapRotation(value);
        onRotationChange('x', snappedValue);
      },
      [onRotationChange]
    );
    const handleZChange = useCallback(
      (value: number) => {
        const snappedValue = snapRotation(value);
        onRotationChange('z', snappedValue);
      },
      [onRotationChange]
    );

    const handleYMouseDown = useCallback(() => handleMouseDown('y'), [handleMouseDown]);
    const handleXMouseDown = useCallback(() => handleMouseDown('x'), [handleMouseDown]);
    const handleZMouseDown = useCallback(() => handleMouseDown('z'), [handleMouseDown]);

    const displayRotationY = normalizeAngle(rotationY);

    return (
      <div className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm" data-testid="rotation-section">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Rotate3d size={12} className="text-slate-500" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Rotation</label>
          </div>
          <span
            className="rounded-[8px] border border-white/50 bg-white/50 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm"
            data-testid="rotation-value"
          >
            {Math.round(displayRotationY)}°
          </span>
        </div>

        <div className="relative">
          {ROTATION_TICK_MARKS.map((tick) => {
            const position = ((tick + 180) / 360) * 100;
            const isCenter = tick === 0;
            return (
              <div
                key={tick}
                className={`absolute top-0 z-0 w-px ${isCenter ? 'h-full bg-slate-300/60' : 'h-full bg-slate-300/30'}`}
                style={{ left: `${position}%` }}
                aria-hidden="true"
              />
            );
          })}
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={displayRotationY}
            onChange={(e) => handleYChange(parseFloat(e.target.value))}
            onMouseDown={handleYMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="relative z-10 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
            aria-label="Rotation slider"
            data-testid="rotation-slider"
          />
        </div>
        <div className="mt-1 flex justify-between text-xs font-medium text-slate-400">
          <span>-180°</span>
          <span className="text-slate-300">0°</span>
          <span>180°</span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-[10px] py-1.5 text-xs font-medium text-slate-400 transition-all hover:bg-white/50 hover:text-slate-600"
          aria-expanded={isExpanded}
          data-testid="rotation-expand-button"
        >
          <span>{isExpanded ? 'Less options' : 'More options'}</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'mt-3 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-3 border-t border-white/30 pt-3">
            <AxisSlider
              axis="x"
              label="Tilt"
              value={rotationX}
              onChange={handleXChange}
              onMouseDown={handleXMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
            <AxisSlider
              axis="z"
              label="Roll"
              value={rotationZ}
              onChange={handleZChange}
              onMouseDown={handleZMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
          </div>
        </div>
      </div>
    );
  }
);
RotationSection.displayName = 'RotationSection';

