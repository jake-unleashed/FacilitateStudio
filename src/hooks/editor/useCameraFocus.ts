import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import { calculateIdealCameraPosition, calculateSoftFocus } from '../../utils/focusUtils';
import { calculateFocusTargetForObject } from '../../utils/focusTargetCalculator';
import {
  calculateOcclusionAwareFocusCamera,
  calculateQuickFocusCamera,
  MIN_FOCUS_CAMERA_Y,
} from '../../utils/focusCameraOcclusion';
import type { FocusMode, SceneObject } from '../../types';

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
  const [, setControlsReady] = useState(false);

  const handleCameraControlsReady = useCallback((controls: CameraControlsImpl) => {
    cameraControlsRef.current = controls;
    setControlsReady(true);
  }, []);

  const handleSceneReady = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene;
  }, []);

  const handleFocusObject = useCallback(
    async (object: SceneObject, childPath?: string, focusMode: FocusMode = 'full') => {
      const controls = cameraControlsRef.current;
      if (!controls) return;
      const guidedPhase =
        typeof document !== 'undefined' ? document.body.dataset.guidedPhase : undefined;
      const resolvedChildPath =
        guidedPhase === 'model-positioning' && childPath ? undefined : childPath;

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

      const currentPos = new THREE.Vector3();
      controls.getPosition(currentPos);

      const focusTarget = await calculateFocusTargetForObject({
        object,
        childPath: resolvedChildPath,
      });
      const focusTargetVec = { x: focusTarget.targetX, y: focusTarget.targetY, z: focusTarget.targetZ };

      const scene = sceneRef.current;
      if (!scene) {
        const ideal = calculateIdealCameraPosition(focusTarget);
        const idealPos = clampY(new THREE.Vector3(ideal.x, ideal.y, ideal.z));
        if (focusMode === 'full') {
          controls.setLookAt(
            idealPos.x,
            idealPos.y,
            idealPos.z,
            focusTargetVec.x,
            focusTargetVec.y,
            focusTargetVec.z,
            true
          );
        } else {
          const cur = new THREE.Vector3();
          controls.getPosition(cur);
          const soft = calculateSoftFocus(cur, focusTarget, { ...ideal, y: idealPos.y });
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
        }
        return;
      }

      const quick = calculateQuickFocusCamera({
        target: focusTarget,
        scene,
        targetObjectId: object.id,
        targetChildPath: childPath,
        currentCameraPosition: currentPos,
      });

      if (quick.shouldUseFastPath && quick.position) {
        clampY(quick.position);
        const idealCamera = {
          x: quick.position.x,
          y: quick.position.y,
          z: quick.position.z,
          distance: quick.position.distanceTo(
            new THREE.Vector3(focusTarget.targetX, focusTarget.targetY, focusTarget.targetZ)
          ),
        };

        if (focusMode === 'full') {
          controls.setLookAt(
            idealCamera.x,
            idealCamera.y,
            idealCamera.z,
            focusTargetVec.x,
            focusTargetVec.y,
            focusTargetVec.z,
            true
          );
          return;
        }

        const latestPos = new THREE.Vector3();
        controls.getPosition(latestPos);
        const soft = calculateSoftFocus(latestPos, focusTarget, idealCamera);

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

        return;
      }

      const refined = calculateOcclusionAwareFocusCamera({
        target: focusTarget,
        scene,
        targetObjectId: object.id,
        targetChildPath: childPath,
        currentCameraPosition: currentPos,
        sampleCount: 8,
        azimuthBiasStrength: 0.6,
        verticalTiers: { enabled: true, sampleCountPerTier: 6 },
        breathingRoom: {
          enabled: true,
          mode: 'strict',
          minClearFraction: 0.8,
          distanceMultipliers: [1],
          sampleRadiusScale: 0.34,
          sampleMinRadius: 0.12,
          includeDiagonalSamples: false,
          minVisibilityWeight: 1.5,
        },
      });

      const idealCamera = {
        x: refined.position.x,
        y: Math.max(refined.position.y, MIN_FOCUS_CAMERA_Y),
        z: refined.position.z,
        distance: refined.position.distanceTo(
          new THREE.Vector3(focusTarget.targetX, focusTarget.targetY, focusTarget.targetZ)
        ),
      };

      if (focusMode === 'full') {
        controls.setLookAt(
          idealCamera.x,
          idealCamera.y,
          idealCamera.z,
          focusTargetVec.x,
          focusTargetVec.y,
          focusTargetVec.z,
          true
        );
        return;
      }

      const latestPos = new THREE.Vector3();
      controls.getPosition(latestPos);
      const soft = calculateSoftFocus(latestPos, focusTarget, idealCamera);

      if (refined.wasOccluded) {
        controls.setLookAt(
          idealCamera.x,
          idealCamera.y,
          idealCamera.z,
          focusTargetVec.x,
          focusTargetVec.y,
          focusTargetVec.z,
          true
        );
        return;
      }

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
