/**
 * ImportedModel Component
 *
 * Renders uploaded 3D models in the scene with full transform, selection, and interaction support.
 *
 * ARCHITECTURE:
 * - Uses shared model cache to prevent redundant loading/preprocessing
 * - Outer group: positioned at visual center (for rotation pivot), handles rotation/scale
 * - Inner group: fixed offset of -modelHeight/2 to keep bottom at ground level
 * - This ensures models stay on ground during rotation/scaling
 * - Pointer events are attached directly to the model primitive to ensure only the mesh is interactive
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { SelectObject } from './SelectionOutline';
import { LoadingPlaceholder } from './importedModel/LoadingPlaceholder';
import type { ImportedModelProps } from './importedModel/types';
import { useImportedModelLoad } from './importedModel/useImportedModelLoad';
import { useImportedModelChildIndex } from './importedModel/useImportedModelChildIndex';
import { useImportedModelSelectionEffects } from './importedModel/useImportedModelSelectionEffects';
import { useImportedModelFadeIn } from './importedModel/useImportedModelFadeIn';
import { useImportedModelOpacityMaterials } from './importedModel/useImportedModelOpacityMaterials';
import { useImportedModelChildTransforms } from './importedModel/useImportedModelChildTransforms';
import { useImportedModelInteractions } from './importedModel/useImportedModelInteractions';

// =============================================================================
// Main Component
// =============================================================================

const ImportedModelInner: React.FC<ImportedModelProps> = ({
  obj,
  isSelected,
  selectedChildPath,
  outlinedChildPath,
  onPointerDown,
  onDoubleClick,
  isDragging: _isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
  isActualReference = false,
  highlightOnlyChild = false,
}) => {
  // Note: _isDragging is available for future use but currently unused
  const outerGroupRef = useRef<THREE.Group>(null);
  const modelAssetId = obj.properties.modelAssetId as string | undefined;
  const { model, loading, error, modelHeight, opacity, setOpacity } = useImportedModelLoad({
    modelAssetId,
    isGhost,
    isActualReference,
  });

  // Track which child mesh is currently hovered (for visual feedback when parent is selected)
  const [hoveredChildPath, setHoveredChildPath] = useState<string | null>(null);

  // Check if a specific child is selected
  const hasChildSelected = selectedChildPath !== null && selectedChildPath !== undefined;

  // Check if a child should be outlined (preview target)
  const hasOutlinedChild = outlinedChildPath !== null && outlinedChildPath !== undefined;

  // Set userData.objectId on outer group for scene traversal (used by TransformGizmo)
  useEffect(() => {
    if (outerGroupRef.current && outerGroupRef.current.userData) {
      outerGroupRef.current.userData.objectId = obj.id;
      // Used by preview occlusion raycasts to associate intersections to a SceneObject
      outerGroupRef.current.userData.sceneObjectId = obj.id;
    }
  }, [obj.id]);

  // Outer group position: visual center for rotation pivot
  // pivotY = groundLevel + modelHeight/2
  const position = useMemo<[number, number, number]>(() => {
    const groundLevel = obj.transform.y / 100;
    const pivotY = groundLevel + modelHeight / 2;
    return [obj.transform.x / 100, pivotY, -obj.transform.z / 100];
  }, [obj.transform.x, obj.transform.y, obj.transform.z, modelHeight]);

  // Rotation calculation
  const rotation = useMemo<[number, number, number]>(
    () => [
      THREE.MathUtils.degToRad(obj.transform.rotationX),
      THREE.MathUtils.degToRad(obj.transform.rotationY),
      THREE.MathUtils.degToRad(obj.transform.rotationZ),
    ],
    [obj.transform.rotationX, obj.transform.rotationY, obj.transform.rotationZ]
  );

  // Scale calculation (no animation - separate opacity for fade-in)
  const scale = useMemo<[number, number, number]>(
    () => [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ],
    [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]
  );

  // Inner group offset: fixed offset to keep bottom at ground
  // This offset never changes, regardless of rotation or scale
  const modelOffset = useMemo<[number, number, number]>(
    () => [0, -modelHeight / 2, 0],
    [modelHeight]
  );

  const { childPathToMesh, findChildPathForMesh } = useImportedModelChildIndex({
    model,
    children: obj.children,
    sceneObjectId: obj.id,
  });

  const { handlePointerDown, handleDoubleClick, handlePointerMove, handlePointerOut } =
    useImportedModelInteractions({
      model,
      obj,
      childPathToMesh,
      findChildPathForMesh,
      isSelected,
      hasChildSelected,
      selectedChildPath,
      hoveredChildPath,
      setHoveredChildPath,
      onPointerDown,
      onDoubleClick,
      onHoverEnd,
    });

  useImportedModelFadeIn({ model, loading, error, setOpacity });

  useImportedModelOpacityMaterials({
    model,
    opacity,
    isGhost,
    isActualReference,
    highlightOnlyChild,
    hasChildSelected,
    selectedChildPath,
    childPathToMesh,
  });

  useImportedModelChildTransforms({ model, children: obj.children, childPathToMesh });

  useImportedModelSelectionEffects({
    model,
    isSelected,
    isHovered,
    hasChildSelected,
    selectedChildPath,
    hoveredChildPath,
    childPathToMesh,
    isGhost,
  });

  // Get the selected child mesh for outline rendering
  // NOTE: This hook MUST be called before any early returns to satisfy React's rules of hooks
  const selectedChildMesh = useMemo(() => {
    if (!hasChildSelected || !selectedChildPath || !model) return null;
    const entry = childPathToMesh.get(selectedChildPath);
    return entry?.mesh ?? null;
  }, [hasChildSelected, selectedChildPath, childPathToMesh, model]);

  // Get the outlined child mesh (preview target) for outline rendering
  // NOTE: This hook MUST be called before any early returns to satisfy React's rules of hooks
  const outlinedChildMesh = useMemo(() => {
    if (!hasOutlinedChild || !outlinedChildPath || !model) return null;
    const entry = childPathToMesh.get(outlinedChildPath);
    return entry?.mesh ?? null;
  }, [hasOutlinedChild, outlinedChildPath, childPathToMesh, model]);

  // Render error state
  if (error) {
    return (
      <group ref={outerGroupRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.7} />
        </mesh>
      </group>
    );
  }

  // Render loading state
  if (loading || !model) {
    return (
      <group ref={outerGroupRef} position={position} rotation={rotation} scale={scale}>
        <LoadingPlaceholder />
      </group>
    );
  }

  // Render model with two-group structure
  // Outer group: positioned at visual center, handles rotation/scale
  // Inner group: fixed offset to keep bottom at ground
  return (
    <group ref={outerGroupRef} position={position} rotation={rotation} scale={scale}>
      <group position={modelOffset}>
        {/* Render model with pointer events attached directly to it */}
        {/* This ensures only the mesh is clickable, not the bounding box or empty space */}
        <primitive
          object={model}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onPointerOver={onHoverStart}
          onPointerOut={handlePointerOut}
          onPointerMove={handlePointerMove}
        />

        {/* Post-processing outline for selected child mesh */}
        <SelectObject
          object={outlinedChildMesh ?? selectedChildMesh}
          enabled={
            (hasOutlinedChild && outlinedChildMesh !== null) ||
            (hasChildSelected && selectedChildMesh !== null)
          }
        />
      </group>
    </group>
  );
};

// Memoized wrapper for performance
export const ImportedModel = React.memo(ImportedModelInner, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.obj.id === nextProps.obj.id &&
    prevProps.obj.transform.x === nextProps.obj.transform.x &&
    prevProps.obj.transform.y === nextProps.obj.transform.y &&
    prevProps.obj.transform.z === nextProps.obj.transform.z &&
    prevProps.obj.transform.rotationX === nextProps.obj.transform.rotationX &&
    prevProps.obj.transform.rotationY === nextProps.obj.transform.rotationY &&
    prevProps.obj.transform.rotationZ === nextProps.obj.transform.rotationZ &&
    prevProps.obj.transform.scaleX === nextProps.obj.transform.scaleX &&
    prevProps.obj.transform.scaleY === nextProps.obj.transform.scaleY &&
    prevProps.obj.transform.scaleZ === nextProps.obj.transform.scaleZ &&
    prevProps.obj.children === nextProps.obj.children &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectedChildPath === nextProps.selectedChildPath &&
    prevProps.outlinedChildPath === nextProps.outlinedChildPath &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.isGhost === nextProps.isGhost &&
    prevProps.isActualReference === nextProps.isActualReference &&
    prevProps.highlightOnlyChild === nextProps.highlightOnlyChild
  );
});

ImportedModel.displayName = 'ImportedModel';
