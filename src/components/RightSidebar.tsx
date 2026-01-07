import React, { useState, memo, useCallback, useRef } from 'react';
import { SceneObject, ChildMesh, pathToString } from '../types';
import { Input } from './Input';
import { Button } from './Button';
import { Box, Trash2, Rotate3d, Scaling, X, Layers, ChevronDown } from 'lucide-react';
import { OBJECT_ICONS } from '../constants';
import { calculateScaleAdjustedY, DEFAULT_MODEL_HEIGHT } from '../utils/groundHeight';

// ============================================================================
// Types
// ============================================================================

type RotationAxis = 'x' | 'y' | 'z';

interface RightSidebarProps {
  object: SceneObject | null;
  /** Selected child mesh (if any) - when set, shows child details instead of parent */
  selectedChild?: ChildMesh | null;
  onUpdate: (updated: SceneObject) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** Callback when a batch operation starts (for undo/redo batching) */
  onBatchStart?: () => void;
  /** Callback when a batch operation ends (for undo/redo batching) */
  onBatchEnd?: () => void;
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
  isChild?: boolean;
  onClose: () => void;
}

const PanelHeader = memo<PanelHeaderProps>(({ objectType, isChild = false, onClose }) => {
  // Use Layers icon for children, object type icon for parents
  const Icon = isChild ? Layers : OBJECT_ICONS[objectType] || Box;

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  // Blue for parents, emerald/green for children (matching Scene Objects panel)
  const iconClasses = isChild
    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
    : 'bg-blue-500 text-white shadow-md shadow-blue-500/20';

  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ${iconClasses}`}
          title={isChild ? 'Child Object' : `Type: ${objectType}`}
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

interface NameSectionProps {
  name: string;
  onNameChange: (name: string) => void;
}

const NameSection = memo<NameSectionProps>(({ name, onNameChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNameChange(e.target.value);
    },
    [onNameChange]
  );

  return (
    <Input
      label="Name"
      value={name}
      onChange={handleChange}
      className="text-sm font-semibold"
      data-testid="object-name-input"
    />
  );
});
NameSection.displayName = 'NameSection';

interface ScaleSectionProps {
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

const ScaleSection = memo<ScaleSectionProps>(
  ({ currentScale, onScaleChange, onScaleCommit, onBatchStart, onBatchEnd }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        // Update visual state in real-time during drag
        onScaleChange(newValue);
      },
      [onScaleChange]
    );

    const handleMouseDown = useCallback(() => {
      setIsDragging(true);
      // Start batching for undo/redo
      if (onBatchStart) {
        onBatchStart();
      }
    }, [onBatchStart]);

    const handleMouseUp = useCallback(() => {
      if (isDragging) {
        setIsDragging(false);
        // Commit the final value to undo/redo
        onScaleCommit(currentScale);
        // End batching
        if (onBatchEnd) {
          onBatchEnd();
        }
      }
    }, [isDragging, currentScale, onScaleCommit, onBatchEnd]);

    // Handle mouse leave (user might release mouse outside the slider)
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
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
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
  }
);
ScaleSection.displayName = 'ScaleSection';

interface RotationSectionProps {
  /** Rotation values for all axes */
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  /** Called when user changes a rotation value (for real-time visual updates) */
  onRotationChange: (axis: RotationAxis, rotation: number) => void;
  /** Called when user commits the rotation change (mouseup - for undo/redo) */
  onRotationCommit: (axis: RotationAxis, rotation: number) => void;
  /** Called when slider interaction starts (for undo/redo batching) */
  onBatchStart?: () => void;
  /** Called when slider interaction ends (for undo/redo batching) */
  onBatchEnd?: () => void;
}

/**
 * Snap points for rotation sliders.
 * Each snap point has a value and a threshold (how close you need to be to snap).
 * 0° has a stronger snap since it's the most common target.
 */
const ROTATION_SNAP_POINTS = [
  { value: 0, threshold: 6 }, // Neutral - strongest snap
  { value: 90, threshold: 4 }, // Perpendicular
  { value: -90, threshold: 4 }, // Perpendicular
  { value: 180, threshold: 4 }, // Flipped
  { value: -180, threshold: 4 }, // Flipped
  { value: 45, threshold: 3 }, // Common increment
  { value: -45, threshold: 3 }, // Common increment
  { value: 135, threshold: 3 }, // Diagonal
  { value: -135, threshold: 3 }, // Diagonal
];

/**
 * Applies snapping to a rotation value.
 * Returns the snapped value if within threshold of a snap point,
 * otherwise returns the original value.
 */
const snapRotation = (value: number): number => {
  for (const snap of ROTATION_SNAP_POINTS) {
    if (Math.abs(value - snap.value) <= snap.threshold) {
      return snap.value;
    }
  }
  return value;
};

/** Tick marks to show on the rotation slider */
const ROTATION_TICK_MARKS = [-90, 0, 90];

/** Single axis slider component for rotation with snapping */
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
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            {label || axis.toUpperCase()}
          </span>
          <span className="font-mono text-[9px] font-medium text-slate-400">
            {Math.round(displayRotation)}°
          </span>
        </div>
      )}
      <div className="relative">
        {/* Tick marks for snap points */}
        {ROTATION_TICK_MARKS.map((tick) => {
          // Convert tick value to percentage position (0-100%)
          const position = ((tick + 180) / 360) * 100;
          const isCenter = tick === 0;
          return (
            <div
              key={tick}
              className={`absolute top-0 z-0 w-px ${
                isCenter ? 'h-full bg-slate-300/60' : 'h-full bg-slate-300/30'
              }`}
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

const RotationSection = memo<RotationSectionProps>(
  ({
    rotationX,
    rotationY,
    rotationZ,
    onRotationChange,
    onRotationCommit,
    onBatchStart,
    onBatchEnd,
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const activeAxisRef = useRef<RotationAxis>('y');

    const handleMouseDown = useCallback(
      (axis: RotationAxis) => {
        setIsDragging(true);
        activeAxisRef.current = axis;
        if (onBatchStart) {
          onBatchStart();
        }
      },
      [onBatchStart]
    );

    const handleMouseUp = useCallback(() => {
      if (isDragging) {
        setIsDragging(false);
        const axis = activeAxisRef.current;
        const value = axis === 'x' ? rotationX : axis === 'y' ? rotationY : rotationZ;
        onRotationCommit(axis, value);
        if (onBatchEnd) {
          onBatchEnd();
        }
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
      <div
        className="rounded-[16px] border border-white/40 bg-white/40 px-3 py-2.5 shadow-sm"
        data-testid="rotation-section"
      >
        {/* Main Rotation Header + Y-axis Slider */}
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
            {Math.round(displayRotationY)}°
          </span>
        </div>

        {/* Primary Y-axis Slider */}
        <div className="relative">
          {/* Tick marks for snap points */}
          {ROTATION_TICK_MARKS.map((tick) => {
            // Convert tick value to percentage position (0-100%)
            const position = ((tick + 180) / 360) * 100;
            const isCenter = tick === 0;
            return (
              <div
                key={tick}
                className={`absolute top-0 z-0 w-px ${
                  isCenter ? 'h-full bg-slate-300/60' : 'h-full bg-slate-300/30'
                }`}
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
        <div className="mt-1 flex justify-between text-[9px] font-medium text-slate-400">
          <span>-180°</span>
          <span className="text-slate-300">0°</span>
          <span>180°</span>
        </div>

        {/* Expandable Advanced Options */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-[10px] py-1.5 text-[10px] font-medium text-slate-400 transition-all hover:bg-white/50 hover:text-slate-600"
          aria-expanded={isExpanded}
          data-testid="rotation-expand-button"
        >
          <span>{isExpanded ? 'Less options' : 'More options'}</span>
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Advanced X and Z Sliders */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            isExpanded ? 'mt-3 max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
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

interface DeleteSectionProps {
  onDelete: () => void;
}

const DeleteSection = memo<DeleteSectionProps>(({ onDelete }) => {
  return (
    <div className="mt-auto pt-2" data-testid="delete-section">
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
DeleteSection.displayName = 'DeleteSection';

// ============================================================================
// Main Component
// ============================================================================

const RightSidebarInner: React.FC<RightSidebarProps> = ({
  object,
  selectedChild,
  onUpdate,
  onDelete,
  onClose,
  onBatchStart,
  onBatchEnd,
}) => {
  // Store initial object state when slider interaction starts
  const initialObjectRef = useRef<SceneObject | null>(null);

  // Determine if we're in child editing mode
  const isChildMode = !!selectedChild;

  // ---- Memoized Event Handlers ----
  // Note: All hooks must be called unconditionally (before any early returns)

  const handleNameChange = useCallback(
    (name: string) => {
      if (!object) return;
      onUpdate({ ...object, name });
    },
    [object, onUpdate]
  );

  // Scale change handler - updates visual state only (for real-time feedback during drag)
  const handleScaleChange = useCallback(
    (scale: number) => {
      if (!object) return;

      // Get the model height from properties (stored during model creation)
      const modelHeight = (object.properties.modelHeight as number) || DEFAULT_MODEL_HEIGHT;

      // Calculate new Y position to maintain ground-relative position when scaling
      const newY = calculateScaleAdjustedY(
        object.transform.y,
        object.transform.scaleY,
        scale,
        modelHeight
      );

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
    [object, onUpdate]
  );

  // Scale commit handler
  const handleScaleCommit = useCallback(
    (_finalScale: number) => {
      if (!object || !initialObjectRef.current) return;
      // The final state is already applied via handleScaleChange
    },
    [object]
  );

  const handleScaleBatchStart = useCallback(() => {
    if (!object) return;
    initialObjectRef.current = { ...object };
    if (onBatchStart) {
      onBatchStart();
    }
  }, [object, onBatchStart]);

  const handleScaleBatchEnd = useCallback(() => {
    if (!object || !initialObjectRef.current) return;
    if (onBatchEnd) {
      onBatchEnd();
    }
    initialObjectRef.current = null;
  }, [object, onBatchEnd]);

  // Rotation change handler - updates visual state only (for real-time feedback during drag)
  const handleRotationChange = useCallback(
    (axis: RotationAxis, rotation: number) => {
      if (!object) return;
      const rotationKey = getRotationKey(axis);

      // For rotation, we don't adjust Y position.
      // In ImportedModel, the model rotates around its visual center (the pivot point).
      // The relationship between transform.y and the pivot remains consistent.
      // If rotation causes part of the model to go below ground, the user can use
      // the height handle to lift it - this is more intuitive than auto-adjusting.
      onUpdate({
        ...object,
        transform: {
          ...object.transform,
          [rotationKey]: rotation,
        },
      });
    },
    [object, onUpdate]
  );

  // Rotation commit handler
  const handleRotationCommit = useCallback(
    (_axis: RotationAxis, _finalRotation: number) => {
      if (!object || !initialObjectRef.current) return;
      // The final state is already applied via handleRotationChange
    },
    [object]
  );

  const handleRotationBatchStart = useCallback(() => {
    if (!object) return;
    initialObjectRef.current = { ...object };
    if (onBatchStart) {
      onBatchStart();
    }
  }, [object, onBatchStart]);

  const handleRotationBatchEnd = useCallback(() => {
    if (!object || !initialObjectRef.current) return;
    if (onBatchEnd) {
      onBatchEnd();
    }
    initialObjectRef.current = null;
  }, [object, onBatchEnd]);

  const handleDelete = useCallback(() => {
    if (!object) return;
    onDelete(object.id);
  }, [object, onDelete]);

  // ============================================================================
  // Child Transform Handlers (when a child is selected)
  // ============================================================================

  // Update child's local transform in the parent object's children array
  const updateChildTransform = useCallback(
    (updates: Partial<ChildMesh['localTransform']>) => {
      if (!object || !selectedChild || !object.children) return;

      const updatedChildren = object.children.map((child) => {
        const childPathStr = pathToString(child.path);
        const selectedPathStr = pathToString(selectedChild.path);
        if (childPathStr === selectedPathStr) {
          return {
            ...child,
            localTransform: {
              ...child.localTransform,
              ...updates,
            },
          };
        }
        return child;
      });

      onUpdate({
        ...object,
        children: updatedChildren,
      });
    },
    [object, selectedChild, onUpdate]
  );

  // Child scale change handler
  const handleChildScaleChange = useCallback(
    (scale: number) => {
      updateChildTransform({
        scaleX: scale,
        scaleY: scale,
        scaleZ: scale,
      });
    },
    [updateChildTransform]
  );

  const handleChildScaleCommit = useCallback(
    (scale: number) => {
      handleChildScaleChange(scale);
    },
    [handleChildScaleChange]
  );

  const handleChildScaleBatchStart = useCallback(() => {
    if (onBatchStart) {
      onBatchStart();
    }
  }, [onBatchStart]);

  const handleChildScaleBatchEnd = useCallback(() => {
    if (onBatchEnd) {
      onBatchEnd();
    }
  }, [onBatchEnd]);

  // Child rotation change handler
  const handleChildRotationChange = useCallback(
    (axis: RotationAxis, rotation: number) => {
      const rotationKey = getRotationKey(axis);
      updateChildTransform({
        [rotationKey]: rotation,
      });
    },
    [updateChildTransform]
  );

  const handleChildRotationCommit = useCallback((_axis: RotationAxis, _rotation: number) => {
    // Already applied via handleChildRotationChange
  }, []);

  const handleChildRotationBatchStart = useCallback(() => {
    if (onBatchStart) {
      onBatchStart();
    }
  }, [onBatchStart]);

  const handleChildRotationBatchEnd = useCallback(() => {
    if (onBatchEnd) {
      onBatchEnd();
    }
  }, [onBatchEnd]);

  // Child name change handler
  const handleChildNameChange = useCallback(
    (name: string) => {
      if (!object || !selectedChild || !object.children) return;

      const updatedChildren = object.children.map((child) => {
        const childPathStr = pathToString(child.path);
        const selectedPathStr = pathToString(selectedChild.path);
        if (childPathStr === selectedPathStr) {
          return {
            ...child,
            name: name,
          };
        }
        return child;
      });

      onUpdate({
        ...object,
        children: updatedChildren,
      });
    },
    [object, selectedChild, onUpdate]
  );

  // ---- Early return after all hooks ----
  if (!object) return null;

  // ---- Computed Values ----
  const currentScale = object.transform.scaleX;

  // Child-specific computed values
  const childCurrentScale = selectedChild?.localTransform.scaleX ?? 1;

  // ---- Render ----

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 top-24 z-[60] flex w-80 flex-col"
      data-testid="right-sidebar"
    >
      {/* Floating Panel - Tier 1 Rounding (32px) */}
      <div className="pointer-events-auto flex flex-1 origin-right flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl transition-all duration-500 ease-out">
        {/* Header - same layout, different icon/color for parent vs child */}
        <PanelHeader objectType={object.type} isChild={isChildMode} onClose={onClose} />

        {/* Content - standardized sections for both parent and child */}
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          {isChildMode && selectedChild ? (
            // Child mode: same controls as parent but for child's local transform
            <>
              <NameSection name={selectedChild.name} onNameChange={handleChildNameChange} />

              <RotationSection
                rotationX={selectedChild.localTransform.rotationX}
                rotationY={selectedChild.localTransform.rotationY}
                rotationZ={selectedChild.localTransform.rotationZ}
                onRotationChange={handleChildRotationChange}
                onRotationCommit={handleChildRotationCommit}
                onBatchStart={handleChildRotationBatchStart}
                onBatchEnd={handleChildRotationBatchEnd}
              />

              <ScaleSection
                currentScale={childCurrentScale}
                onScaleChange={handleChildScaleChange}
                onScaleCommit={handleChildScaleCommit}
                onBatchStart={handleChildScaleBatchStart}
                onBatchEnd={handleChildScaleBatchEnd}
              />

              <DeleteSection onDelete={handleDelete} />
            </>
          ) : (
            // Parent mode: same controls
            <>
              <NameSection name={object.name} onNameChange={handleNameChange} />

              <RotationSection
                rotationX={object.transform.rotationX}
                rotationY={object.transform.rotationY}
                rotationZ={object.transform.rotationZ}
                onRotationChange={handleRotationChange}
                onRotationCommit={handleRotationCommit}
                onBatchStart={handleRotationBatchStart}
                onBatchEnd={handleRotationBatchEnd}
              />

              <ScaleSection
                currentScale={currentScale}
                onScaleChange={handleScaleChange}
                onScaleCommit={handleScaleCommit}
                onBatchStart={handleScaleBatchStart}
                onBatchEnd={handleScaleBatchEnd}
              />

              <DeleteSection onDelete={handleDelete} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Export memoized component
export const RightSidebar = memo(RightSidebarInner);
