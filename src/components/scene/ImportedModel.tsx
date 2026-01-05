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

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneObject, ChildMesh, pathToString } from '../../types';
import { getOrLoadModel } from '../../utils/modelCache';
import { findChildByPath } from '../../utils/modelLoaders';
import { BoundingBox } from './BoundingBox';

// =============================================================================
// Constants
// =============================================================================

/** Duration of fade-in animation in milliseconds */
const FADE_IN_DURATION_MS = 300;

/** Colors for selection/hover effects */
const SELECTION_COLOR = '#3b82f6';
const SELECTION_COLOR_GHOST = '#a855f7';
const CHILD_SELECTION_COLOR = '#10b981'; // Emerald for child selection
const HOVER_COLOR = '#ffffff';
const SELECTION_INTENSITY = 0.15;
const HOVER_INTENSITY = 0.08;

// =============================================================================
// Types
// =============================================================================

interface ImportedModelProps {
  obj: SceneObject;
  isSelected: boolean;
  /** Path of the selected child mesh (if any) - format: "path.to.child" */
  selectedChildPath?: string | null;
  onPointerDown: (e: ThreeEvent<PointerEvent>, obj: SceneObject) => void;
  /** Called when a child mesh is clicked - passes the child path */
  onChildPointerDown?: (e: ThreeEvent<PointerEvent>, obj: SceneObject, childPath: string) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isGhost?: boolean;
}

// =============================================================================
// Helper Components
// =============================================================================

/** Placeholder shown while model is loading */
const LoadingPlaceholder: React.FC = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
  </mesh>
);

// =============================================================================
// Main Component
// =============================================================================

const ImportedModelInner: React.FC<ImportedModelProps> = ({
  obj,
  isSelected,
  selectedChildPath,
  onPointerDown,
  onChildPointerDown,
  onDoubleClick,
  isDragging: _isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
}) => {
  // Note: _isDragging is available for future use but currently unused
  const outerGroupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelHeight, setModelHeight] = useState<number>(0);
  // Start at opacity 1 - models should be visible immediately
  // Fade-in animation will temporarily reduce opacity if enabled
  const [opacity, setOpacity] = useState(1);

  // Track which child mesh is currently hovered (for visual feedback)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hoveredChildPath, _setHoveredChildPath] = useState<string | null>(null);

  const modelAssetId = obj.properties.modelAssetId as string | undefined;

  // Check if a specific child is selected
  const hasChildSelected = selectedChildPath !== null && selectedChildPath !== undefined;

  // Load model from shared cache when asset ID changes
  useEffect(() => {
    if (!modelAssetId) {
      setError('No model asset ID provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reset opacity for new model load
    setOpacity(0);

    getOrLoadModel(modelAssetId)
      .then(({ model: loadedModel, metrics }) => {
        if (cancelled) return;

        setModel(loadedModel);
        setModelHeight(metrics.size.y);
        setLoading(false);
        // Don't set opacity here - let the fade-in effect handle it
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ImportedModel] Failed to load model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelAssetId]);

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

  // Build a map of path strings to child mesh info for efficient lookup
  // Must be defined before findChildPathForMesh which uses it
  const childPathToMesh = useMemo(() => {
    const map = new Map<string, { mesh: THREE.Object3D; childInfo: ChildMesh }>();
    if (!model || !obj.children) return map;

    for (const child of obj.children) {
      const pathStr = pathToString(child.path);
      const meshObj = findChildByPath(model, child.path);
      if (meshObj) {
        map.set(pathStr, { mesh: meshObj, childInfo: child });
      }
    }
    return map;
  }, [model, obj.children]);

  // Find which child (if any) a clicked mesh belongs to
  const findChildPathForMesh = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      // For each child in our map, check if the clicked mesh is the child or a descendant of it
      for (const [pathStr, { mesh }] of childPathToMesh) {
        // Check if clicked mesh IS this child mesh
        if (mesh === clickedMesh) {
          return pathStr;
        }

        // Check if clicked mesh is a descendant of this child
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = clickedMesh;
        while (current && current !== model) {
          if (current === mesh) {
            return pathStr;
          }
          current = current.parent;
        }
      }

      return null;
    },
    [model, obj.children, childPathToMesh]
  );

  // Memoize event handlers
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      // Check if a specific child was clicked
      const childPath = findChildPathForMesh(e.object);

      if (childPath && onChildPointerDown) {
        // Child mesh was clicked
        onChildPointerDown(e, obj, childPath);
      } else {
        // Parent was clicked (or no children exist)
        onPointerDown(e, obj);
      }
    },
    [onPointerDown, onChildPointerDown, obj, findChildPathForMesh]
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(obj);
  }, [onDoubleClick, obj]);

  // Fade-in animation with proper cleanup
  useEffect(() => {
    if (!loading && !error && model) {
      let cancelled = false;
      const startTime = Date.now();

      const animate = () => {
        if (cancelled) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / FADE_IN_DURATION_MS, 1);
        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        setOpacity(eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);

      return () => {
        cancelled = true;
      };
    }
  }, [loading, error, model]);

  // Apply opacity to model materials - runs for ALL opacity values including 1
  useEffect(() => {
    if (!model) return;

    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (
            mat instanceof THREE.MeshStandardMaterial ||
            mat instanceof THREE.MeshBasicMaterial ||
            mat instanceof THREE.MeshPhongMaterial ||
            mat instanceof THREE.MeshLambertMaterial
          ) {
            // When opacity is 1, disable transparency for better rendering
            const isTransparent = opacity < 1;
            mat.transparent = isTransparent;
            mat.opacity = opacity;
            // Ensure Three.js knows to update the material
            mat.needsUpdate = true;
          }
        });
      }
    });
  }, [model, opacity]);

  // Apply child transforms when they change
  useEffect(() => {
    if (!model || !obj.children) return;

    for (const child of obj.children) {
      const pathStr = pathToString(child.path);
      const entry = childPathToMesh.get(pathStr);
      if (!entry) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mesh = entry.mesh as any;
      const lt = entry.childInfo.localTransform;

      // Apply local transform offset (position only for now)
      // Scale of 100 matches the parent transform convention
      mesh.position.set(lt.x / 100, lt.y / 100, -lt.z / 100);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(lt.rotationX),
        THREE.MathUtils.degToRad(lt.rotationY),
        THREE.MathUtils.degToRad(lt.rotationZ)
      );
      mesh.scale.set(lt.scaleX, lt.scaleY, lt.scaleZ);
    }
  }, [model, obj.children, childPathToMesh]);

  // Selection and hover effects (optimized: only run when needed)
  const prevSelectedRef = useRef(isSelected);
  const prevHoveredRef = useRef(isHovered);
  const prevSelectedChildPathRef = useRef(selectedChildPath);
  const prevHoveredChildPathRef = useRef(hoveredChildPath);

  useFrame(() => {
    if (!model) return;

    // Only update materials if selection/hover state changed
    const selectionChanged = prevSelectedRef.current !== isSelected;
    const hoverChanged = prevHoveredRef.current !== isHovered;
    const childSelectionChanged = prevSelectedChildPathRef.current !== selectedChildPath;
    const childHoverChanged = prevHoveredChildPathRef.current !== hoveredChildPath;

    if (
      selectionChanged ||
      hoverChanged ||
      childSelectionChanged ||
      childHoverChanged ||
      isSelected ||
      isHovered ||
      hasChildSelected ||
      hoveredChildPath
    ) {
      // Reset all materials first
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.set('#000000');
        }
      });

      // If a child is selected, only highlight that child
      if (hasChildSelected && selectedChildPath) {
        const entry = childPathToMesh.get(selectedChildPath);
        if (entry) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mesh = entry.mesh as any;
          mesh.traverse((child: THREE.Object3D) => {
            if (
              child instanceof THREE.Mesh &&
              child.material instanceof THREE.MeshStandardMaterial
            ) {
              child.material.emissive
                .set(CHILD_SELECTION_COLOR)
                .multiplyScalar(SELECTION_INTENSITY);
            }
          });
          // Also check if it's a single mesh (not a group with children)
          if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.emissive.set(CHILD_SELECTION_COLOR).multiplyScalar(SELECTION_INTENSITY);
          }
        }
      }
      // If parent is selected (no child), highlight entire model
      else if (isSelected) {
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            const highlightColor = isGhost ? SELECTION_COLOR_GHOST : SELECTION_COLOR;
            child.material.emissive.set(highlightColor).multiplyScalar(SELECTION_INTENSITY);
          }
        });
      }
      // If a child is hovered
      else if (hoveredChildPath) {
        const entry = childPathToMesh.get(hoveredChildPath);
        if (entry) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mesh = entry.mesh as any;
          mesh.traverse((child: THREE.Object3D) => {
            if (
              child instanceof THREE.Mesh &&
              child.material instanceof THREE.MeshStandardMaterial
            ) {
              child.material.emissive.set(HOVER_COLOR).multiplyScalar(HOVER_INTENSITY);
            }
          });
        }
      }
      // If parent is hovered
      else if (isHovered) {
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.set(HOVER_COLOR).multiplyScalar(HOVER_INTENSITY);
          }
        });
      }

      prevSelectedRef.current = isSelected;
      prevHoveredRef.current = isHovered;
      prevSelectedChildPathRef.current = selectedChildPath;
      prevHoveredChildPathRef.current = hoveredChildPath;
    }
  });

  // Get the selected child mesh object for bounding box rendering
  // NOTE: This hook MUST be called before any early returns to satisfy React's rules of hooks
  const selectedChildMesh = useMemo(() => {
    if (!hasChildSelected || !selectedChildPath || !model) return null;
    const entry = childPathToMesh.get(selectedChildPath);
    return entry?.mesh ?? null;
  }, [hasChildSelected, selectedChildPath, childPathToMesh, model]);

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
          onPointerOut={onHoverEnd}
        />

        {/* Bounding box for parent selection (when no child is selected) */}
        {isSelected && !hasChildSelected && (
          <BoundingBox model={model} color={isGhost ? '#a855f7' : '#3b82f6'} visible={true} />
        )}

        {/* Bounding box for child selection (emerald color) */}
        {hasChildSelected && selectedChildMesh && (
          <BoundingBox model={selectedChildMesh} color="#10b981" visible={true} />
        )}
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
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.isGhost === nextProps.isGhost
  );
});

ImportedModel.displayName = 'ImportedModel';
