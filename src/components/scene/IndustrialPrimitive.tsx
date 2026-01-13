/**
 * IndustrialPrimitive Component
 *
 * Renders a simple box primitive with transform, selection, and hover feedback.
 * Uses shared geometry for performance and custom memo comparison to minimize re-renders.
 */

import React, { useRef, useMemo, useCallback, useEffect, memo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneObject } from '../../types';

// Shared geometry instance - created once and reused across all primitives
const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

export interface IndustrialPrimitiveProps {
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

const IndustrialPrimitiveInner: React.FC<IndustrialPrimitiveProps> = ({
  obj,
  isSelected: _isSelected,
  onPointerDown,
  onDoubleClick,
  isDragging,
  isHovered,
  onHoverStart,
  onHoverEnd,
  isGhost = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const color = obj.properties.color || '#3b82f6';

  // Memoize position array to prevent unnecessary re-renders
  const position = useMemo<[number, number, number]>(
    () => [obj.transform.x / 100, obj.transform.y / 100, -obj.transform.z / 100],
    [obj.transform.x, obj.transform.y, obj.transform.z]
  );

  // Memoize rotation array
  const rotation = useMemo<[number, number, number]>(
    () => [
      THREE.MathUtils.degToRad(obj.transform.rotationX),
      THREE.MathUtils.degToRad(obj.transform.rotationY),
      THREE.MathUtils.degToRad(obj.transform.rotationZ),
    ],
    [obj.transform.rotationX, obj.transform.rotationY, obj.transform.rotationZ]
  );

  // Memoize scale array
  const scale = useMemo<[number, number, number]>(
    () => [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ],
    [obj.transform.scaleX, obj.transform.scaleY, obj.transform.scaleZ]
  );

  // Memoize event handlers
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onPointerDown(e, obj);
    },
    [onPointerDown, obj]
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onDoubleClick(obj);
    },
    [onDoubleClick, obj]
  );

  const handlePointerEnter = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverStart();
    },
    [onHoverStart]
  );

  const handlePointerLeave = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHoverEnd();
    },
    [onHoverEnd]
  );

  // Calculate emissive properties - increased intensity for clearer pre-selection feedback
  const emissiveColor = isHovered && !isDragging ? '#ffffff' : '#000000';
  const emissiveIntensity = isHovered && !isDragging ? 0.18 : 0;

  // Set userData.objectId on group for scene traversal (used by TransformGizmo)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData.objectId = obj.id;
    }
  }, [obj.id]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh geometry={sharedBoxGeometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.1}
          // eslint-disable-next-line react/no-unknown-property
          emissive={emissiveColor}
          // eslint-disable-next-line react/no-unknown-property
          emissiveIntensity={emissiveIntensity}
          transparent={isGhost}
          opacity={isGhost ? 0.45 : 1.0}
        />
      </mesh>
    </group>
  );
};

// Memoized component with custom comparison for optimal re-rendering
export const IndustrialPrimitive = memo(IndustrialPrimitiveInner, (prevProps, nextProps) => {
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
    prevProps.obj.properties.color === nextProps.obj.properties.color &&
    prevProps.obj.properties.visible === nextProps.obj.properties.visible &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isHovered === nextProps.isHovered
  );
});
