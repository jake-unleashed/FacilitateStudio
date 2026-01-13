/**
 * HeightHandle Component
 *
 * Drag handle for adjusting object Y position (height).
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import * as THREE from 'three';

import { HeightHandleProps, HeightDragState } from './types';
import { DRAG_THRESHOLD_PX, HEIGHT_MIN, HEIGHT_MAX } from './constants';
import { INTERNAL_TO_WORLD } from '../../../constants';
import { extractScaleFromMatrix, clamp, getHandleClasses } from './utils';
import { useTooltip } from './useTooltip';
import { GizmoTooltip } from './GizmoTooltip';

/**
 * Height adjustment handle - drag up/down to change Y position
 */
export const HeightHandle = memo<HeightHandleProps>(function HeightHandle({
  value,
  minWorldY,
  onChange,
  onDragStart,
  onDragEnd,
  camera,
  gl,
  worldPosition,
  scaleFactor,
  childMesh,
  isChild = false,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<HeightDragState | null>(null);

  const tooltip = useTooltip('Drag up/down to adjust height', isDragging);

  /**
   * Calculates the effective Y scale accounting for child mesh world transform
   */
  const getEffectiveScaleY = useCallback((): number => {
    if (childMesh) {
      childMesh.updateMatrixWorld(true);
      return extractScaleFromMatrix(childMesh.matrixWorld, 'y');
    }
    return scaleFactor;
  }, [childMesh, scaleFactor]);

  /**
   * Calculates how many pixels correspond to one internal unit of height change
   * Also returns worldUnitsPerInternalUnit for ground constraint calculations
   */
  const calculateDragFactors = useCallback((): {
    pixelsPerInternalUnit: number;
    worldUnitsPerInternalUnit: number;
  } => {
    const rect = gl.domElement.getBoundingClientRect();
    const effectiveScaleY = getEffectiveScaleY();
    const worldUnitsPerInternalUnit = (1 / INTERNAL_TO_WORLD) * effectiveScaleY;

    // Project two points separated by one internal unit of world height
    const pos1 = worldPosition.clone().project(camera);
    const pos2 = worldPosition
      .clone()
      .add(new THREE.Vector3(0, worldUnitsPerInternalUnit, 0))
      .project(camera);

    const screenY1 = ((-pos1.y + 1) / 2) * rect.height;
    const screenY2 = ((-pos2.y + 1) / 2) * rect.height;

    return {
      pixelsPerInternalUnit: Math.abs(screenY1 - screenY2) || 1,
      worldUnitsPerInternalUnit,
    };
  }, [camera, gl, worldPosition, getEffectiveScaleY]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      tooltip.hideTooltip();

      const { pixelsPerInternalUnit, worldUnitsPerInternalUnit } = calculateDragFactors();

      setIsDragging(true);
      dragStateRef.current = {
        startMouseY: e.clientY,
        initialValue: value,
        initialMinWorldY: minWorldY,
        worldUnitsPerInternalUnit,
        pixelsPerInternalUnit,
        hasMoved: false,
      };
      onDragStart();
    },
    [value, minWorldY, calculateDragFactors, onDragStart, tooltip]
  );

  // Handle drag movement and release
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const screenDeltaY = state.startMouseY - e.clientY;

      // Check if movement exceeds threshold
      if (Math.abs(screenDeltaY) > DRAG_THRESHOLD_PX) {
        state.hasMoved = true;
      }

      if (!state.hasMoved) return;

      // Convert screen delta to internal units
      const internalDelta = screenDeltaY / state.pixelsPerInternalUnit;

      // Calculate what the new minWorldY would be
      // When we change the internal value by internalDelta:
      // - World Y change = internalDelta * worldUnitsPerInternalUnit
      // - New minWorldY = initialMinWorldY + worldYChange
      const worldDelta = internalDelta * state.worldUnitsPerInternalUnit;
      const newMinWorldY = state.initialMinWorldY + worldDelta;

      // If newMinWorldY would be below ground (< 0), clamp the delta
      let clampedInternalDelta = internalDelta;
      if (newMinWorldY < 0) {
        // Calculate the maximum downward delta that keeps minWorldY at 0
        // 0 = initialMinWorldY + maxDownDelta * worldUnitsPerInternalUnit
        // maxDownDelta = -initialMinWorldY / worldUnitsPerInternalUnit
        const maxDownDelta = -state.initialMinWorldY / state.worldUnitsPerInternalUnit;
        clampedInternalDelta = Math.max(internalDelta, maxDownDelta);
      }

      // Calculate effective height minimum based on object type:
      // - Root objects: HEIGHT_MIN (0) - their Y value represents ground level
      // - Child objects: -Infinity - their localTransform.y is relative to default position,
      //   so negative values are valid (ground constraint above prevents going below ground)
      const effectiveHeightMin = isChild ? -Infinity : HEIGHT_MIN;
      const newValue = clamp(
        state.initialValue + clampedInternalDelta,
        effectiveHeightMin,
        HEIGHT_MAX
      );
      onChange(newValue);
    };

    const handlePointerUp = () => {
      const hasMoved = dragStateRef.current?.hasMoved ?? false;

      if (hasMoved) {
        onDragEnd();
      } else {
        tooltip.showClickTooltip('Hold and drag to adjust');
      }

      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onChange, onDragEnd, tooltip, isChild]);

  return (
    <div className="relative">
      <div
        className={getHandleClasses(isDragging, isHovered)}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => {
          setIsHovered(true);
          tooltip.handlePointerEnter();
        }}
        onPointerLeave={() => {
          setIsHovered(false);
          tooltip.handlePointerLeave();
        }}
        aria-label="Height - drag up or down to adjust"
        data-testid="handle-height"
      >
        <ArrowUpDown size={20} strokeWidth={2.5} />
      </div>
      <GizmoTooltip text={tooltip.tooltipText} visible={tooltip.showTooltip} />
    </div>
  );
});
