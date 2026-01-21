import { DEFAULT_TRANSFORM, pathToString, type ChildMesh } from '../../types';
import type { RotationAxis } from './types';

/**
 * Normalizes an angle to the range [-180, 180] degrees.
 * This ensures consistent display of rotation values regardless of
 * how many full rotations have occurred.
 */
export const normalizeAngle = (angle: number): number => {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
};

/**
 * Gets the transform key for a given rotation axis.
 */
export const getRotationKey = (axis: RotationAxis): 'rotationX' | 'rotationY' | 'rotationZ' => {
  const keyMap: Record<RotationAxis, 'rotationX' | 'rotationY' | 'rotationZ'> = {
    x: 'rotationX',
    y: 'rotationY',
    z: 'rotationZ',
  };
  return keyMap[axis];
};

/**
 * Checks if a child path represents a descendant of another path.
 * Uses '.' as the path separator (matching pathToString format).
 */
export const isDescendantPath = (childPath: string, parentPath: string): boolean => {
  return childPath.startsWith(parentPath + '.');
};

/**
 * Resets all children in the array to DEFAULT_TRANSFORM.
 * Returns a new array with all children reset.
 */
export const resetAllChildren = (children: ChildMesh[] | undefined): ChildMesh[] | undefined => {
  if (!children) return undefined;
  return children.map((child) => ({
    ...child,
    localTransform: { ...DEFAULT_TRANSFORM },
  }));
};

/**
 * Resets a specific child and all its descendants to DEFAULT_TRANSFORM.
 * Returns a new array with the target children reset.
 */
export const resetChildAndDescendants = (children: ChildMesh[], targetPathStr: string): ChildMesh[] => {
  return children.map((child) => {
    const childPathStr = pathToString(child.path);
    const isTarget = childPathStr === targetPathStr;
    const isDescendant = isDescendantPath(childPathStr, targetPathStr);

    if (isTarget || isDescendant) {
      return {
        ...child,
        localTransform: { ...DEFAULT_TRANSFORM },
      };
    }
    return child;
  });
};

