import * as THREE from 'three';

interface MeshUserData {
  childPath?: unknown;
  sceneObjectId?: unknown;
}

function getMeshUserData(object: THREE.Object3D): MeshUserData | null {
  const userData = object.userData;
  if (!userData || typeof userData !== 'object') return null;
  return userData as MeshUserData;
}

export function getChildPathFromObject(object: THREE.Object3D): string | null {
  const childPath = getMeshUserData(object)?.childPath;
  return typeof childPath === 'string' ? childPath : null;
}

export function getSceneObjectIdFromObject(object: THREE.Object3D): string | null {
  const sceneObjectId = getMeshUserData(object)?.sceneObjectId;
  return typeof sceneObjectId === 'string' ? sceneObjectId : null;
}

export function stopNativeImmediatePropagation(event: Event): void {
  const maybeStop = event as Event & { stopImmediatePropagation?: () => void };
  maybeStop.stopImmediatePropagation?.();
}
