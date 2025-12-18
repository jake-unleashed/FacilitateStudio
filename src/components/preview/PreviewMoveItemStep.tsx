import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { SimStep, SceneObject } from '../../types';
import { calculateCameraPosition } from '../../utils/cameraPositionCalculator';
import { ObjectOutline } from './ObjectOutline';

interface PreviewMoveItemStepProps {
  step: SimStep;
  objects: SceneObject[];
  cameraControlsRef: React.RefObject<CameraControlsImpl>;
  isPositioningCameraRef?: React.MutableRefObject<boolean>;
  onComplete: () => void;
  /** Trigger animation when object is clicked */
  shouldAnimate?: boolean;
  /** Callback when animation starts */
  onAnimationStart?: () => void;
  /** Callback when object position changes during animation */
  onPositionUpdate?: (position: { x: number; y: number; z: number }) => void;
}

/**
 * Manages move-item step execution in preview mode.
 * Shows pulsing outline, handles click, animates object movement.
 */
export const PreviewMoveItemStep: React.FC<PreviewMoveItemStepProps> = ({
  step,
  objects,
  cameraControlsRef,
  isPositioningCameraRef,
  onComplete,
  shouldAnimate = false,
  onAnimationStart,
  onPositionUpdate,
}) => {
  const { camera } = useThree();
  const [isAnimating, setIsAnimating] = useState(false);
  const animationStartTime = useRef<number>(0);
  const hasPositionedCamera = useRef(false);
  const hasStartedAnimation = useRef(false);
  const previousStepIdRef = useRef<string | null>(null);
  const isPositioningRef = useRef(false); // Track if we're currently positioning camera
  const targetCameraPositionRef = useRef<THREE.Vector3 | null>(null); // Store target position for checking completion
  const cameraSettledTimeRef = useRef<number | null>(null); // Track when camera finished moving
  const [showOutline, setShowOutline] = useState(false); // Control outline visibility (after camera settles)

  // Find target object
  const targetObject = useMemo(() => {
    if (!step.targetObjectId) return null;
    return objects.find((obj) => obj.id === step.targetObjectId) || null;
  }, [step.targetObjectId, objects]);

  // Validate step has required data
  const isValidStep = useMemo(() => {
    return (
      step.type === 'move-item' &&
      step.targetObjectId &&
      step.startPosition &&
      step.endPosition &&
      targetObject
    );
  }, [step, targetObject]);

  // Track step changes and reset camera positioning flag
  useEffect(() => {
    // Reset positioning flag when step.id changes (including initial mount)
    hasPositionedCamera.current = false;
    previousStepIdRef.current = step.id;
    cameraSettledTimeRef.current = null;
    setShowOutline(false); // Hide outline until camera settles
    isPositioningRef.current = false;
    targetCameraPositionRef.current = null;
  }, [step.id]);

  // Keep controls enabled during camera positioning transition and update camera controls
  useFrame((_state, delta) => {
    if (isPositioningRef.current && cameraControlsRef.current) {
      // Always update camera controls during positioning to ensure smooth transition continues
      cameraControlsRef.current.update(delta);

      if (targetCameraPositionRef.current) {
        // Check if camera has reached target (rough check - if distance is small)
        const currentPos = camera.position;
        const distance = currentPos.distanceTo(targetCameraPositionRef.current);

        if (distance < 0.1) {
          // Camera has reached target
          isPositioningRef.current = false;
          if (isPositioningCameraRef) {
            isPositioningCameraRef.current = false;
          }
          targetCameraPositionRef.current = null;

          // Mark when camera settled (for delay before showing outline)
          if (cameraSettledTimeRef.current === null) {
            cameraSettledTimeRef.current = Date.now();
          }
        } else {
          // Keep positioning flag set so MainCanvas allows controls to be enabled
          if (isPositioningCameraRef) {
            isPositioningCameraRef.current = true;
          }
        }
      }
    }

    // Show outline after camera has settled and a brief pause (500ms)
    if (cameraSettledTimeRef.current !== null && !showOutline) {
      const timeSinceSettled = Date.now() - cameraSettledTimeRef.current;
      if (timeSinceSettled >= 500) {
        setShowOutline(true);
      }
    }
  });

  // Position camera when step starts - use useFrame to ensure it runs reliably and camera controls updates
  useFrame((_state, delta) => {
    // Early returns for invalid states
    if (!isValidStep || !targetObject || isAnimating) {
      return;
    }
    if (hasPositionedCamera.current) {
      // Camera already positioned, but we need to keep updating camera controls for smooth transition
      if (isPositioningRef.current && cameraControlsRef.current) {
        // Update camera controls each frame to ensure smooth transition continues
        cameraControlsRef.current.update(delta);
      }
      return;
    }
    if (!cameraControlsRef.current) {
      return;
    }
    if (!step.startPosition || !step.endPosition) {
      return;
    }

    // Check if we need to wait for useEffect to sync step ID (only on first frame after mount/step change)
    // This prevents race conditions where useFrame runs before useEffect
    if (previousStepIdRef.current === null || previousStepIdRef.current !== step.id) {
      // Will retry on next frame after useEffect runs
      return;
    }

    try {
      const startPos = step.startPosition;
      const endPos = step.endPosition;

      // Get current camera position and target to try to maintain angle
      const currentCameraPos = camera.position.clone();
      const currentCameraTarget = cameraControlsRef.current
        ? cameraControlsRef.current.getTarget(new THREE.Vector3())
        : undefined;

      const cameraPos = calculateCameraPosition(
        startPos,
        endPos,
        targetObject,
        objects,
        camera as THREE.PerspectiveCamera,
        currentCameraPos,
        currentCameraTarget
      );

      // Set camera position with smooth transition
      const currentControls = cameraControlsRef.current;
      if (currentControls) {
        // Store target position for checking completion
        targetCameraPositionRef.current = new THREE.Vector3(
          cameraPos.position[0],
          cameraPos.position[1],
          cameraPos.position[2]
        );

        // Set positioning flag so MainCanvas allows controls to be enabled
        isPositioningRef.current = true;
        if (isPositioningCameraRef) {
          isPositioningCameraRef.current = true;
        }

        // Use setLookAt with smooth transition
        currentControls.setLookAt(
          cameraPos.position[0],
          cameraPos.position[1],
          cameraPos.position[2],
          cameraPos.target[0],
          cameraPos.target[1],
          cameraPos.target[2],
          true // Smooth transition
        );

        // Update camera controls immediately to start the transition
        currentControls.update(delta);
      }

      hasPositionedCamera.current = true;
    } catch (error) {
      // Error handling - log and mark as positioned to prevent infinite retries
      console.error('[Camera] Error positioning camera:', error);
      hasPositionedCamera.current = true;
    }
  });

  // Start animation when shouldAnimate becomes true
  useEffect(() => {
    if (
      shouldAnimate &&
      !isAnimating &&
      !hasStartedAnimation.current &&
      isValidStep &&
      step.endPosition
    ) {
      hasStartedAnimation.current = true;
      setIsAnimating(true);
      animationStartTime.current = Date.now();
      if (onAnimationStart) {
        onAnimationStart();
      }
    }
  }, [shouldAnimate, isAnimating, isValidStep, step.endPosition, onAnimationStart]);

  // Reset animation state when step changes
  useEffect(() => {
    hasStartedAnimation.current = false;
    setIsAnimating(false);
  }, [step.id]);

  // Animate object movement
  useFrame(() => {
    if (!isAnimating || !step.startPosition || !step.endPosition) return;

    const duration = 2000; // 2 seconds
    const elapsed = Date.now() - animationStartTime.current;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out function for smooth animation
    const easedProgress =
      progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate position
    const start = step.startPosition!;
    const end = step.endPosition!;
    const currentPos = {
      x: start.x + (end.x - start.x) * easedProgress,
      y: start.y + (end.y - start.y) * easedProgress,
      z: start.z + (end.z - start.z) * easedProgress,
    };

    // Notify parent of position update
    if (onPositionUpdate) {
      onPositionUpdate(currentPos);
    }

    // When animation completes
    if (progress >= 1) {
      setIsAnimating(false);
      // Small delay before calling onComplete to let animation settle
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  });

  // If step is invalid, complete immediately
  useEffect(() => {
    if (!isValidStep || !targetObject) {
      onComplete();
    }
  }, [isValidStep, targetObject, onComplete]);

  // Don't render if invalid
  if (!isValidStep || !targetObject) {
    return null;
  }

  // Render outline around target object - only show after camera settles, and before object is clicked
  // Hide outline immediately when clicked, before animation starts
  const shouldShowOutline = showOutline && !shouldAnimate && !isAnimating;

  return (
    <>
      {/* Object outline - only shown after camera settles, hidden once object is clicked */}
      {shouldShowOutline && (
        <ObjectOutline
          position={step.startPosition || { x: 0, y: 0, z: 0 }}
          scale={{
            x: targetObject.transform.scaleX,
            y: targetObject.transform.scaleY,
            z: targetObject.transform.scaleZ,
          }}
          rotation={{
            x: targetObject.transform.rotationX,
            y: targetObject.transform.rotationY,
            z: targetObject.transform.rotationZ,
          }}
          color={targetObject.properties.color || '#3b82f6'}
          visible={shouldShowOutline}
        />
      )}
    </>
  );
};
