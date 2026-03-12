import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import type { SceneObject } from '../../../types';
import { INTERNAL_TO_WORLD } from '../../../constants';
import { findChildByPath } from '../../../utils/modelLoaders';
import { calculateLowestPointOffset } from '../../../utils/groundHeight';

import type { ViewMode } from './types';
import { HANDLE_GAP_PIXELS, HANDLE_SPACING_PIXELS, POSITION_LERP_FACTOR, SOURCE_SMOOTHING_FACTOR } from './constants';
import {
  calculatePixelsPerWorldUnit,
  calculateVisibleBounds,
  calculateWeightedCenter,
  findChildDataByPath,
  findModelInGroup,
  findObjectGroupInScene,
  getViewMode,
  pixelsToWorldUnits,
} from './utils';

export function useTransformGizmoFrame(args: {
  object: SceneObject;
  selectedChildPath: string | null;
  isDragging: boolean;
}): {
  heightHandlePosition: [number, number, number];
  xzHandlePosition: [number, number, number];
  currentHeight: number;
  scaleFactor: number;
  childMesh: THREE.Object3D | null;
  minWorldY: number;
  viewMode: ViewMode;
  cameraRightState: THREE.Vector3;
  selectedChild: ReturnType<typeof findChildDataByPath> | null;
  heightWorldPositionRef: React.MutableRefObject<THREE.Vector3>;
  objectWorldPositionRef: React.MutableRefObject<THREE.Vector3>;
  isAnyHandleDragging: boolean;
  setIsAnyHandleDragging: (v: boolean) => void;
} {
  const { camera, gl, scene } = useThree();
  const { object, selectedChildPath, isDragging } = args;

  const [heightHandlePosition, setHeightHandlePosition] = useState<[number, number, number]>([0, 0, 0]);
  const [xzHandlePosition, setXZHandlePosition] = useState<[number, number, number]>([0, 0, 0]);
  const [currentHeight, setCurrentHeight] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [childMesh, setChildMesh] = useState<THREE.Object3D | null>(null);
  const [minWorldY, setMinWorldY] = useState(0);
  const [isAnyHandleDragging, setIsAnyHandleDragging] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('isometric');
  const viewModeRef = useRef<ViewMode>('isometric');

  const [cameraRightState, setCameraRightState] = useState(new THREE.Vector3(1, 0, 0));

  const heightPositionRef = useRef(new THREE.Vector3());
  const xzPositionRef = useRef(new THREE.Vector3());
  const objectWorldPositionRef = useRef(new THREE.Vector3());
  const lastHeightPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastXZPosRef = useRef<[number, number, number]>([0, 0, 0]);

  const boxRef = useRef(new THREE.Box3());
  const centerRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3());
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const boxSizeRef = useRef(new THREE.Vector3());
  const heightTargetRef = useRef(new THREE.Vector3());
  const xzTargetRef = useRef(new THREE.Vector3());
  const smoothedCenterRef = useRef(new THREE.Vector3());
  const smoothedOffsetDistanceRef = useRef(0);
  const tempPositionRef = useRef(new THREE.Vector3());
  const positionsInitializedRef = useRef(false);
  const cachedObjectGroupRef = useRef<THREE.Object3D | null>(null);
  const cachedObjectIdRef = useRef<string | null>(null);

  const selectedChild = selectedChildPath ? findChildDataByPath(object.children, selectedChildPath) : null;

  useFrame((_, delta) => {
    const isBeingDragged = isAnyHandleDragging || isDragging;
    const effectiveSourceFactor = isBeingDragged ? 1.0 : 1 - Math.pow(1 - SOURCE_SMOOTHING_FACTOR, delta * 60);
    const effectivePositionFactor = isBeingDragged ? 1.0 : 1 - Math.pow(1 - POSITION_LERP_FACTOR, delta * 60);

    if (cachedObjectIdRef.current !== object.id) {
      cachedObjectIdRef.current = object.id;
      cachedObjectGroupRef.current = null;
    }

    let objectGroup = cachedObjectGroupRef.current;
    if (
      !objectGroup ||
      objectGroup.userData?.objectId !== object.id ||
      (objectGroup.parent === null && objectGroup !== scene)
    ) {
      objectGroup = findObjectGroupInScene(scene, object.id);
      cachedObjectGroupRef.current = objectGroup;
    }

    if (!objectGroup) {
      const centerX = object.transform.x / INTERNAL_TO_WORLD;
      const targetHeightY = object.transform.y / INTERNAL_TO_WORLD + 0.5;
      const centerZ = -object.transform.z / INTERNAL_TO_WORLD;

      camera.getWorldDirection(cameraDirectionRef.current);
      cameraRightRef.current.crossVectors(cameraDirectionRef.current, new THREE.Vector3(0, 1, 0));
      cameraRightRef.current.normalize();

      const newViewMode = getViewMode(camera, viewModeRef.current, cameraDirectionRef.current);
      if (newViewMode !== viewModeRef.current) {
        viewModeRef.current = newViewMode;
        setViewMode(newViewMode);
      }

      if (cameraRightRef.current.distanceToSquared(cameraRightState) > 0.0001) {
        setCameraRightState(cameraRightRef.current.clone());
      }

      const rect = gl.domElement.getBoundingClientRect();
      const fallbackPos = tempPositionRef.current.set(centerX, targetHeightY, centerZ);
      const pixelsPerWorldUnit = calculatePixelsPerWorldUnit(camera, fallbackPos, rect.height);
      const dynamicHandleOffset = pixelsToWorldUnits(HANDLE_SPACING_PIXELS, pixelsPerWorldUnit);
      const dynamicGap = pixelsToWorldUnits(HANDLE_GAP_PIXELS, pixelsPerWorldUnit);

      const fallbackOffset = 0.5 + dynamicGap;
      const targetX = centerX + cameraRightRef.current.x * fallbackOffset;
      const targetZ = centerZ + cameraRightRef.current.z * fallbackOffset;
      const targetXzY = targetHeightY - dynamicHandleOffset;

      heightTargetRef.current.set(targetX, targetHeightY, targetZ);
      xzTargetRef.current.set(targetX, targetXzY, targetZ);

      if (!positionsInitializedRef.current) {
        heightPositionRef.current.copy(heightTargetRef.current);
        xzPositionRef.current.copy(xzTargetRef.current);
        positionsInitializedRef.current = true;
      } else {
        heightPositionRef.current.lerp(heightTargetRef.current, effectivePositionFactor);
        xzPositionRef.current.lerp(xzTargetRef.current, effectivePositionFactor);
      }

      setHeightHandlePosition([heightPositionRef.current.x, heightPositionRef.current.y, heightPositionRef.current.z]);
      setXZHandlePosition([xzPositionRef.current.x, xzPositionRef.current.y, xzPositionRef.current.z]);
      setCurrentHeight(object.transform.y);
      setScaleFactor(1);
      setChildMesh(null);

      const modelHeight = (object.properties.modelHeight as number) || 2.0;
      const fallbackLowestOffset = calculateLowestPointOffset(
        object.transform.rotationX,
        object.transform.rotationY,
        object.transform.rotationZ,
        object.transform.scaleX,
        object.transform.scaleY,
        object.transform.scaleZ,
        modelHeight
      );
      const fallbackMinWorldY = object.transform.y / INTERNAL_TO_WORLD + fallbackLowestOffset;
      setMinWorldY(fallbackMinWorldY);
      return;
    }

    objectGroup.updateWorldMatrix(true, true);

    let targetObject: THREE.Object3D = objectGroup;
    let heightValue = object.transform.y;
    let currentScaleFactor = 1;
    let foundChildMesh: THREE.Object3D | null = null;

    if (selectedChildPath && selectedChild) {
      const model = findModelInGroup(objectGroup);
      if (model) {
        const pathArray = selectedChildPath.split('.');
        const meshFound = findChildByPath(model, pathArray);
        if (meshFound) {
          targetObject = meshFound;
          foundChildMesh = meshFound;
        }
      }

      if (foundChildMesh) {
        const worldPos = new THREE.Vector3();
        foundChildMesh.getWorldPosition(worldPos);
        heightValue = worldPos.y * INTERNAL_TO_WORLD;
      } else {
        heightValue = selectedChild.localTransform.y;
      }

      currentScaleFactor = object.transform.scaleY;
    }

    const box = calculateVisibleBounds(targetObject);
    boxRef.current.copy(box);

    if (!box.isEmpty()) {
      const rawCenter = calculateWeightedCenter(targetObject);
      centerRef.current.copy(rawCenter);

      box.getSize(boxSizeRef.current);
      const rawHalfExtent = Math.max(boxSizeRef.current.x, boxSizeRef.current.z) / 2;

      if (!positionsInitializedRef.current) {
        smoothedCenterRef.current.copy(rawCenter);
        smoothedOffsetDistanceRef.current = rawHalfExtent;
      } else {
        smoothedCenterRef.current.lerp(rawCenter, effectiveSourceFactor);
        smoothedOffsetDistanceRef.current += (rawHalfExtent - smoothedOffsetDistanceRef.current) * effectiveSourceFactor;
      }

      const center = smoothedCenterRef.current;
      const smoothedHalfExtent = smoothedOffsetDistanceRef.current;
      objectWorldPositionRef.current.copy(center);

      camera.getWorldDirection(cameraDirectionRef.current);
      cameraRightRef.current.crossVectors(cameraDirectionRef.current, new THREE.Vector3(0, 1, 0));
      cameraRightRef.current.normalize();

      const newViewMode = getViewMode(camera, viewModeRef.current, cameraDirectionRef.current);
      if (newViewMode !== viewModeRef.current) {
        viewModeRef.current = newViewMode;
        setViewMode(newViewMode);
      }

      if (cameraRightRef.current.distanceToSquared(cameraRightState) > 0.0001) {
        setCameraRightState(cameraRightRef.current.clone());
      }

      const rect = gl.domElement.getBoundingClientRect();
      const pixelsPerWorldUnit = calculatePixelsPerWorldUnit(camera, center, rect.height);
      const dynamicHandleOffset = pixelsToWorldUnits(HANDLE_SPACING_PIXELS, pixelsPerWorldUnit);
      const dynamicGap = pixelsToWorldUnits(HANDLE_GAP_PIXELS, pixelsPerWorldUnit);

      const offsetDistance = smoothedHalfExtent + dynamicGap;
      const targetHeightY = center.y;
      const targetXzY = center.y - dynamicHandleOffset;

      heightTargetRef.current.set(
        center.x + cameraRightRef.current.x * offsetDistance,
        targetHeightY,
        center.z + cameraRightRef.current.z * offsetDistance
      );
      xzTargetRef.current.set(
        center.x + cameraRightRef.current.x * offsetDistance,
        targetXzY,
        center.z + cameraRightRef.current.z * offsetDistance
      );

      if (!positionsInitializedRef.current) {
        heightPositionRef.current.copy(heightTargetRef.current);
        xzPositionRef.current.copy(xzTargetRef.current);
        positionsInitializedRef.current = true;
      } else {
        heightPositionRef.current.lerp(heightTargetRef.current, effectivePositionFactor);
        xzPositionRef.current.lerp(xzTargetRef.current, effectivePositionFactor);
      }

      const heightPos: [number, number, number] = [
        heightPositionRef.current.x,
        heightPositionRef.current.y,
        heightPositionRef.current.z,
      ];
      const xzPos: [number, number, number] = [xzPositionRef.current.x, xzPositionRef.current.y, xzPositionRef.current.z];

      if (
        Math.abs(heightPos[0] - lastHeightPosRef.current[0]) > 0.0001 ||
        Math.abs(heightPos[1] - lastHeightPosRef.current[1]) > 0.0001 ||
        Math.abs(heightPos[2] - lastHeightPosRef.current[2]) > 0.0001
      ) {
        lastHeightPosRef.current = heightPos;
        setHeightHandlePosition(heightPos);
      }

      if (
        Math.abs(xzPos[0] - lastXZPosRef.current[0]) > 0.0001 ||
        Math.abs(xzPos[1] - lastXZPosRef.current[1]) > 0.0001 ||
        Math.abs(xzPos[2] - lastXZPosRef.current[2]) > 0.0001
      ) {
        lastXZPosRef.current = xzPos;
        setXZHandlePosition(xzPos);
      }
    }

    if (currentHeight !== heightValue) setCurrentHeight(heightValue);
    if (scaleFactor !== currentScaleFactor) setScaleFactor(currentScaleFactor);
    if (childMesh !== foundChildMesh) setChildMesh(foundChildMesh);

    const actualMinWorldY = box.min.y;
    if (minWorldY !== actualMinWorldY) {
      setMinWorldY(actualMinWorldY);
    }
  });

  return {
    heightHandlePosition,
    xzHandlePosition,
    currentHeight,
    scaleFactor,
    childMesh,
    minWorldY,
    viewMode,
    cameraRightState,
    selectedChild,
    heightWorldPositionRef: heightPositionRef,
    objectWorldPositionRef,
    isAnyHandleDragging,
    setIsAnyHandleDragging,
  };
}

