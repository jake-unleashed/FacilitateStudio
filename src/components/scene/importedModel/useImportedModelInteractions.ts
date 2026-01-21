import { useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import type { SceneObject } from '../../../types';
import { isWithinSubtree } from './transformUtils';

export function useImportedModelInteractions({
  model,
  obj,
  childPathToMesh,
  findChildPathForMesh,
  isSelected,
  hasChildSelected,
  selectedChildPath,
  hoveredChildPath,
  setHoveredChildPath,
  onPointerDown,
  onDoubleClick,
  onHoverEnd,
}: {
  model: THREE.Group | null;
  obj: SceneObject;
  childPathToMesh: Map<string, { mesh: THREE.Object3D }>;
  findChildPathForMesh: (clickedMesh: THREE.Object3D) => string | null;
  isSelected: boolean;
  hasChildSelected: boolean;
  selectedChildPath?: string | null;
  hoveredChildPath: string | null;
  setHoveredChildPath: React.Dispatch<React.SetStateAction<string | null>>;
  onPointerDown: (
    e: ThreeEvent<PointerEvent>,
    obj: SceneObject,
    pendingChildPath?: string | null,
    dragChildPath?: string | null
  ) => void;
  onDoubleClick: (obj: SceneObject) => void;
  onHoverEnd: () => void;
}): {
  handlePointerDown: (e: ThreeEvent<PointerEvent>) => void;
  handleDoubleClick: () => void;
  handlePointerMove: (e: ThreeEvent<PointerEvent>) => void;
  handlePointerOut: (e: ThreeEvent<PointerEvent>) => void;
} {
  const findDeeperChild = useCallback(
    (currentChildPath: string, clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      const currentDepth = currentChildPath.split('.').length;
      const deeperMatches: { pathStr: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        const pathDepth = pathStr.split('.').length;

        if (pathDepth <= currentDepth) continue;
        if (!pathStr.startsWith(currentChildPath + '.') && pathStr !== currentChildPath) continue;

        if (mesh === clickedMesh) {
          deeperMatches.push({ pathStr, depth: pathDepth });
          continue;
        }

        let current: THREE.Object3D | null = clickedMesh;
        while (current && current !== model) {
          if (current === mesh) {
            deeperMatches.push({ pathStr, depth: pathDepth });
            break;
          }
          current = current.parent;
        }
      }

      if (deeperMatches.length === 0) return null;
      deeperMatches.sort((a, b) => a.depth - b.depth);
      return deeperMatches[0].pathStr;
    },
    [model, obj.children, childPathToMesh]
  );

  const findFirstLevelChild = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

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
      matches.sort((a, b) => a.depth - b.depth);
      return matches[0].pathStr;
    },
    [model, obj.children, childPathToMesh]
  );

  const findSiblingAtSameLevel = useCallback(
    (clickedMesh: THREE.Object3D, currentSelectionPath: string): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      const currentDepth = currentSelectionPath.split('.').length;
      const currentParentPath = currentSelectionPath.split('.').slice(0, -1).join('.');
      const matchingPaths: { path: string; depth: number }[] = [];

      for (const [pathStr, { mesh }] of childPathToMesh) {
        let isMatch = false;

        if (mesh === clickedMesh) {
          isMatch = true;
        } else {
          let current = clickedMesh.parent;
          while (current && current !== model) {
            if (current === mesh) {
              isMatch = true;
              break;
            }
            current = current.parent;
          }
        }

        if (isMatch) {
          matchingPaths.push({
            path: pathStr,
            depth: pathStr.split('.').length,
          });
        }
      }

      if (matchingPaths.length === 0) return null;
      matchingPaths.sort((a, b) => a.depth - b.depth);

      const sameLevelMatch = matchingPaths.find((m) => m.depth === currentDepth);
      if (sameLevelMatch) return sameLevelMatch.path;

      if (currentParentPath) {
        const siblingMatch = matchingPaths.find(
          (m) => m.path.startsWith(currentParentPath + '.') && m.depth === currentDepth
        );
        if (siblingMatch) return siblingMatch.path;
      }

      const shallowerMatch = matchingPaths.find((m) => m.depth <= currentDepth);
      if (shallowerMatch) return shallowerMatch.path;

      return matchingPaths[0].path;
    },
    [model, obj.children, childPathToMesh]
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      const childPath = findChildPathForMesh(e.object);

      if (!isSelected) {
        onPointerDown(e, obj);
      } else if (hasChildSelected && selectedChildPath) {
        const isClickedOnSelectedSubtree =
          childPath && (childPath === selectedChildPath || childPath.startsWith(selectedChildPath + '.'));

        if (isClickedOnSelectedSubtree) {
          const deeperChild = findDeeperChild(selectedChildPath, e.object);

          if (deeperChild) {
            onPointerDown(e, obj, deeperChild, selectedChildPath);
          } else {
            onPointerDown(e, obj, null, selectedChildPath);
          }
        } else if (childPath) {
          const siblingPath = findSiblingAtSameLevel(e.object, selectedChildPath);
          onPointerDown(e, obj, siblingPath || childPath);
        } else {
          onPointerDown(e, obj);
        }
      } else if (childPath) {
        const firstLevelChild = findFirstLevelChild(e.object);
        onPointerDown(e, obj, firstLevelChild || childPath);
      } else {
        onPointerDown(e, obj);
      }
    },
    [
      onPointerDown,
      obj,
      findChildPathForMesh,
      findDeeperChild,
      findFirstLevelChild,
      findSiblingAtSameLevel,
      isSelected,
      hasChildSelected,
      selectedChildPath,
    ]
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(obj);
  }, [onDoubleClick, obj]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isSelected) {
        if (hoveredChildPath !== null) {
          setHoveredChildPath(null);
        }
        return;
      }

      if (hasChildSelected && selectedChildPath) {
        const deeperChild = findDeeperChild(selectedChildPath, e.object);
        if (deeperChild !== hoveredChildPath) {
          setHoveredChildPath(deeperChild);
        }
      } else {
        const firstLevelChild = findFirstLevelChild(e.object);
        if (firstLevelChild !== hoveredChildPath) {
          setHoveredChildPath(firstLevelChild);
        }
      }
    },
    [
      isSelected,
      hasChildSelected,
      selectedChildPath,
      hoveredChildPath,
      findDeeperChild,
      findFirstLevelChild,
      setHoveredChildPath,
    ]
  );

  const handlePointerLeave = useCallback(() => {
    if (hoveredChildPath !== null) {
      setHoveredChildPath(null);
    }
    onHoverEnd();
  }, [hoveredChildPath, onHoverEnd, setHoveredChildPath]);

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!model) {
        handlePointerLeave();
        return;
      }

      const stillHoveringThisModel = e.intersections.some((i) => isWithinSubtree(model, i.object));
      if (stillHoveringThisModel) return;

      handlePointerLeave();
    },
    [model, handlePointerLeave]
  );

  return { handlePointerDown, handleDoubleClick, handlePointerMove, handlePointerOut };
}

