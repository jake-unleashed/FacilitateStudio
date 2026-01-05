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
import { SceneObject } from '../../types';
import { getOrLoadModel } from '../../utils/modelCache';
import { BoundingBox } from './BoundingBox';

interface ImportedModelProps {
  obj: SceneObject;
  isSelected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, obj: SceneObject) => void;
  onDoubleClick: (obj: SceneObject) => void;
  isDragging: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isGhost?: boolean;
}

// Loading placeholder component
const LoadingPlaceholder: React.FC = () => {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
    </mesh>
  );
};

const ImportedModelInner: React.FC<ImportedModelProps> = ({
  obj,
  isSelected,
  onPointerDown,
  onDoubleClick,
  isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
}) => {
  const outerGroupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelHeight, setModelHeight] = useState<number>(0);
  const [opacity, setOpacity] = useState(0);

  const modelAssetId = obj.properties.modelAssetId as string | undefined;

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

    getOrLoadModel(modelAssetId)
      .then(({ model: loadedModel, metrics }) => {
        if (cancelled) return;

        setModel(loadedModel);
        setModelHeight(metrics.size.y);
        setLoading(false);

        // Start fade-in animation
        requestAnimationFrame(() => {
          if (!cancelled) {
            setOpacity(1);
          }
        });
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
  const position = useMemo<[number, number, number]>(
    () => {
      const groundLevel = obj.transform.y / 100;
      const pivotY = groundLevel + modelHeight / 2;
      return [obj.transform.x / 100, pivotY, -obj.transform.z / 100];
    },
    [obj.transform.x, obj.transform.y, obj.transform.z, modelHeight]
  );

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

  // Memoize event handlers
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onPointerDown(e, obj);
    },
    [onPointerDown, obj]
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(obj);
  }, [onDoubleClick, obj]);

  // Fade-in animation
  useEffect(() => {
    if (!loading && !error && model) {
      const duration = 300; // 0.3 seconds
      const startTime = Date.now();
      const startOpacity = 0;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        setOpacity(startOpacity + (1 - startOpacity) * eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [loading, error, model]);

  // Apply opacity to model materials
  useEffect(() => {
    if (model && opacity < 1) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat) => {
            if (
              mat instanceof THREE.MeshStandardMaterial ||
              mat instanceof THREE.MeshBasicMaterial ||
              mat instanceof THREE.MeshPhongMaterial ||
              mat instanceof THREE.MeshLambertMaterial
            ) {
              mat.transparent = opacity < 1;
              mat.opacity = opacity;
            }
          });
        }
      });
    }
  }, [model, opacity]);

  // Selection and hover effects (optimized: only run when needed)
  const prevSelectedRef = useRef(isSelected);
  const prevHoveredRef = useRef(isHovered);

  useFrame(() => {
    if (!model) return;

    // Only update materials if selection/hover state changed
    const selectionChanged = prevSelectedRef.current !== isSelected;
    const hoverChanged = prevHoveredRef.current !== isHovered;

    if (selectionChanged || hoverChanged || isSelected || isHovered) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          if (isSelected) {
            const highlightColor = isGhost ? '#a855f7' : '#3b82f6';
            child.material.emissive.set(highlightColor).multiplyScalar(0.15);
          } else if (isHovered) {
            child.material.emissive.set('#ffffff').multiplyScalar(0.08);
          } else {
            child.material.emissive.set('#000000');
          }
        }
      });

      prevSelectedRef.current = isSelected;
      prevHoveredRef.current = isHovered;
    }
  });

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

        {/* Premium bounding box selection indicator - non-interactive */}
        {isSelected && (
          <BoundingBox
            model={model}
            color={isGhost ? '#a855f7' : '#3b82f6'}
            visible={isSelected}
            animated={!isDragging}
          />
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
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.isGhost === nextProps.isGhost
  );
});

ImportedModel.displayName = 'ImportedModel';
