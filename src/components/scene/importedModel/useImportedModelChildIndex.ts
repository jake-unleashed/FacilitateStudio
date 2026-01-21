import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { ChildMesh } from '../../../types';
import { pathToString } from '../../../types';
import { findChildByPath } from '../../../utils/modelLoaders';

export function useImportedModelChildIndex({
  model,
  children,
  sceneObjectId,
}: {
  model: THREE.Group | null;
  children?: ChildMesh[];
  sceneObjectId: string;
}): {
  childPathToMesh: Map<string, { mesh: THREE.Object3D; childInfo: ChildMesh }>;
  findChildPathForMesh: (clickedMesh: THREE.Object3D) => string | null;
} {
  const childPathToMesh = useMemo(() => {
    const map = new Map<string, { mesh: THREE.Object3D; childInfo: ChildMesh }>();
    if (!model || !children) return map;

    for (const child of children) {
      const pathStr = pathToString(child.path);
      const meshObj = findChildByPath(model, child.path);
      if (meshObj) {
        map.set(pathStr, { mesh: meshObj, childInfo: child });
      }
    }
    return map;
  }, [model, children]);

  useEffect(() => {
    if (!model) return;

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.userData.sceneObjectId = sceneObjectId;
        if (node.userData.childPath === undefined) {
          node.userData.childPath = null;
        }
      }
    });

    for (const [pathStr, { mesh }] of childPathToMesh.entries()) {
      mesh.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.userData.sceneObjectId = sceneObjectId;
          node.userData.childPath = pathStr;
        }
      });
    }
  }, [model, sceneObjectId, childPathToMesh]);

  const findChildPathForMesh = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      if (!model || !children || children.length === 0) return null;

      const matches: { pathStr: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        if (mesh === clickedMesh) {
          matches.push({ pathStr, depth: pathStr.split('.').length });
          continue;
        }

        let current: THREE.Object3D | null = clickedMesh;
        while (current && current !== model) {
          if (current === mesh) {
            matches.push({ pathStr, depth: pathStr.split('.').length });
            break;
          }
          current = current.parent;
        }
      }

      if (matches.length === 0) return null;
      matches.sort((a, b) => b.depth - a.depth);
      return matches[0].pathStr;
    },
    [model, children, childPathToMesh]
  );

  return { childPathToMesh, findChildPathForMesh };
}

