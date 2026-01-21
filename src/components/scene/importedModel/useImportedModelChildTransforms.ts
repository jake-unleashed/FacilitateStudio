import { useEffect } from 'react';
import * as THREE from 'three';

import type { ChildMesh } from '../../../types';
import { pathToString } from '../../../types';
import { calculateRotationOffset, calculateScaleOffset, computeMeshPivots } from './transformUtils';

export function useImportedModelChildTransforms({
  model,
  children,
  childPathToMesh,
}: {
  model: THREE.Group | null;
  children?: ChildMesh[];
  childPathToMesh: Map<string, { mesh: THREE.Object3D; childInfo: ChildMesh }>;
}): void {
  useEffect(() => {
    if (!model || !children) return;

    for (const child of children) {
      const pathStr = pathToString(child.path);
      const entry = childPathToMesh.get(pathStr);
      if (!entry) continue;

      const mesh = entry.mesh as THREE.Object3D;
      const lt = entry.childInfo.localTransform;

      const userOffset = new THREE.Vector3(lt.x / 100, lt.y / 100, -lt.z / 100);

      const { localCenter, localBase } = computeMeshPivots(mesh);

      const rotationEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(lt.rotationX),
        THREE.MathUtils.degToRad(lt.rotationY),
        THREE.MathUtils.degToRad(lt.rotationZ),
        'XYZ'
      );

      const rotationOffset = calculateRotationOffset(localCenter, rotationEuler);
      const scaleOffset = calculateScaleOffset(localBase, {
        x: lt.scaleX,
        y: lt.scaleY,
        z: lt.scaleZ,
      });

      mesh.position.set(
        userOffset.x + rotationOffset.x + scaleOffset.x,
        userOffset.y + rotationOffset.y + scaleOffset.y,
        userOffset.z + rotationOffset.z + scaleOffset.z
      );

      mesh.rotation.copy(rotationEuler);
      mesh.scale.set(lt.scaleX, lt.scaleY, lt.scaleZ);
    }
  }, [model, children, childPathToMesh]);
}

