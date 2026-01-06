import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* eslint-disable react/no-unknown-property -- react-three-fiber supports three.js props like renderOrder */

interface ObjectOutlineProps {
  /** Object position in world space (centimeters) */
  position: { x: number; y: number; z: number };
  /** Object scale */
  scale: { x: number; y: number; z: number };
  /** Object rotation in degrees */
  rotation: { x: number; y: number; z: number };
  /** Color for the outline */
  color?: string;
  /** Whether the outline is visible */
  visible?: boolean;
}

/**
 * Premium colored outline effect for highlighting objects during preview.
 * Uses a scaled-up version of the object with an outline shader for a polished look.
 */
export const ObjectOutline: React.FC<ObjectOutlineProps> = ({
  position,
  scale,
  rotation,
  color = '#3b82f6',
  visible = true,
}) => {
  const outlineRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0.8);

  // Convert position from centimeters to meters
  const worldPos = useMemo(
    () => [position.x / 100, position.y / 100, -position.z / 100] as [number, number, number],
    [position.x, position.y, position.z]
  );

  // Convert rotation from degrees to radians
  const worldRotation = useMemo(
    () =>
      [
        THREE.MathUtils.degToRad(rotation.x),
        THREE.MathUtils.degToRad(rotation.y),
        THREE.MathUtils.degToRad(rotation.z),
      ] as [number, number, number],
    [rotation.x, rotation.y, rotation.z]
  );

  // Convert scale
  const worldScale = useMemo(
    () => [scale.x, scale.y, scale.z] as [number, number, number],
    [scale.x, scale.y, scale.z]
  );

  // Create base geometry for the outline
  const baseGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // For a solid colored outline, we'll render a slightly larger version with back faces
  // This creates a visible outline around the object that's always visible
  // Use a brighter, more saturated version of the color for better visibility
  const outlineColor = useMemo(() => {
    const tempColor = new THREE.Color(color);
    // Increase brightness and saturation
    tempColor.r = Math.min(1, tempColor.r * 1.3);
    tempColor.g = Math.min(1, tempColor.g * 1.3);
    tempColor.b = Math.min(1, tempColor.b * 1.3);
    return tempColor;
  }, [color]);

  const outlineMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: outlineColor,
        transparent: true,
        opacity: 0.85,
        side: THREE.BackSide, // Render back faces only to create outline when scaled up
        depthWrite: false, // Don't write to depth buffer to avoid z-fighting
      }),
    [outlineColor]
  );

  // Animate pulsing effect - more obvious and attention-grabbing
  useFrame((state) => {
    if (outlineRef.current && visible) {
      // More obvious pulse between 1.12 and 1.20 scale (larger, more noticeable)
      const baseScale = 1.16;
      const pulseAmount = 0.04;
      const pulse = baseScale + Math.sin(state.clock.elapsedTime * 3) * pulseAmount;
      outlineRef.current.scale.setScalar(pulse);

      // More noticeable opacity pulse between 0.7 and 1.0 (brighter, more visible)
      opacityRef.current = 0.7 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      outlineMaterial.opacity = opacityRef.current;
    } else if (outlineRef.current && !visible) {
      // Fade out smoothly when hidden
      opacityRef.current = Math.max(0, opacityRef.current - 0.15);
      outlineMaterial.opacity = opacityRef.current;
    }
  });

  // Don't render if not visible and fully faded out
  if (!visible && opacityRef.current <= 0) {
    return null;
  }

  return (
    <group position={worldPos} rotation={worldRotation} scale={worldScale}>
      {/* Outline - rendered as a slightly larger version with back faces for outline effect */}
      <mesh ref={outlineRef} renderOrder={1}>
        <primitive object={baseGeometry} />
        <primitive object={outlineMaterial} />
      </mesh>
    </group>
  );
};
