import React, { useState, memo, useCallback, useMemo, useRef } from 'react';
import { SceneObject, ChildMesh, pathToString } from '../types';
import { Input } from './Input';
import { Button } from './Button';
import { Box, Trash2, Copy, Rotate3d, Scaling, X, ArrowUpDown, Layers } from 'lucide-react';
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

interface HeightSectionProps {
  /** Height above ground in internal units (where 100 = 1 meter) */
  groundRelativeHeight: number;
  /** Called when user changes the height slider (for real-time visual updates) */
  onHeightChange: (newHeight: number) => void;
  /** Called when user commits the height change (mouseup - for undo/redo) */
  onHeightCommit: (newHeight: number) => void;
  /** Called when slider interaction starts (for undo/redo batching) */
  onBatchStart?: () => void;
  /** Called when slider interaction ends (for undo/redo batching) */
  onBatchEnd?: () => void;
}

const HeightSection = memo<HeightSectionProps>(
  ({ groundRelativeHeight, onHeightChange, onHeightCommit, onBatchStart, onBatchEnd }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startValueRef = useRef<number>(groundRelativeHeight);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        // Update visual state in real-time during drag
        onHeightChange(newValue);
      },
      [onHeightChange]
    );

    const handleMouseDown = useCallback(() => {
      setIsDragging(true);
      startValueRef.current = groundRelativeHeight;
      // Start batching for undo/redo
      if (onBatchStart) {
        onBatchStart();
      }
    }, [groundRelativeHeight, onBatchStart]);

    const handleMouseUp = useCallback(() => {
      if (isDragging) {
        setIsDragging(false);
        // Commit the final value to undo/redo
        const finalValue = groundRelativeHeight;
        onHeightCommit(finalValue);
        // End batching
        if (onBatchEnd) {
          onBatchEnd();
        }
      }
    }, [isDragging, groundRelativeHeight, onHeightCommit, onBatchEnd]);

    // Handle mouse leave (user might release mouse outside the slider)
    const handleMouseLeave = useCallback(() => {
      if (isDragging) {
        handleMouseUp();
      }
    }, [isDragging, handleMouseUp]);

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
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
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
  }
);
HeightSection.displayName = 'HeightSection';

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
  activeAxis: RotationAxis;
  displayRotation: number;
  onAxisChange: (axis: RotationAxis) => void;
  /** Called when user changes the rotation slider (for real-time visual updates) */
  onRotationChange: (rotation: number) => void;
  /** Called when user commits the rotation change (mouseup - for undo/redo) */
  onRotationCommit: (rotation: number) => void;
  /** Called when slider interaction starts (for undo/redo batching) */
  onBatchStart?: () => void;
  /** Called when slider interaction ends (for undo/redo batching) */
  onBatchEnd?: () => void;
}

const ROTATION_AXES: readonly RotationAxis[] = ['x', 'y', 'z'] as const;

const RotationSection = memo<RotationSectionProps>(
  ({
    activeAxis,
    displayRotation,
    onAxisChange,
    onRotationChange,
    onRotationCommit,
    onBatchStart,
    onBatchEnd,
  }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleSliderChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        // Update visual state in real-time during drag
        onRotationChange(newValue);
      },
      [onRotationChange]
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
        onRotationCommit(displayRotation);
        // End batching
        if (onBatchEnd) {
          onBatchEnd();
        }
      }
    }, [isDragging, displayRotation, onRotationCommit, onBatchEnd]);

    // Handle mouse leave (user might release mouse outside the slider)
    const handleMouseLeave = useCallback(() => {
      if (isDragging) {
        handleMouseUp();
      }
    }, [isDragging, handleMouseUp]);

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
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
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
  selectedChild,
  onUpdate,
  onDelete,
  onClose,
  onBatchStart,
  onBatchEnd,
}) => {
  const [activeRotAxis, setActiveRotAxis] = useState<RotationAxis>('y');

  // Store initial object state when slider interaction starts
  const initialObjectRef = useRef<SceneObject | null>(null);

  // Determine if we're in child editing mode
  const isChildMode = !!selectedChild;

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

  // Height change handler - updates visual state only (for real-time feedback during drag)
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

  // Height commit handler - no-op since commands are created during drag and batched
  const handleHeightCommit = useCallback((_finalHeight: number) => {
    // The final state is already applied via handleHeightChange
    // Commands are batched, so this is just a signal that drag ended
  }, []);

  const handleHeightBatchStart = useCallback(() => {
    if (!object) return;
    initialObjectRef.current = { ...object };
    if (onBatchStart) {
      onBatchStart();
    }
  }, [object, onBatchStart]);

  const handleHeightBatchEnd = useCallback(() => {
    if (!object || !initialObjectRef.current) return;
    if (onBatchEnd) {
      onBatchEnd();
    }
    initialObjectRef.current = null;
  }, [object, onBatchEnd]);

  // Scale change handler - updates visual state only (for real-time feedback during drag)
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

  // Rotation commit handler
  const handleRotationCommit = useCallback(
    (_finalRotation: number) => {
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

  const handleDuplicate = useCallback(() => {
    // Duplicate functionality - currently a no-op, will be implemented later
  }, []);

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

  // Child height change handler
  const handleChildHeightChange = useCallback(
    (newHeight: number) => {
      // Height is stored in Y position (in internal units where 100 = 1 meter)
      updateChildTransform({ y: newHeight });
    },
    [updateChildTransform]
  );

  const handleChildHeightCommit = useCallback(
    (newHeight: number) => {
      handleChildHeightChange(newHeight);
    },
    [handleChildHeightChange]
  );

  const handleChildHeightBatchStart = useCallback(() => {
    if (onBatchStart) {
      onBatchStart();
    }
  }, [onBatchStart]);

  const handleChildHeightBatchEnd = useCallback(() => {
    if (onBatchEnd) {
      onBatchEnd();
    }
  }, [onBatchEnd]);

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
    (rotation: number) => {
      const rotationKey = getRotationKey(activeRotAxis);
      updateChildTransform({
        [rotationKey]: rotation,
      });
    },
    [activeRotAxis, updateChildTransform]
  );

  const handleChildRotationCommit = useCallback(
    (rotation: number) => {
      handleChildRotationChange(rotation);
    },
    [handleChildRotationChange]
  );

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
  const rotationKey = getRotationKey(activeRotAxis);
  const currentRotation = object.transform[rotationKey];
  const displayRotation = normalizeAngle(currentRotation);
  const currentScale = object.transform.scaleX;

  // Child-specific computed values
  const childRotationKey = getRotationKey(activeRotAxis);
  const childCurrentRotation = selectedChild?.localTransform[childRotationKey] ?? 0;
  const childDisplayRotation = normalizeAngle(childCurrentRotation);
  const childCurrentScale = selectedChild?.localTransform.scaleX ?? 1;
  const childGroundRelativeHeight = selectedChild ? selectedChild.localTransform.y : 0;

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

              <HeightSection
                groundRelativeHeight={childGroundRelativeHeight}
                onHeightChange={handleChildHeightChange}
                onHeightCommit={handleChildHeightCommit}
                onBatchStart={handleChildHeightBatchStart}
                onBatchEnd={handleChildHeightBatchEnd}
              />

              <ScaleSection
                currentScale={childCurrentScale}
                onScaleChange={handleChildScaleChange}
                onScaleCommit={handleChildScaleCommit}
                onBatchStart={handleChildScaleBatchStart}
                onBatchEnd={handleChildScaleBatchEnd}
              />

              <RotationSection
                activeAxis={activeRotAxis}
                displayRotation={childDisplayRotation}
                onAxisChange={setActiveRotAxis}
                onRotationChange={handleChildRotationChange}
                onRotationCommit={handleChildRotationCommit}
                onBatchStart={handleChildRotationBatchStart}
                onBatchEnd={handleChildRotationBatchEnd}
              />

              <ActionsSection onDuplicate={handleDuplicate} onDelete={handleDelete} />
            </>
          ) : (
            // Parent mode: same controls
            <>
              <NameSection name={object.name} onNameChange={handleNameChange} />

              <HeightSection
                groundRelativeHeight={groundRelativeHeight}
                onHeightChange={handleHeightChange}
                onHeightCommit={handleHeightCommit}
                onBatchStart={handleHeightBatchStart}
                onBatchEnd={handleHeightBatchEnd}
              />

              <ScaleSection
                currentScale={currentScale}
                onScaleChange={handleScaleChange}
                onScaleCommit={handleScaleCommit}
                onBatchStart={handleScaleBatchStart}
                onBatchEnd={handleScaleBatchEnd}
              />

              <RotationSection
                activeAxis={activeRotAxis}
                displayRotation={displayRotation}
                onAxisChange={setActiveRotAxis}
                onRotationChange={handleRotationChange}
                onRotationCommit={handleRotationCommit}
                onBatchStart={handleRotationBatchStart}
                onBatchEnd={handleRotationBatchEnd}
              />

              <ActionsSection onDuplicate={handleDuplicate} onDelete={handleDelete} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Export memoized component
export const RightSidebar = memo(RightSidebarInner);
