import React, { memo, useCallback, useRef } from 'react';
import { pathToString, type ChildMesh, type SceneObject } from '../types';
import { calculateScaleAdjustedY, DEFAULT_MODEL_HEIGHT } from '../utils/groundHeight';
import type { RotationAxis, RightSidebarProps } from './rightSidebar/types';
import { getRotationKey, resetAllChildren, resetChildAndDescendants } from './rightSidebar/utils';
import { PanelHeader } from './rightSidebar/PanelHeader';
import { NameSection } from './rightSidebar/NameSection';
import { ScaleSection } from './rightSidebar/ScaleSection';
import { RotationSection } from './rightSidebar/RotationSection';
import { ActionButtonsSection } from './rightSidebar/ActionButtonsSection';

const RightSidebarInner: React.FC<RightSidebarProps> = ({
  object,
  selectedChild,
  onUpdate,
  onDelete,
  onClose,
  onBatchStart,
  onBatchEnd,
  onFocusObject,
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

  /**
   * Unified reset handler for root objects.
   * Resets the object's transform to its original state AND resets all children to DEFAULT_TRANSFORM.
   * After reset, focuses the camera on the object.
   */
  const handleReset = useCallback(() => {
    if (!object) return;

    onBatchStart?.();

    // Use originalTransform if available, otherwise keep current transform
    const resetTransform = object.originalTransform ?? object.transform;

    const updatedObject: SceneObject = {
      ...object,
      transform: { ...resetTransform },
      children: resetAllChildren(object.children),
    };

    onUpdate(updatedObject);
    onBatchEnd?.();
    onFocusObject?.(updatedObject);
  }, [object, onUpdate, onBatchStart, onBatchEnd, onFocusObject]);

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

  /**
   * Reset handler for child objects.
   * Resets the selected child AND any of its nested descendants to DEFAULT_TRANSFORM.
   * After reset, focuses the camera on the child.
   */
  const handleChildReset = useCallback(() => {
    if (!object || !selectedChild || !object.children) return;

    onBatchStart?.();

    const selectedPathStr = pathToString(selectedChild.path);
    const updatedChildren = resetChildAndDescendants(object.children, selectedPathStr);

    const updatedObject: SceneObject = {
      ...object,
      children: updatedChildren,
    };

    onUpdate(updatedObject);
    onBatchEnd?.();
    onFocusObject?.(updatedObject, selectedPathStr);
  }, [object, selectedChild, onUpdate, onBatchStart, onBatchEnd, onFocusObject]);

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

              <ActionButtonsSection onReset={handleChildReset} onDelete={handleDelete} />
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

              <ActionButtonsSection
                onReset={handleReset}
                onDelete={handleDelete}
                resetDisabled={!object.originalTransform}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Export memoized component
export const RightSidebar = memo(RightSidebarInner);
