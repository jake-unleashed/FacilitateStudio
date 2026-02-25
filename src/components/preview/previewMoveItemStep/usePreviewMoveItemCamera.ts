import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CameraControlsImpl from 'camera-controls';
import type { SceneObject, SimStep } from '../../../types';
import { calculatePreviewMoveItemBaseFraming, generatePreviewCameraCandidatesWithPitchTiers } from '../../../utils/previewCameraCalculator';
import { pickBestPreviewCameraCandidateByRaycastWithMetricsAsync } from '../../../utils/previewCameraOcclusion';
import { MIN_FOCUS_CAMERA_Y } from '../../../utils/focusCameraOcclusion';

/** Distance epsilon (world units) for declaring camera position settled. */
const POSITION_EPSILON = 0.02;
/** Distance epsilon (world units) for declaring camera look-at target settled. */
const TARGET_EPSILON = 0.02;
/** Milliseconds the camera must remain within epsilon before settle is confirmed. */
const SETTLE_STABLE_MS = 180;
/** Milliseconds after setLookAt fires before the transition is assumed complete regardless of epsilon. */
const TRANSITION_COMPLETE_MS = 800;
/** Hard timeout: force-settle if the camera hasn't landed after this many milliseconds. */
const MAX_SETTLE_WAIT_MS = 5000;
/** Delay after camera settle before showing the interaction outline. */
const OUTLINE_SHOW_DELAY_MS = 150;
/** Number of raycasted azimuth samples used to pick the best camera position. */
const RAYCAST_SAMPLE_COUNT = 12;

/**
 * Manages automated camera positioning for a preview move-item step.
 *
 * Calculates an occlusion-aware camera position that frames the target object,
 * smoothly animates the camera there, temporarily disables trainee orbit/zoom
 * controls during the transition, and reveals the interaction outline once the
 * camera has settled.
 *
 * @returns `showOutline` – whether the interaction outline should be rendered.
 */
export function usePreviewMoveItemCamera(args: {
  step: SimStep;
  isValidStep: boolean;
  targetObject: SceneObject | null;
  implicitStartPosition: { x: number; y: number; z: number } | null;
  cameraControlsRef: React.RefObject<CameraControlsImpl>;
  isPositioningCameraRef?: React.MutableRefObject<boolean>;
  isAnimating: boolean;
  distanceMultiplier?: number;
}): { showOutline: boolean } {
  const { camera, scene, invalidate } = useThree();
  const {
    step,
    isValidStep,
    targetObject,
    implicitStartPosition,
    cameraControlsRef,
    isPositioningCameraRef,
    isAnimating,
    distanceMultiplier = 1.0,
  } = args;

  const hasPositionedCamera = useRef(false);
  const previousStepIdRef = useRef<string | null>(null);
  const isPositioningRef = useRef(false);
  const targetCameraPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetCameraTargetRef = useRef<THREE.Vector3 | null>(null);
  const cameraSettledTimeRef = useRef<number | null>(null);
  const settleStartTimeRef = useRef<number | null>(null);
  const transitionStartTimeRef = useRef<number | null>(null);
  const positioningStartedTimeRef = useRef<number | null>(null);
  const tmpTargetVecRef = useRef(new THREE.Vector3());
  const isCalculatingCameraRef = useRef(false);

  const [showOutline, setShowOutline] = useState(false);

  const markCameraAsSettled = (settledAt: number) => {
    isPositioningRef.current = false;
    if (isPositioningCameraRef) isPositioningCameraRef.current = false;
    targetCameraPositionRef.current = null;
    targetCameraTargetRef.current = null;
    settleStartTimeRef.current = null;
    transitionStartTimeRef.current = null;
    positioningStartedTimeRef.current = null;

    if (cameraSettledTimeRef.current === null) {
      cameraSettledTimeRef.current = settledAt;
    }
  };

  // Track step changes and reset camera positioning flag
  useEffect(() => {
    hasPositionedCamera.current = false;
    previousStepIdRef.current = step.id;
    cameraSettledTimeRef.current = null;
    settleStartTimeRef.current = null;
    transitionStartTimeRef.current = null;
    positioningStartedTimeRef.current = null;
    setShowOutline(false);
    isPositioningRef.current = false;
    if (isPositioningCameraRef) isPositioningCameraRef.current = false;
    targetCameraPositionRef.current = null;
    targetCameraTargetRef.current = null;
    isCalculatingCameraRef.current = false;
  }, [step.id, isPositioningCameraRef]);

  // Keep controls enabled during camera positioning transition
  useFrame((_state, delta) => {
    if (isPositioningRef.current && cameraControlsRef.current) {
      cameraControlsRef.current.update(delta);
      const now = Date.now();

      const transitionElapsedMs =
        transitionStartTimeRef.current === null ? null : now - transitionStartTimeRef.current;
      if (transitionElapsedMs !== null && transitionElapsedMs >= TRANSITION_COMPLETE_MS) {
        markCameraAsSettled(now);
        return;
      }

      const positioningElapsedMs =
        positioningStartedTimeRef.current === null ? null : now - positioningStartedTimeRef.current;
      if (positioningElapsedMs !== null && positioningElapsedMs >= MAX_SETTLE_WAIT_MS) {
        markCameraAsSettled(now);
        return;
      }

      const targetPos = targetCameraPositionRef.current;
      const targetTarget = targetCameraTargetRef.current;
      if (targetPos && targetTarget) {
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
            markCameraAsSettled(now);
            return;
          } else {
            if (isPositioningCameraRef) isPositioningCameraRef.current = true;
          }
        } else {
          if (isPositioningCameraRef) isPositioningCameraRef.current = true;
        }
      } else {
        if (isPositioningCameraRef) isPositioningCameraRef.current = true;
      }
    }

    // Show outline shortly after camera has settled
    if (cameraSettledTimeRef.current !== null && !showOutline) {
      const timeSinceSettled = Date.now() - cameraSettledTimeRef.current;
      if (timeSinceSettled >= OUTLINE_SHOW_DELAY_MS) {
        setShowOutline(true);
        invalidate();
      }
    }
  });

  // Position camera when step starts
  useFrame((_state, delta) => {
    if (!isValidStep || !targetObject || isAnimating) return;
    if (hasPositionedCamera.current) {
      if (isPositioningRef.current && cameraControlsRef.current) {
        cameraControlsRef.current.update(delta);
      }
      return;
    }
    if (!cameraControlsRef.current) return;

    if (previousStepIdRef.current === null || previousStepIdRef.current !== step.id) {
      return;
    }

    try {
      const startPos =
        step.startPosition ??
        implicitStartPosition ?? {
          x: targetObject.transform.x,
          y: targetObject.transform.y,
          z: targetObject.transform.z,
        };
      const endPos = step.endPosition ?? startPos;

      if (isCalculatingCameraRef.current) return;
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

          const defaultPitch = (() => {
            const dx = (camera as THREE.PerspectiveCamera).position.x - base.target[0];
            const dy = (camera as THREE.PerspectiveCamera).position.y - base.target[1];
            const dz = (camera as THREE.PerspectiveCamera).position.z - base.target[2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (!isFinite(d) || d < 1e-6) return Math.atan(0.6);
            return Math.asin(THREE.MathUtils.clamp(dy / d, -1, 1));
          })();

          const basePitch = Math.atan(0.6);
          const cameraDistance = base.distance * distanceMultiplier;
          const baseTierCandidates = generatePreviewCameraCandidatesWithPitchTiers({
            target: base.target,
            distance: cameraDistance,
            defaultAzimuth: base.defaultAzimuth,
            sampleCount: RAYCAST_SAMPLE_COUNT,
            pitchTiers: [{ pitch: basePitch, tierIndex: 0 }],
            defaultPitch,
          });

          const fallbackCandidates = generatePreviewCameraCandidatesWithPitchTiers({
            target: base.target,
            distance: cameraDistance,
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

          if (previousStepIdRef.current !== step.id) return;

          targetCameraPositionRef.current = new THREE.Vector3(clampedPosition[0], clampedPosition[1], clampedPosition[2]);
          targetCameraTargetRef.current = new THREE.Vector3(base.target[0], base.target[1], base.target[2]);
          settleStartTimeRef.current = null;
          const now = Date.now();
          transitionStartTimeRef.current = now;
          positioningStartedTimeRef.current = now;

          isPositioningRef.current = true;
          if (isPositioningCameraRef) isPositioningCameraRef.current = true;

          currentControls.setLookAt(
            clampedPosition[0],
            clampedPosition[1],
            clampedPosition[2],
            base.target[0],
            base.target[1],
            base.target[2],
            true
          );

          currentControls.update(delta);
        } catch (error) {
          console.error('[Camera] Error positioning preview camera:', error);
        } finally {
          isCalculatingCameraRef.current = false;
        }
      })();
    } catch (error) {
      console.error('[Camera] Error positioning camera:', error);
      hasPositionedCamera.current = true;
    }
  });

  return { showOutline };
}

