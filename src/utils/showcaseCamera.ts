import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import type { SceneObject } from '../types';
import { calculateFocusTargetForObject } from './focusTargetCalculator';
import { CAMERA_HEIGHT_FACTOR, MIN_CAMERA_DISTANCE, calculateIdealCameraPosition, type FocusTarget } from './focusUtils';
import { unionBoundingSpheres } from './previewCameraCalculator';

const SHOWCASE_RADIUS_PADDING = 1.1;
const SHOWCASE_MAX_DISTANCE = 20;

function toBoundingSphere(target: FocusTarget): { center: THREE.Vector3; radius: number } {
  return {
    center: new THREE.Vector3(target.targetX, target.targetY, target.targetZ),
    radius: Math.max(0, target.boundsSize * 0.5 * SHOWCASE_RADIUS_PADDING),
  };
}

function clampDistance(distance: number): number {
  return Math.max(MIN_CAMERA_DISTANCE, Math.min(SHOWCASE_MAX_DISTANCE, distance));
}

function positionFromTarget(target: FocusTarget, distance: number): THREE.Vector3 {
  return new THREE.Vector3(
    target.targetX + Math.cos(Math.PI / 4) * distance,
    target.targetY + distance * CAMERA_HEIGHT_FACTOR,
    target.targetZ + Math.sin(Math.PI / 4) * distance
  );
}

export function getShowcaseObjects(objects: SceneObject[]): SceneObject[] {
  return objects.filter((object) => typeof object.properties.modelAssetId === 'string');
}

/**
 * Frames one or more showcase models with a single intentional camera move.
 * Single-object scenes reuse the standard focus heuristics; multi-object scenes
 * use a union sphere for a broader opening view.
 */
export async function frameShowcaseObjects(
  controls: CameraControlsImpl,
  objects: SceneObject[]
): Promise<void> {
  const showcaseObjects = getShowcaseObjects(objects);
  if (showcaseObjects.length === 0) {
    return;
  }

  if (showcaseObjects.length === 1) {
    const focusTarget = await calculateFocusTargetForObject({ object: showcaseObjects[0] });
    const ideal = calculateIdealCameraPosition(focusTarget);
    controls.setLookAt(
      ideal.x,
      ideal.y,
      ideal.z,
      focusTarget.targetX,
      focusTarget.targetY,
      focusTarget.targetZ,
      true
    );
    return;
  }

  const focusTargets: FocusTarget[] = [];
  for (const object of showcaseObjects) {
    focusTargets.push(await calculateFocusTargetForObject({ object }));
  }

  const union = focusTargets
    .map(toBoundingSphere)
    .reduce((acc, sphere) => unionBoundingSpheres(acc, sphere));

  const unionTarget: FocusTarget = {
    targetX: union.center.x,
    targetY: union.center.y,
    targetZ: union.center.z,
    boundsSize: union.radius * 2,
  };
  const ideal = calculateIdealCameraPosition(unionTarget);
  const distance = clampDistance(ideal.distance);
  const position = positionFromTarget(unionTarget, distance);

  controls.setLookAt(
    position.x,
    position.y,
    position.z,
    unionTarget.targetX,
    unionTarget.targetY,
    unionTarget.targetZ,
    true
  );
}
