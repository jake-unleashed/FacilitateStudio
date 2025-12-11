import React, { useState } from 'react';
import { SceneObject } from '../types';
import { Input } from './Input';
import { Button } from './Button';
import { Box, Eye, EyeOff, Trash2, Copy, Rotate3d, Scaling, X } from 'lucide-react';
import { OBJECT_ICONS } from '../constants';

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

const PanelHeader: React.FC<PanelHeaderProps> = ({ objectType, onClose }) => {
  const Icon = OBJECT_ICONS[objectType] || Box;

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
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-800 active:scale-95"
        aria-label="Close"
        data-testid="close-button"
      >
        <X size={18} />
      </button>
    </div>
  );
};

interface NameAndVisibilitySectionProps {
  name: string;
  visible: boolean;
  onNameChange: (name: string) => void;
  onVisibilityToggle: () => void;
}

const NameAndVisibilitySection: React.FC<NameAndVisibilitySectionProps> = ({
  name,
  visible,
  onNameChange,
  onVisibilityToggle,
}) => {
  const visibilityButtonClasses = visible
    ? 'border-white/50 bg-white/50 text-blue-600 hover:bg-white hover:shadow-sm'
    : 'border-transparent bg-slate-100/50 text-slate-400 hover:bg-slate-200';

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <Input
          label="Name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
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
};

interface ScaleSectionProps {
  currentScale: number;
  onScaleChange: (scale: number) => void;
}

const ScaleSection: React.FC<ScaleSectionProps> = ({ currentScale, onScaleChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onScaleChange(parseFloat(e.target.value));
  };

  return (
    <div
      className="rounded-[20px] border border-white/40 bg-white/40 p-4 shadow-sm"
      data-testid="scale-section"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scaling size={14} className="text-slate-500" />
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Scale</label>
        </div>
        <span
          className="rounded-[12px] border border-white/50 bg-white/50 px-2 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm"
          data-testid="scale-value"
        >
          {currentScale.toFixed(2)}x
        </span>
      </div>

      <div className="px-1">
        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={currentScale}
          onChange={handleChange}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
          aria-label="Scale slider"
          data-testid="scale-slider"
        />
        <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
          <span>0.1x</span>
          <span>3.0x</span>
        </div>
      </div>
    </div>
  );
};

interface RotationSectionProps {
  activeAxis: RotationAxis;
  displayRotation: number;
  onAxisChange: (axis: RotationAxis) => void;
  onRotationChange: (rotation: number) => void;
}

const ROTATION_AXES: readonly RotationAxis[] = ['x', 'y', 'z'] as const;

const RotationSection: React.FC<RotationSectionProps> = ({
  activeAxis,
  displayRotation,
  onAxisChange,
  onRotationChange,
}) => {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onRotationChange(parseFloat(e.target.value));
  };

  return (
    <div
      className="rounded-[20px] border border-white/40 bg-white/40 p-4 shadow-sm"
      data-testid="rotation-section"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rotate3d size={14} className="text-slate-500" />
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Rotation
          </label>
        </div>
        <span
          className="rounded-[12px] border border-white/50 bg-white/50 px-2 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm"
          data-testid="rotation-value"
        >
          {Math.round(displayRotation)}°
        </span>
      </div>

      <div className="space-y-4">
        {/* Axis Toggles */}
        <div
          className="flex rounded-[20px] border border-white/20 bg-slate-100/50 p-1"
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
                className={`flex-1 rounded-[12px] py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${buttonClasses}`}
                aria-pressed={isActive}
                data-testid={`axis-${axis}-button`}
              >
                {axis}
              </button>
            );
          })}
        </div>

        {/* Slider with Center-Zero (-180 to 180) */}
        <div className="relative px-1">
          {/* Center Marker */}
          <div
            className="absolute bottom-4 left-1/2 top-[-6px] z-0 w-px bg-slate-300/50"
            aria-hidden="true"
          />

          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={displayRotation}
            onChange={handleSliderChange}
            className="relative z-10 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 transition-all hover:accent-blue-500"
            aria-label={`Rotation ${activeAxis.toUpperCase()} axis slider`}
            data-testid="rotation-slider"
          />
          <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
            <span>-180°</span>
            <span className="text-slate-300">0°</span>
            <span>180°</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActionsSectionProps {
  onDuplicate: () => void;
  onDelete: () => void;
}

const ActionsSection: React.FC<ActionsSectionProps> = ({ onDuplicate, onDelete }) => {
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
        variant="glass"
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
};

// ============================================================================
// Main Component
// ============================================================================

export const RightSidebar: React.FC<RightSidebarProps> = ({
  object,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const [activeRotAxis, setActiveRotAxis] = useState<RotationAxis>('y');

  // Early return if no object is selected
  if (!object) return null;

  // ---- Event Handlers ----

  const handleNameChange = (name: string) => {
    onUpdate({ ...object, name });
  };

  const handleVisibilityToggle = () => {
    onUpdate({
      ...object,
      properties: {
        ...object.properties,
        visible: !object.properties.visible,
      },
    });
  };

  const handleScaleChange = (scale: number) => {
    onUpdate({
      ...object,
      transform: {
        ...object.transform,
        scaleX: scale,
        scaleY: scale,
        scaleZ: scale,
      },
    });
  };

  const handleRotationChange = (rotation: number) => {
    const rotationKey = getRotationKey(activeRotAxis);
    onUpdate({
      ...object,
      transform: {
        ...object.transform,
        [rotationKey]: rotation,
      },
    });
  };

  const handleDuplicate = () => {
    // Duplicate functionality - currently a no-op, will be implemented later
    // This is intentionally left empty as per the original implementation
  };

  const handleDelete = () => {
    onDelete(object.id);
  };

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
        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          <NameAndVisibilitySection
            name={object.name}
            visible={object.properties.visible}
            onNameChange={handleNameChange}
            onVisibilityToggle={handleVisibilityToggle}
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
