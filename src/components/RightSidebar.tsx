import React, { useState, memo, useCallback, useMemo } from 'react';
import { SceneObject } from '../types';
import { Input } from './Input';
import { Button } from './Button';
import { Box, Eye, EyeOff, Trash2, Copy, Rotate3d, Scaling, X, ArrowUpDown } from 'lucide-react';
import { OBJECT_ICONS } from '../constants';
import {
  calculateLowestPointOffset,
  heightToYPosition,
  yPositionToHeight,
} from '../utils/groundHeight';

// ============================================================================
// Types
// ============================================================================

type RotationAxis = 'x' | 'y' | 'z';

interface RightSidebarProps {
  object: SceneObject | null;
  onUpdate: (updated: SceneObject) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalizes an angle to the range [-180, 180] degrees.
 * This ensures consistent display of rotation values regardless of
 * how many full rotations have occurred.
 */
const normalizeAngle = (angle: number): number => {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
};

/**
 * Gets the transform key for a given rotation axis.
 */
const getRotationKey = (axis: RotationAxis): 'rotationX' | 'rotationY' | 'rotationZ' => {
  const keyMap: Record<RotationAxis, 'rotationX' | 'rotationY' | 'rotationZ'> = {
    x: 'rotationX',
    y: 'rotationY',
    z: 'rotationZ',
  };
  return keyMap[axis];
};

// ============================================================================
// Sub-Components
// ============================================================================

interface PanelHeaderProps {
  objectType: SceneObject['type'];
  onClose: () => void;
}

const PanelHeader = memo<PanelHeaderProps>(({ objectType, onClose }) => {
  const Icon = OBJECT_ICONS[objectType] || Box;

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-500/20"
          title={`Type: ${objectType}`}
          data-testid="object-type-icon"
        >
          <Icon size={16} />
        </div>
        <h2 className="truncate text-sm font-bold text-slate-900">Object Details</h2>
      </div>
      <button
        onClick={handleClose}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800 active:scale-95"
        aria-label="Close"
        data-testid="close-button"
      >
        <X size={18} />
      </button>
    </div>
  );
});
PanelHeader.displayName = 'PanelHeader';

interface NameAndVisibilitySectionProps {
  name: string;
  visible: boolean;
  onNameChange: (name: string) => void;
  onVisibilityToggle: () => void;
}

const NameAndVisibilitySection = memo<NameAndVisibilitySectionProps>(
  ({ name, visible, onNameChange, onVisibilityToggle }) => {
    const visibilityButtonClasses = visible
      ? 'border-white/50 bg-white/50 text-blue-600 hover:bg-white hover:shadow-sm'
      : 'border-transparent bg-slate-100/50 text-slate-400 hover:bg-slate-200';

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onNameChange(e.target.value);
      },
      [onNameChange]
    );

    return (
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Name"
            value={name}
            onChange={handleChange}
            className="text-sm font-semibold"
            data-testid="object-name-input"
          />
        </div>
        <button
          onClick={onVisibilityToggle}
          className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[20px] border transition-all duration-200 ${visibilityButtonClasses}`}
          title="Toggle Visibility"
          aria-label={visible ? 'Hide object' : 'Show object'}
          data-testid="visibility-toggle"
        >
          {visible ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      </div>
    );
  }
);
NameAndVisibilitySection.displayName = 'NameAndVisibilitySection';

interface HeightSectionProps {
  /** Height above ground in internal units (where 100 = 1 meter) */
  groundRelativeHeight: number;
  /** Called when user changes the height slider */
  onHeightChange: (newHeight: number) => void;
}

const HeightSection = memo<HeightSectionProps>(({ groundRelativeHeight, onHeightChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onHeightChange(parseFloat(e.target.value));
    },
    [onHeightChange]
  );

  // Convert internal units to display units (divide by 100 for meters)
  const displayHeight = groundRelativeHeight / 100;

  return (
    <div
      className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm"
      data-testid="height-section"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={12} className="text-slate-500" />
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Height
          </label>
        </div>
        <span
          className="rounded-[8px] border border-white/50 bg-white/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 shadow-sm"
          data-testid="height-value"
        >
          {displayHeight.toFixed(2)}m
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="500"
        step="5"
        value={groundRelativeHeight}
        onChange={handleChange}
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
        aria-label="Height slider"
        data-testid="height-slider"
      />
      <div className="mt-1 flex justify-between text-[9px] font-medium text-slate-400">
        <span>0m</span>
        <span>5m</span>
      </div>
    </div>
  );
});
HeightSection.displayName = 'HeightSection';

interface ScaleSectionProps {
  currentScale: number;
  onScaleChange: (scale: number) => void;
}

const ScaleSection = memo<ScaleSectionProps>(({ currentScale, onScaleChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onScaleChange(parseFloat(e.target.value));
    },
    [onScaleChange]
  );

  return (
    <div
      className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm"
      data-testid="scale-section"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scaling size={12} className="text-slate-500" />
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Scale
          </label>
        </div>
        <span
          className="rounded-[8px] border border-white/50 bg-white/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 shadow-sm"
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
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
        aria-label="Scale slider"
        data-testid="scale-slider"
      />
      <div className="mt-1 flex justify-between text-[9px] font-medium text-slate-400">
        <span>0.1x</span>
        <span>3.0x</span>
      </div>
    </div>
  );
});
ScaleSection.displayName = 'ScaleSection';

interface RotationSectionProps {
  activeAxis: RotationAxis;
  displayRotation: number;
  onAxisChange: (axis: RotationAxis) => void;
  onRotationChange: (rotation: number) => void;
}

const ROTATION_AXES: readonly RotationAxis[] = ['x', 'y', 'z'] as const;

const RotationSection = memo<RotationSectionProps>(
  ({ activeAxis, displayRotation, onAxisChange, onRotationChange }) => {
    const handleSliderChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onRotationChange(parseFloat(e.target.value));
      },
      [onRotationChange]
    );

    return (
      <div
        className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm"
        data-testid="rotation-section"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Rotate3d size={12} className="text-slate-500" />
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Rotation
            </label>
          </div>
          <span
            className="rounded-[8px] border border-white/50 bg-white/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 shadow-sm"
            data-testid="rotation-value"
          >
            {Math.round(displayRotation)}°
          </span>
        </div>

        {/* Axis toggles + Slider in compact layout */}
        <div className="flex items-center gap-2">
          {/* Axis Toggles - Compact */}
          <div
            className="flex shrink-0 rounded-[10px] border border-white/20 bg-slate-100/50 p-0.5"
            role="group"
            aria-label="Rotation axis selection"
          >
            {ROTATION_AXES.map((axis) => {
              const isActive = activeAxis === axis;
              const buttonClasses = isActive
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                : 'text-slate-400 hover:bg-white/50 hover:text-slate-600';

              return (
                <button
                  key={axis}
                  onClick={() => onAxisChange(axis)}
                  className={`rounded-[8px] px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${buttonClasses}`}
                  aria-pressed={isActive}
                  data-testid={`axis-${axis}-button`}
                >
                  {axis}
                </button>
              );
            })}
          </div>

          {/* Slider with Center-Zero (-180 to 180) */}
          <div className="relative flex-1">
            {/* Center Marker */}
            <div
              className="absolute bottom-0 left-1/2 top-0 z-0 w-px bg-slate-300/40"
              aria-hidden="true"
            />

            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={displayRotation}
              onChange={handleSliderChange}
              className="relative z-10 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
              aria-label={`Rotation ${activeAxis.toUpperCase()} axis slider`}
              data-testid="rotation-slider"
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between pl-[72px] text-[9px] font-medium text-slate-400">
          <span>-180°</span>
          <span className="text-slate-300">0°</span>
          <span>180°</span>
        </div>
      </div>
    );
  }
);
RotationSection.displayName = 'RotationSection';

interface ActionsSectionProps {
  onDuplicate: () => void;
  onDelete: () => void;
}

const ActionsSection = memo<ActionsSectionProps>(({ onDuplicate, onDelete }) => {
  return (
    <div className="mt-auto grid grid-cols-2 gap-3 pt-2" data-testid="actions-section">
      <Button
        variant="secondary"
        size="md"
        className="h-10 w-full justify-center rounded-[20px] border-transparent bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
        onClick={onDuplicate}
        data-testid="duplicate-button"
      >
        <Copy size={14} className="mr-2" />
        Duplicate
      </Button>
      <Button
        variant="secondary"
        size="md"
        className="h-10 w-full justify-center rounded-[20px] border-red-100/50 bg-red-50/50 text-xs font-semibold text-red-500 shadow-none hover:border-red-200 hover:bg-red-100 hover:text-red-600"
        onClick={onDelete}
        data-testid="delete-button"
      >
        <Trash2 size={14} className="mr-2" />
        Delete
      </Button>
    </div>
  );
});
ActionsSection.displayName = 'ActionsSection';

// ============================================================================
// Main Component
// ============================================================================

const RightSidebarInner: React.FC<RightSidebarProps> = ({
  object,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const [activeRotAxis, setActiveRotAxis] = useState<RotationAxis>('y');

  // ---- Memoized Calculations ----
  // Note: All hooks must be called unconditionally (before any early returns)

  // Calculate the lowest point offset based on current rotation and scale
  const lowestPointOffset = useMemo(() => {
    if (!object) return 0;
    return calculateLowestPointOffset(
      object.transform.rotationX,
      object.transform.rotationY,
      object.transform.rotationZ,
      object.transform.scaleX,
      object.transform.scaleY,
      object.transform.scaleZ
    );
  }, [object]);

  // Calculate ground-relative height from Y position
  const groundRelativeHeight = useMemo(() => {
    if (!object) return 0;
    return yPositionToHeight(object.transform.y, lowestPointOffset);
  }, [object, lowestPointOffset]);

  // ---- Memoized Event Handlers ----

  const handleNameChange = useCallback(
    (name: string) => {
      if (!object) return;
      onUpdate({ ...object, name });
    },
    [object, onUpdate]
  );

  const handleVisibilityToggle = useCallback(() => {
    if (!object) return;
    onUpdate({
      ...object,
      properties: {
        ...object.properties,
        visible: !object.properties.visible,
      },
    });
  }, [object, onUpdate]);

  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (!object) return;
      const newY = heightToYPosition(newHeight, lowestPointOffset);
      onUpdate({
        ...object,
        transform: {
          ...object.transform,
          y: newY,
        },
      });
    },
    [object, onUpdate, lowestPointOffset]
  );

  const handleScaleChange = useCallback(
    (scale: number) => {
      if (!object) return;
      const newLowestPointOffset = calculateLowestPointOffset(
        object.transform.rotationX,
        object.transform.rotationY,
        object.transform.rotationZ,
        scale,
        scale,
        scale
      );
      const currentHeightAboveGround = yPositionToHeight(object.transform.y, lowestPointOffset);
      const newY = heightToYPosition(currentHeightAboveGround, newLowestPointOffset);

      onUpdate({
        ...object,
        transform: {
          ...object.transform,
          scaleX: scale,
          scaleY: scale,
          scaleZ: scale,
          y: newY,
        },
      });
    },
    [object, onUpdate, lowestPointOffset]
  );

  const handleRotationChange = useCallback(
    (rotation: number) => {
      if (!object) return;
      const rotationKey = getRotationKey(activeRotAxis);
      const newRotationX = rotationKey === 'rotationX' ? rotation : object.transform.rotationX;
      const newRotationY = rotationKey === 'rotationY' ? rotation : object.transform.rotationY;
      const newRotationZ = rotationKey === 'rotationZ' ? rotation : object.transform.rotationZ;

      const newLowestPointOffset = calculateLowestPointOffset(
        newRotationX,
        newRotationY,
        newRotationZ,
        object.transform.scaleX,
        object.transform.scaleY,
        object.transform.scaleZ
      );
      const currentHeightAboveGround = yPositionToHeight(object.transform.y, lowestPointOffset);
      const newY = heightToYPosition(currentHeightAboveGround, newLowestPointOffset);

      onUpdate({
        ...object,
        transform: {
          ...object.transform,
          [rotationKey]: rotation,
          y: newY,
        },
      });
    },
    [object, onUpdate, activeRotAxis, lowestPointOffset]
  );

  const handleDuplicate = useCallback(() => {
    // Duplicate functionality - currently a no-op, will be implemented later
  }, []);

  const handleDelete = useCallback(() => {
    if (!object) return;
    onDelete(object.id);
  }, [object, onDelete]);

  // ---- Early return after all hooks ----
  if (!object) return null;

  // ---- Computed Values ----
  const rotationKey = getRotationKey(activeRotAxis);
  const currentRotation = object.transform[rotationKey];
  const displayRotation = normalizeAngle(currentRotation);
  const currentScale = object.transform.scaleX;

  // ---- Render ----

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 top-24 z-[60] flex w-80 flex-col"
      data-testid="right-sidebar"
    >
      {/* Floating Panel - Tier 1 Rounding (32px) */}
      <div className="pointer-events-auto flex flex-1 origin-right flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl transition-all duration-500 ease-out">
        <PanelHeader objectType={object.type} onClose={onClose} />

        {/* Content */}
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          <NameAndVisibilitySection
            name={object.name}
            visible={object.properties.visible}
            onNameChange={handleNameChange}
            onVisibilityToggle={handleVisibilityToggle}
          />

          <HeightSection
            groundRelativeHeight={groundRelativeHeight}
            onHeightChange={handleHeightChange}
          />

          <ScaleSection currentScale={currentScale} onScaleChange={handleScaleChange} />

          <RotationSection
            activeAxis={activeRotAxis}
            displayRotation={displayRotation}
            onAxisChange={setActiveRotAxis}
            onRotationChange={handleRotationChange}
          />

          <ActionsSection onDuplicate={handleDuplicate} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
};

// Export memoized component
export const RightSidebar = memo(RightSidebarInner);
