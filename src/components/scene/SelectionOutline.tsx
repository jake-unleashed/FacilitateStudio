/**
 * SelectionOutline Component
 *
 * Provides post-processing outline effect for selected objects in the 3D scene.
 * Uses @react-three/postprocessing for a clean, silhouette-based outline that
 * perfectly follows object shapes.
 *
 * Usage:
 * 1. Wrap your scene with <SelectionProvider>
 * 2. Wrap parent objects with <Select enabled={isSelected}>
 * 3. Use <SelectChildObject object={mesh} enabled={true} /> for child mesh selection
 * 4. Include <SelectionOutlineEffect /> as a sibling (not child) of scene content
 *
 * Features:
 * - Perfect silhouette-based outline (not bounding box)
 * - Blue outline for parent selection, green/emerald for child selection
 * - Smooth, anti-aliased edges
 * - Non-interactive (purely visual effect)
 * - Supports programmatic selection of THREE.Object3D
 *
 * Technical Notes:
 * - xRay mode is enabled to bypass depth buffer issues that could cause outlines
 *   to disappear at certain object positions (particularly when the Grid or other
 *   scene elements interfere with depth comparison)
 * - Hidden and visible edge colors are set to the same value for consistent appearance
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { EffectComposer, Outline, Selection, Select } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

// ============================================================================
// Constants
// ============================================================================

/**
 * Selection outline color - blue for parent/root objects (Tailwind blue-500)
 * Used for both visible and hidden edges to ensure consistent appearance.
 */
const PARENT_OUTLINE_COLOR = 0x3b82f6;

/**
 * Child selection outline color - emerald to match UI (Tailwind emerald-500)
 * Used for both visible and hidden edges to ensure consistent appearance.
 */
const CHILD_OUTLINE_COLOR = 0x10b981;

// ============================================================================
// Child Selection Context - Separate from parent selection
// ============================================================================

interface ChildSelectionContextType {
  selectedChildren: THREE.Object3D[];
  setSelectedChildren: React.Dispatch<React.SetStateAction<THREE.Object3D[]>>;
}

const ChildSelectionContext = createContext<ChildSelectionContextType | null>(null);

/**
 * Provider for child selection tracking.
 * This allows child meshes to be outlined with a different color than parents.
 */
export const ChildSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedChildren, setSelectedChildren] = useState<THREE.Object3D[]>([]);

  const value = useMemo(
    () => ({
      selectedChildren,
      setSelectedChildren,
    }),
    [selectedChildren]
  );

  return <ChildSelectionContext.Provider value={value}>{children}</ChildSelectionContext.Provider>;
};

/**
 * Hook to access child selection context.
 * Returns null when used outside of ChildSelectionProvider.
 */
export const useChildSelection = (): ChildSelectionContextType | null =>
  useContext(ChildSelectionContext);

// ============================================================================
// SelectChildObject Component - For child mesh selection (green outline)
// ============================================================================

interface SelectChildObjectProps {
  /** The THREE.Object3D to add to child selection */
  object: THREE.Object3D | null;
  /** Whether this object is currently selected */
  enabled: boolean;
}

/**
 * Programmatically adds a THREE.Object3D (and all its mesh children) to the CHILD selection.
 * This results in a green/emerald outline instead of blue.
 */
export const SelectChildObject: React.FC<SelectChildObjectProps> = ({ object, enabled }) => {
  const ctx = useContext(ChildSelectionContext);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!ctx) return;

    // Clear previous meshes
    if (meshesRef.current.length > 0) {
      ctx.setSelectedChildren((prev) =>
        prev.filter((m) => !meshesRef.current.includes(m as THREE.Mesh))
      );
      meshesRef.current = [];
    }

    if (!object || !enabled) return;

    // Collect all meshes from the object
    const meshes: THREE.Mesh[] = [];
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });

    if (meshes.length === 0) return;

    meshesRef.current = meshes;

    // Add meshes to child selection
    ctx.setSelectedChildren((prev) => [...prev, ...meshes]);

    // Cleanup: remove meshes when disabled or unmounted
    return () => {
      ctx.setSelectedChildren((prev) => prev.filter((m) => !meshes.includes(m as THREE.Mesh)));
      meshesRef.current = [];
    };
  }, [object, enabled, ctx]);

  return null; // This component doesn't render anything
};

// ============================================================================
// ChildOutlineEffect Component - Green outline for children (OUTSIDE Selection)
// ============================================================================

/**
 * Post-processing outline effect specifically for child-selected objects.
 * Uses emerald/green color to differentiate from parent selection.
 * IMPORTANT: This must be rendered OUTSIDE the Selection context!
 *
 * This component conditionally renders only when there are children to outline.
 * This avoids interference with the parent SelectionOutlineEffect.
 */
export const ChildOutlineEffect: React.FC = () => {
  const ctx = useContext(ChildSelectionContext);

  // Only render when there are children selected
  // When no children are selected, the parent SelectionOutlineEffect handles the outline
  if (!ctx || ctx.selectedChildren.length === 0) {
    return null;
  }

  return (
    <EffectComposer multisampling={4} autoClear={false}>
      <Outline
        selection={ctx.selectedChildren}
        blur
        edgeStrength={5}
        pulseSpeed={0}
        visibleEdgeColor={CHILD_OUTLINE_COLOR}
        hiddenEdgeColor={CHILD_OUTLINE_COLOR}
        width={1024}
        // xRay={true} ensures outlines are visible even when depth buffer has artifacts
        // from other scene elements (like the Grid). Without this, outlines can disappear
        // when objects are positioned at certain coordinates.
        xRay={true}
        blendFunction={BlendFunction.SCREEN}
      />
    </EffectComposer>
  );
};

// ============================================================================
// SelectionOutlineEffect Component - Blue outline for parents
// ============================================================================

/**
 * Post-processing outline effect for parent-selected objects.
 * Must be placed inside Selection context.
 * Uses blue color for parent/root selection.
 *
 * This component checks if there are any child selections - if so, it doesn't render
 * to avoid having two EffectComposers active at once (which causes visual artifacts).
 */
export const SelectionOutlineEffect: React.FC = () => {
  const childCtx = useContext(ChildSelectionContext);
  const hasChildSelection = childCtx && childCtx.selectedChildren.length > 0;

  // Don't render parent outline if a child is selected
  // The ChildOutlineEffect will handle the outline instead
  if (hasChildSelection) {
    return null;
  }

  return (
    <EffectComposer multisampling={4} autoClear={false}>
      <Outline
        blur
        edgeStrength={5}
        pulseSpeed={0}
        visibleEdgeColor={PARENT_OUTLINE_COLOR}
        hiddenEdgeColor={PARENT_OUTLINE_COLOR}
        width={1024}
        // xRay={true} ensures outlines are visible even when depth buffer has artifacts
        // from other scene elements (like the Grid). Without this, outlines can disappear
        // when objects are positioned at certain coordinates.
        xRay={true}
        blendFunction={BlendFunction.SCREEN}
      />
    </EffectComposer>
  );
};

// ============================================================================
// Combined Provider - Wraps both Selection and ChildSelection
// ============================================================================

interface SelectionProviderProps {
  children: React.ReactNode;
}

/**
 * Combined provider that wraps both parent Selection (from postprocessing)
 * and child selection (custom context).
 *
 * Structure:
 * - ChildSelectionProvider (outer) - available to both Selection content and ChildOutlineEffect
 * - Selection (inner) - only wraps scene content, not child outline effect
 */
export const SelectionProvider: React.FC<SelectionProviderProps> = ({ children }) => {
  return (
    <ChildSelectionProvider>
      <Selection>{children}</Selection>
    </ChildSelectionProvider>
  );
};

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { Select };

// Legacy export for backwards compatibility - use SelectChildObject for child selection
export const SelectObject = SelectChildObject;
