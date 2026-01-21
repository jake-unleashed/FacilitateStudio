import type { ModelMetrics } from '../../types/model';

/**
 * Serialize THREE.js metrics to plain JSON objects.
 *
 * @param metrics - The metrics from preprocessing (may contain THREE.js Vector3/Box3)
 * @param originalScale - The scale factor applied during preprocessing to normalize the model
 */
export function serializeMetrics(
  metrics: {
    boundingBox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
    center: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
    bottomY: number;
    topY: number;
    maxDimension: number;
    triangleCount?: number;
  },
  originalScale?: number
): ModelMetrics {
  return {
    boundingBox: {
      min: {
        x: metrics.boundingBox.min.x,
        y: metrics.boundingBox.min.y,
        z: metrics.boundingBox.min.z,
      },
      max: {
        x: metrics.boundingBox.max.x,
        y: metrics.boundingBox.max.y,
        z: metrics.boundingBox.max.z,
      },
    },
    center: { x: metrics.center.x, y: metrics.center.y, z: metrics.center.z },
    size: { x: metrics.size.x, y: metrics.size.y, z: metrics.size.z },
    bottomY: metrics.bottomY,
    topY: metrics.topY,
    maxDimension: metrics.maxDimension,
    triangleCount: metrics.triangleCount,
    originalScale,
  };
}

