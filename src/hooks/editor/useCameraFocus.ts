import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import { calculateIdealCameraPosition, calculateSoftFocus } from '../../utils/focusUtils';
import { calculateFocusTargetForObject, calculateFocusTargetFromScene } from '../../utils/focusTargetCalculator';
import {
  calculateOcclusionAwareFocusCameraAsync,
  calculateQuickFocusCamera,
  MIN_FOCUS_CAMERA_Y,
} from '../../utils/focusCameraOcclusion';
import type { FocusMode, SceneObject } from '../../types';
import type { FocusTarget } from '../../utils/focusUtils';

const EXPLICIT_FOCUS_TIMEOUT_MS = 120;

interface CameraAim {
  x: number;
  y: number;
  z: number;
}

interface IdealCameraLike extends CameraAim {
  distance: number;
}

function resolveGuidedChildPath(childPath?: string): string | undefined {
  const guidedPhase = typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
  return guidedPhase === 'model-positioning' && childPath ? undefined : childPath;
}

function toCameraAim(target: FocusTarget): CameraAim {
  return {
    x: target.targetX,
    y: target.targetY,
    z: target.targetZ,
  };
}

function buildIdealCamera(position: THREE.Vector3, target: FocusTarget): IdealCameraLike {
  return {
    x: position.x,
    y: position.y,
    z: position.z,
    distance: position.distanceTo(new THREE.Vector3(target.targetX, target.targetY, target.targetZ)),
  };
}

interface UseCameraFocusResult {
  cameraControlsRef: MutableRefObject<CameraControlsImpl | null>;
  sceneRef: MutableRefObject<THREE.Scene | null>;
  handleCameraControlsReady: (controls: CameraControlsImpl) => void;
  handleSceneReady: (scene: THREE.Scene) => void;
  handleFocusObject: (object: SceneObject, childPath?: string, focusMode?: FocusMode) => Promise<void>;
}

export function useCameraFocus(): UseCameraFocusResult {
  const cameraControlsRef = useRef<CameraControlsImpl | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const focusRequestIdRef = useRef(0);
  const [, setControlsReady] = useState(false);

  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  const handleSceneReady = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene;
  }, []);

  const handleFocusObject = useCallback(
    async (object: SceneObject, childPath?: string, focusMode: FocusMode = 'explicit') => {
      const controls = cameraControlsRef.current;
      if (!controls) return;
      const requestId = ++focusRequestIdRef.current;
      const resolvedChildPath = resolveGuidedChildPath(childPath);
      const isLatestRequest = (): boolean => focusRequestIdRef.current === requestId;

      const clampY = (pos: THREE.Vector3): THREE.Vector3 => {
        if (pos.y < MIN_FOCUS_CAMERA_Y) pos.y = MIN_FOCUS_CAMERA_Y;
        return pos;
      };

      const bumpCameraAboveGroundIfNeeded = (target: { x: number; y: number; z: number }): boolean => {
        const cur = new THREE.Vector3();
        controls.getPosition(cur);
        if (cur.y < MIN_FOCUS_CAMERA_Y) {
          controls.setLookAt(cur.x, MIN_FOCUS_CAMERA_Y, cur.z, target.x, target.y, target.z, true);
          return true;
        }
        return false;
      };

      const applyRecenterOnly = (target: { x: number; y: number; z: number }) => {
        if (!bumpCameraAboveGroundIfNeeded(target)) {
          controls.setTarget(target.x, target.y, target.z, true);
        }
      };

      const applyLookAt = (cameraPosition: THREE.Vector3, target: { x: number; y: number; z: number }) => {
        clampY(cameraPosition);
        controls.setLookAt(cameraPosition.x, cameraPosition.y, cameraPosition.z, target.x, target.y, target.z, true);
      };

      const currentPos = new THREE.Vector3();
      controls.getPosition(currentPos);

      const scene = sceneRef.current;
      const resolvedFocusTarget =
        (scene &&
          calculateFocusTargetFromScene({
            scene,
            objectId: object.id,
            childPath: resolvedChildPath,
          })) ??
        (await calculateFocusTargetForObject({
          object,
          childPath: resolvedChildPath,
        }));
      if (!isLatestRequest()) return;
      const focusTargetVec = toCameraAim(resolvedFocusTarget);

      if (focusMode === 'recenterOnly') {
        applyRecenterOnly(focusTargetVec);
        return;
      }

      const applyAssistFocus = (idealCamera: { x: number; y: number; z: number; distance: number }) => {
        const latestPos = new THREE.Vector3();
        controls.getPosition(latestPos);
        const soft = calculateSoftFocus(latestPos, resolvedFocusTarget, idealCamera);

        if (soft.shouldMoveCamera && soft.newCameraPosition) {
          clampY(soft.newCameraPosition);
          controls.setLookAt(
            soft.newCameraPosition.x,
            soft.newCameraPosition.y,
            soft.newCameraPosition.z,
            focusTargetVec.x,
            focusTargetVec.y,
            focusTargetVec.z,
            true
          );
        } else if (!bumpCameraAboveGroundIfNeeded(focusTargetVec)) {
          controls.setTarget(focusTargetVec.x, focusTargetVec.y, focusTargetVec.z, true);
        }
      };

      if (!scene) {
        const ideal = calculateIdealCameraPosition(resolvedFocusTarget);
        const idealPos = clampY(new THREE.Vector3(ideal.x, ideal.y, ideal.z));
        if (focusMode === 'explicit') {
          applyLookAt(idealPos, focusTargetVec);
        } else {
          applyAssistFocus({ ...ideal, y: idealPos.y });
        }
        return;
      }

      const quick = calculateQuickFocusCamera({
        target: resolvedFocusTarget,
        scene,
        targetObjectId: object.id,
        targetChildPath: resolvedChildPath,
        currentCameraPosition: currentPos,
      });

      if (quick.shouldUseFastPath && quick.position) {
        if (!isLatestRequest()) return;
        const idealCamera = buildIdealCamera(quick.position, resolvedFocusTarget);

        if (focusMode === 'explicit') {
          applyLookAt(new THREE.Vector3(idealCamera.x, idealCamera.y, idealCamera.z), focusTargetVec);
          return;
        }

        applyAssistFocus(idealCamera);
        return;
      }

      if (focusMode === 'assist') {
        const ideal = calculateIdealCameraPosition(resolvedFocusTarget);
        applyAssistFocus(ideal);
        return;
      }

      const refinedFocusPromise = calculateOcclusionAwareFocusCameraAsync({
        target: resolvedFocusTarget,
        scene,
        targetObjectId: object.id,
        targetChildPath: resolvedChildPath,
        currentCameraPosition: currentPos,
        sampleCount: resolvedChildPath ? 6 : 8,
        azimuthBiasStrength: 0.5,
        verticalTiers: { enabled: !resolvedChildPath, sampleCountPerTier: resolvedChildPath ? 4 : 6 },
        breathingRoom: {
          enabled: !resolvedChildPath,
          mode: 'strict',
          minClearFraction: 0.82,
          distanceMultipliers: [1],
          sampleRadiusScale: 0.34,
          sampleMinRadius: 0.12,
          includeDiagonalSamples: false,
          minVisibilityWeight: 1.5,
        },
        progressive: {
          yieldEveryCandidates: 2,
          yieldAfterMs: 10,
          earlyExitClearFraction: 0.82,
        },
      });

      const timeoutResult = await Promise.race([
        refinedFocusPromise.then((result) => ({ kind: 'refined' as const, result })),
        new Promise<{ kind: 'timeout' }>((resolve) => {
          setTimeout(() => resolve({ kind: 'timeout' }), EXPLICIT_FOCUS_TIMEOUT_MS);
        }),
      ]);
      if (!isLatestRequest()) return;

      if (timeoutResult.kind === 'timeout') {
        applyAssistFocus(calculateIdealCameraPosition(resolvedFocusTarget));
        return;
      }

      const refined = timeoutResult.result;
      const clampedRefinedPosition = new THREE.Vector3(
        refined.position.x,
        Math.max(refined.position.y, MIN_FOCUS_CAMERA_Y),
        refined.position.z
      );
      const idealCamera = buildIdealCamera(clampedRefinedPosition, resolvedFocusTarget);

      applyLookAt(new THREE.Vector3(idealCamera.x, idealCamera.y, idealCamera.z), focusTargetVec);
    },
    []
  );

  return {
    cameraControlsRef,
    sceneRef,
    handleCameraControlsReady,
    handleSceneReady,
    handleFocusObject,
  };
}
