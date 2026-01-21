import type { SceneObject } from '../../types';
import type { ChildMesh } from '../../types';
import type { ModelMetrics } from '../../types/model';

/**
 * Create a SceneObject from asset metadata and metrics.
 */
export function createSceneObject(
  assetId: string,
  name: string,
  position: { x: number; y: number; z: number },
  metrics: ModelMetrics,
  children?: ChildMesh[]
): SceneObject {
  // Create the initial transform
  const transform = {
    x: Math.round(position.x * 100),
    y: Math.round(position.y * 100),
    z: Math.round(position.z * 100),
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };

  return {
    id: crypto.randomUUID(),
    name,
    type: 'mesh',
    transform,
    // Store original transform for restore functionality
    originalTransform: { ...transform },
    properties: {
      visible: true,
      modelAssetId: assetId,
      // Store model dimensions for accurate ground height calculations during scale/rotation
      // This is the preprocessed model's height in world units (before any scale applied)
      modelHeight: metrics.size.y,
      // Store the base scale factor applied during preprocessing to normalize the model.
      // This is useful for debugging and potential future features like "show original size".
      // The user's scale controls (scaleX/Y/Z) multiply on top of this base scale.
      baseScale: metrics.originalScale,
    },
    children: children && children.length > 0 ? children : undefined,
  };
}

