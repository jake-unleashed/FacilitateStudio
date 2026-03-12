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
  getSelectablePathsForMesh: (clickedMesh: THREE.Object3D) => string[];
  getChildPathDepth: (pathStr: string) => number;
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

  const childPathMetadata = useMemo(() => {
    const metadata = new Map<string, { depth: number }>();
    if (!children) return metadata;

    for (const child of children) {
      const pathStr = pathToString(child.path);
      metadata.set(pathStr, { depth: child.path.length });
    }

    return metadata;
  }, [children]);

  const meshToSelectablePaths = useMemo(() => {
    const map = new Map<THREE.Object3D, string[]>();
    if (!model) return map;

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        map.set(node, []);
      }
    });

    for (const [pathStr, { mesh }] of childPathToMesh.entries()) {
      mesh.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const paths = map.get(node);
        if (paths) {
          paths.push(pathStr);
        } else {
          map.set(node, [pathStr]);
        }
      });
    }

    for (const paths of map.values()) {
      paths.sort(
        (a, b) => (childPathMetadata.get(a)?.depth ?? 0) - (childPathMetadata.get(b)?.depth ?? 0)
      );
    }

    return map;
  }, [model, childPathToMesh, childPathMetadata]);

  useEffect(() => {
    if (!model) return;

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.userData.sceneObjectId = sceneObjectId;
        const selectablePaths = meshToSelectablePaths.get(node);
        node.userData.childPath = selectablePaths?.[selectablePaths.length - 1] ?? null;
      }
    });
  }, [model, sceneObjectId, meshToSelectablePaths]);

  const getSelectablePathsForMesh = useCallback(
    (clickedMesh: THREE.Object3D): string[] => {
      if (!model || !children || children.length === 0) return [];

      let current: THREE.Object3D | null = clickedMesh;
      while (current && current !== model) {
        const selectablePaths = meshToSelectablePaths.get(current);
        if (selectablePaths && selectablePaths.length > 0) {
          return selectablePaths;
        }
        current = current.parent;
      }

      return [];
    },
    [model, children, meshToSelectablePaths]
  );

  const findChildPathForMesh = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      const selectablePaths = getSelectablePathsForMesh(clickedMesh);
      return selectablePaths[selectablePaths.length - 1] ?? null;
    },
    [getSelectablePathsForMesh]
  );

  const getChildPathDepth = useCallback(
    (pathStr: string): number => childPathMetadata.get(pathStr)?.depth ?? pathStr.split('.').length,
    [childPathMetadata]
  );

  return { childPathToMesh, findChildPathForMesh, getSelectablePathsForMesh, getChildPathDepth };
}

