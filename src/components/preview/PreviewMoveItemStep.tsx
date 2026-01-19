import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import { SimStep, SceneObject } from '../../types';
import {
  calculateChildWorldPosition,
  findChildByPathString,
} from '../../utils/childTransformUtils';
import {
  calculatePreviewMoveItemBaseFraming,
  generatePreviewCameraCandidatesWithPitchTiers,
} from '../../utils/previewCameraCalculator';
import {
  pickBestPreviewCameraCandidateByRaycastWithMetricsAsync,
} from '../../utils/previewCameraOcclusion';
import { MIN_FOCUS_CAMERA_Y } from '../../utils/focusCameraOcclusion';
import type { PreviewOutlineTarget } from './types';

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
  /** Callback when object transform changes during animation */
  onTransformUpdate?: (
    update: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    },
    childPath?: string
  ) => void;
  /**
   * Callback to control which object/child is outlined in preview mode.
   * Used to drive postprocessing silhouette outlines without coupling to editor selection state.
   */
  onPreviewOutlineTargetChange?: (target: PreviewOutlineTarget | null) => void;
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
  onTransformUpdate,
  onPreviewOutlineTargetChange,
}) => {
  const { camera, scene, invalidate } = useThree();
  const [isAnimating, setIsAnimating] = useState(false);
  const animationStartTime = useRef<number>(0);
  const animationStartWorldPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const animationStartRotationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const animationStartScaleRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const hasPositionedCamera = useRef(false);
  const hasStartedAnimation = useRef(false);
  const previousStepIdRef = useRef<string | null>(null);
  const isPositioningRef = useRef(false); // Track if we're currently positioning camera
  const targetCameraPositionRef = useRef<THREE.Vector3 | null>(null); // Store target position for checking completion
  const targetCameraTargetRef = useRef<THREE.Vector3 | null>(null); // Store target lookAt target for checking completion
  const cameraSettledTimeRef = useRef<number | null>(null); // Track when camera finished moving
  const settleStartTimeRef = useRef<number | null>(null); // Track when we first became "close enough"
  const tmpTargetVecRef = useRef(new THREE.Vector3()); // Avoid allocations in frame loop
  const [showOutline, setShowOutline] = useState(false); // Control outline visibility (after camera settles)
  const isCalculatingCameraRef = useRef(false); // Prevent re-entrant async calculations
  const tmpEulerStartRef = useRef(new THREE.Euler());
  const tmpEulerEndRef = useRef(new THREE.Euler());
  const tmpEulerCurrentRef = useRef(new THREE.Euler());
  const tmpQuatStartRef = useRef(new THREE.Quaternion());
  const tmpQuatEndRef = useRef(new THREE.Quaternion());
  const tmpQuatCurrentRef = useRef(new THREE.Quaternion());

  // Premium-feel tuning for camera settling:
  // - Use tighter thresholds so we don't cut off damping early
  // - Require stability for a short duration so the stop feels smooth
  const POSITION_EPSILON = 0.02;
  const TARGET_EPSILON = 0.02;
  const SETTLE_STABLE_MS = 180;
  // Outline timing: keep it quick after the camera settles to avoid “dead air”.
  const OUTLINE_SHOW_DELAY_MS = 150;
  const RAYCAST_SAMPLE_COUNT = 12;

  // Find target object
  const targetObject = useMemo(() => {
    if (!step.targetObjectId) return null;
    return objects.find((obj) => obj.id === step.targetObjectId) || null;
  }, [step.targetObjectId, objects]);

  // Find target child if applicable
  const targetChild = useMemo(() => {
    if (!targetObject || !step.targetChildPath) return null;
    return findChildByPathString(targetObject, step.targetChildPath);
  }, [targetObject, step.targetChildPath]);

  /**
   * Implicit start position:
   * - If step.startPosition is provided, use it (backwards compatible)
   * - Otherwise, use the object's current position at the moment the step runs
   *   (for child targets: use the child's world position)
   */
  const implicitStartPosition = useMemo(() => {
    if (!targetObject) return null;

    if (step.targetChildPath) {
      return (
        calculateChildWorldPosition(targetObject, step.targetChildPath) ?? {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        }
      );
    }

    return {
      x: targetObject.transform.x,
      y: targetObject.transform.y,
      z: targetObject.transform.z,
    };
  }, [targetObject, step.targetChildPath]);

  /**
   * Implicit start rotation/scale:
   * - If startRotation/startScale are provided, use them (backwards compatible)
   * - Otherwise, use the target's current local rotation/scale at the moment the step runs
   */
  const implicitStartRotationScale = useMemo(() => {
    if (!targetObject) return null;

    if (step.targetChildPath) {
      const child = targetChild;
      if (!child) return null;
      return {
        rotation: {
          x: child.localTransform.rotationX,
          y: child.localTransform.rotationY,
          z: child.localTransform.rotationZ,
        },
        scale: {
          x: child.localTransform.scaleX,
          y: child.localTransform.scaleY,
          z: child.localTransform.scaleZ,
        },
      };
    }

    return {
      rotation: {
        x: targetObject.transform.rotationX,
        y: targetObject.transform.rotationY,
        z: targetObject.transform.rotationZ,
      },
      scale: {
        x: targetObject.transform.scaleX,
        y: targetObject.transform.scaleY,
        z: targetObject.transform.scaleZ,
      },
    };
  }, [targetObject, targetChild, step.targetChildPath]);

  // Validate step has required data
  const isValidStep = useMemo(() => {
    if (step.type !== 'move-item' || !step.targetObjectId || !targetObject) {
      return false;
    }
    const hasEndTransform = !!step.endPosition || !!step.endRotation || !!step.endScale;
    if (!hasEndTransform) return false;
    // If targetChildPath is specified, validate that child exists
    if (step.targetChildPath && !targetChild) {
      return false;
    }
    return true;
  }, [step, targetObject, targetChild]);

  // Track step changes and reset camera positioning flag
  useEffect(() => {
    // Reset positioning flag when step.id changes (including initial mount)
    hasPositionedCamera.current = false;
    previousStepIdRef.current = step.id;
    cameraSettledTimeRef.current = null;
    settleStartTimeRef.current = null;
    setShowOutline(false); // Hide outline until camera settles
    isPositioningRef.current = false;
    targetCameraPositionRef.current = null;
    targetCameraTargetRef.current = null;
    isCalculatingCameraRef.current = false;
  }, [step.id]);

  // Keep controls enabled during camera positioning transition and update camera controls
  useFrame((_state, delta) => {
    if (isPositioningRef.current && cameraControlsRef.current) {
      // Always update camera controls during positioning to ensure smooth transition continues
      cameraControlsRef.current.update(delta);

      const targetPos = targetCameraPositionRef.current;
      const targetTarget = targetCameraTargetRef.current;
      if (targetPos && targetTarget) {
        // Check both camera position and orbit target so we don't cut damping early.
        const posDistance = camera.position.distanceTo(targetPos);
        const currentTarget = cameraControlsRef.current.getTarget(tmpTargetVecRef.current);
        const targetDistance = currentTarget.distanceTo(targetTarget);

        const isCloseEnough = posDistance < POSITION_EPSILON && targetDistance < TARGET_EPSILON;

        if (isCloseEnough) {
          if (settleStartTimeRef.current === null) {
            settleStartTimeRef.current = Date.now();
          }

          const stableMs = Date.now() - settleStartTimeRef.current;
          if (stableMs >= SETTLE_STABLE_MS) {
            // Camera has smoothly settled
            isPositioningRef.current = false;
            if (isPositioningCameraRef) {
              isPositioningCameraRef.current = false;
            }
            targetCameraPositionRef.current = null;
            targetCameraTargetRef.current = null;
            settleStartTimeRef.current = null;

            // Mark when camera settled (for delay before showing outline)
            if (cameraSettledTimeRef.current === null) {
              cameraSettledTimeRef.current = Date.now();
            }
          } else {
            // Keep positioning flag set during the settle window
            if (isPositioningCameraRef) {
              isPositioningCameraRef.current = true;
            }
          }
        } else {
          // Not close enough yet; reset stability timer
          settleStartTimeRef.current = null;
          if (isPositioningCameraRef) {
            isPositioningCameraRef.current = true;
          }
        }
      } else {
        // If we don't have a target to compare against, don't leave positioning mode early.
        if (isPositioningCameraRef) {
          isPositioningCameraRef.current = true;
        }
      }
    }

    // Show outline shortly after camera has settled (avoid “dead air”)
    if (cameraSettledTimeRef.current !== null && !showOutline) {
      const timeSinceSettled = Date.now() - cameraSettledTimeRef.current;
      if (timeSinceSettled >= OUTLINE_SHOW_DELAY_MS) {
        setShowOutline(true);
        // Ensure a frame is rendered even if the canvas is in demand mode.
        invalidate();
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

    // Check if we need to wait for useEffect to sync step ID (only on first frame after mount/step change)
    // This prevents race conditions where useFrame runs before useEffect
    if (previousStepIdRef.current === null || previousStepIdRef.current !== step.id) {
      // Will retry on next frame after useEffect runs
      return;
    }

    try {
      const startPos = step.startPosition ??
        implicitStartPosition ?? {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        };
      const endPos = step.endPosition ?? startPos;

      // Kick off async calculation once; apply results when ready.
      if (isCalculatingCameraRef.current) {
        return;
      }
      isCalculatingCameraRef.current = true;
      hasPositionedCamera.current = true;

      const currentControls = cameraControlsRef.current;
      if (!currentControls) return;

      void (async () => {
        try {
          const base = await calculatePreviewMoveItemBaseFraming({
            startPos,
            endPos,
            targetObject,
            targetChildPath: step.targetChildPath,
            camera: camera as THREE.PerspectiveCamera,
          });

          // Single-decision feel: compute the best candidate fast, then do ONE camera move.
          const defaultPitch = (() => {
            const dx = (camera as THREE.PerspectiveCamera).position.x - base.target[0];
            const dy = (camera as THREE.PerspectiveCamera).position.y - base.target[1];
            const dz = (camera as THREE.PerspectiveCamera).position.z - base.target[2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (!isFinite(d) || d < 1e-6) return Math.atan(0.6);
            return Math.asin(THREE.MathUtils.clamp(dy / d, -1, 1));
          })();

          const basePitch = Math.atan(0.6);
          const baseTierCandidates = generatePreviewCameraCandidatesWithPitchTiers({
            target: base.target,
            distance: base.distance,
            defaultAzimuth: base.defaultAzimuth,
            sampleCount: RAYCAST_SAMPLE_COUNT,
            pitchTiers: [{ pitch: basePitch, tierIndex: 0 }],
            defaultPitch,
          });

          // If base tier fails to find a clear-enough view, expand to above/below tiers.
          const fallbackCandidates = generatePreviewCameraCandidatesWithPitchTiers({
            target: base.target,
            distance: base.distance,
            defaultAzimuth: base.defaultAzimuth,
            sampleCount: RAYCAST_SAMPLE_COUNT,
            pitchTiers: [
              { pitch: basePitch, tierIndex: 0 },
              { pitch: THREE.MathUtils.degToRad(75), tierIndex: 1 },
              { pitch: THREE.MathUtils.degToRad(-15), tierIndex: 1 },
              { pitch: THREE.MathUtils.degToRad(88), tierIndex: 2 },
              { pitch: THREE.MathUtils.degToRad(-75), tierIndex: 2 },
            ],
            defaultPitch,
          });

          const scoreParams = {
            scene,
            targetObjectId: step.targetObjectId!,
            targetChildPath: step.targetChildPath,
            baseTarget: base.target,
            startTarget: base.startFocusTarget,
            endTarget: base.endFocusTarget,
            boundsSize: base.boundsSize,
            breathingRoomMode: 'legacy' as const,
          };

          const baseScored = pickBestPreviewCameraCandidateByRaycastWithMetricsAsync
            ? await pickBestPreviewCameraCandidateByRaycastWithMetricsAsync({
                candidates: baseTierCandidates,
                ...scoreParams,
              })
            : null;

          const scored =
            baseScored && baseScored.clearFraction >= 0.9
              ? baseScored
              : await pickBestPreviewCameraCandidateByRaycastWithMetricsAsync({
                  candidates: fallbackCandidates,
                  ...scoreParams,
                });

          const chosenPosition = scored?.candidate.position ?? base.defaultPosition;
          const clampedPosition: [number, number, number] = [
            chosenPosition[0],
            Math.max(chosenPosition[1], MIN_FOCUS_CAMERA_Y),
            chosenPosition[2],
          ];

          // Ignore if step changed while we were computing.
          if (previousStepIdRef.current !== step.id) return;

          // Store target position for checking completion
          targetCameraPositionRef.current = new THREE.Vector3(
            clampedPosition[0],
            clampedPosition[1],
            clampedPosition[2]
          );
          targetCameraTargetRef.current = new THREE.Vector3(base.target[0], base.target[1], base.target[2]);
          settleStartTimeRef.current = null;

          // Set positioning flag so MainCanvas allows controls to be enabled
          isPositioningRef.current = true;
          if (isPositioningCameraRef) {
            isPositioningCameraRef.current = true;
          }

          currentControls.setLookAt(
            clampedPosition[0],
            clampedPosition[1],
            clampedPosition[2],
            base.target[0],
            base.target[1],
            base.target[2],
            true
          );

          // Start the transition immediately
          currentControls.update(delta);
        } catch (error) {
          console.error('[Camera] Error positioning preview camera:', error);
        } finally {
          isCalculatingCameraRef.current = false;
        }
      })();
    } catch (error) {
      // Error handling - log and mark as positioned to prevent infinite retries
      console.error('[Camera] Error positioning camera:', error);
      hasPositionedCamera.current = true;
    }
  });

  // Start animation when shouldAnimate becomes true
  useEffect(() => {
    if (shouldAnimate && !isAnimating && !hasStartedAnimation.current && isValidStep) {
      hasStartedAnimation.current = true;
      setIsAnimating(true);
      animationStartTime.current = Date.now();
      // Freeze the start position at animation start so it doesn't drift if the object updates during animation.
      animationStartWorldPosRef.current = step.startPosition ?? implicitStartPosition;
      // Freeze local start rotation/scale at animation start.
      animationStartRotationRef.current =
        step.startRotation ?? implicitStartRotationScale?.rotation ?? null;
      animationStartScaleRef.current = step.startScale ?? implicitStartRotationScale?.scale ?? null;
      if (onAnimationStart) {
        onAnimationStart();
      }
    }
  }, [
    shouldAnimate,
    isAnimating,
    isValidStep,
    step.startPosition,
    step.startRotation,
    step.startScale,
    implicitStartPosition,
    implicitStartRotationScale,
    onAnimationStart,
  ]);

  // Reset animation state when step changes
  useEffect(() => {
    hasStartedAnimation.current = false;
    setIsAnimating(false);
    animationStartWorldPosRef.current = null;
    animationStartRotationRef.current = null;
    animationStartScaleRef.current = null;
  }, [step.id]);

  // Animate object movement
  useFrame(() => {
    if (!isAnimating || !targetObject) return;

    const duration = 2000; // 2 seconds
    const elapsed = Date.now() - animationStartTime.current;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out function for smooth animation
    const easedProgress =
      progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const start = animationStartWorldPosRef.current ??
      step.startPosition ??
      implicitStartPosition ?? {
        x: targetObject.transform.x,
        y: targetObject.transform.y,
        z: targetObject.transform.z,
      };
    const end = step.endPosition ?? start;

    // Interpolate position
    const currentWorldPos = {
      x: start.x + (end.x - start.x) * easedProgress,
      y: start.y + (end.y - start.y) * easedProgress,
      z: start.z + (end.z - start.z) * easedProgress,
    };

    const startRot = animationStartRotationRef.current ??
      step.startRotation ??
      implicitStartRotationScale?.rotation ?? {
        x: 0,
        y: 0,
        z: 0,
      };
    const startScale = animationStartScaleRef.current ??
      step.startScale ??
      implicitStartRotationScale?.scale ?? {
        x: 1,
        y: 1,
        z: 1,
      };

    const endRot = step.endRotation ?? startRot;
    const endScale = step.endScale ?? startScale;

    // Shortest-path quaternion slerp (local rotation)
    tmpEulerStartRef.current.set(
      THREE.MathUtils.degToRad(startRot.x),
      THREE.MathUtils.degToRad(startRot.y),
      THREE.MathUtils.degToRad(startRot.z),
      'XYZ'
    );
    tmpEulerEndRef.current.set(
      THREE.MathUtils.degToRad(endRot.x),
      THREE.MathUtils.degToRad(endRot.y),
      THREE.MathUtils.degToRad(endRot.z),
      'XYZ'
    );
    tmpQuatStartRef.current.setFromEuler(tmpEulerStartRef.current);
    tmpQuatEndRef.current.setFromEuler(tmpEulerEndRef.current);
    if (tmpQuatStartRef.current.dot(tmpQuatEndRef.current) < 0) {
      tmpQuatEndRef.current.x *= -1;
      tmpQuatEndRef.current.y *= -1;
      tmpQuatEndRef.current.z *= -1;
      tmpQuatEndRef.current.w *= -1;
    }
    tmpQuatCurrentRef.current
      .copy(tmpQuatStartRef.current)
      .slerp(tmpQuatEndRef.current, easedProgress);
    tmpEulerCurrentRef.current.setFromQuaternion(tmpQuatCurrentRef.current, 'XYZ');

    const currentRot = {
      x: THREE.MathUtils.radToDeg(tmpEulerCurrentRef.current.x),
      y: THREE.MathUtils.radToDeg(tmpEulerCurrentRef.current.y),
      z: THREE.MathUtils.radToDeg(tmpEulerCurrentRef.current.z),
    };

    const currentScale = {
      x: startScale.x + (endScale.x - startScale.x) * easedProgress,
      y: startScale.y + (endScale.y - startScale.y) * easedProgress,
      z: startScale.z + (endScale.z - startScale.z) * easedProgress,
    };

    // If target is a child, we need to update the parent object's transform
    // to achieve the desired child world position
    // For preview, we notify the parent of the world position
    // The parent (PreviewPage) will handle updating the actual object transform
    if (onTransformUpdate) {
      onTransformUpdate(
        {
          position: currentWorldPos,
          rotation: currentRot,
          scale: currentScale,
        },
        step.targetChildPath
      );
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

  // Render outline around target object - only show after camera settles, and before object is clicked
  // Hide outline immediately when clicked, before animation starts
  const shouldShowOutline = isValidStep && showOutline && !shouldAnimate && !isAnimating;

  // Publish outline target to the canvas so postprocessing outline can be driven without selection state.
  useEffect(() => {
    if (!onPreviewOutlineTargetChange) return;
    if (!step.targetObjectId || !isValidStep) {
      onPreviewOutlineTargetChange(null);
      // Ensure outline state clears immediately on screen.
      invalidate();
      return;
    }

    if (shouldShowOutline) {
      onPreviewOutlineTargetChange({
        objectId: step.targetObjectId,
        childPath: step.targetChildPath ?? null,
      });
      invalidate();
    } else {
      onPreviewOutlineTargetChange(null);
      invalidate();
    }

    return () => {
      onPreviewOutlineTargetChange(null);
      invalidate();
    };
  }, [
    onPreviewOutlineTargetChange,
    isValidStep,
    shouldShowOutline,
    step.targetObjectId,
    step.targetChildPath,
    invalidate,
  ]);

  // No in-canvas geometry outline here: preview outlines are now driven via postprocessing
  // selection outlines in MainCanvas (silhouette-based, works for uploaded models).
  return null;
};
