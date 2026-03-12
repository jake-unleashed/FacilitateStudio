import { useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import type { SceneObject } from '../../../types';
import { isWithinSubtree } from './transformUtils';

export function useImportedModelInteractions({
  model,
  obj,
  findChildPathForMesh,
  getSelectablePathsForMesh,
  getChildPathDepth,
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
  findChildPathForMesh: (clickedMesh: THREE.Object3D) => string | null;
  getSelectablePathsForMesh: (clickedMesh: THREE.Object3D) => string[];
  getChildPathDepth: (pathStr: string) => number;
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

      const currentDepth = getChildPathDepth(currentChildPath);
      return (
        getSelectablePathsForMesh(clickedMesh).find(
          (pathStr) =>
            pathStr !== currentChildPath &&
            pathStr.startsWith(currentChildPath + '.') &&
            getChildPathDepth(pathStr) > currentDepth
        ) ?? null
      );
    },
    [model, obj.children, getChildPathDepth, getSelectablePathsForMesh]
  );

  const findFirstLevelChild = useCallback(
    (clickedMesh: THREE.Object3D): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      return getSelectablePathsForMesh(clickedMesh)[0] ?? null;
    },
    [model, obj.children, getSelectablePathsForMesh]
  );

  const findSiblingAtSameLevel = useCallback(
    (clickedMesh: THREE.Object3D, currentSelectionPath: string): string | null => {
      if (!model || !obj.children || obj.children.length === 0) return null;

      const currentDepth = getChildPathDepth(currentSelectionPath);
      const matchingPaths = getSelectablePathsForMesh(clickedMesh);
      if (matchingPaths.length === 0) return null;

      const sameLevelMatch = matchingPaths.find((path) => getChildPathDepth(path) === currentDepth);
      if (sameLevelMatch) return sameLevelMatch;

      return matchingPaths[0] ?? null;
    },
    [model, obj.children, getChildPathDepth, getSelectablePathsForMesh]
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

