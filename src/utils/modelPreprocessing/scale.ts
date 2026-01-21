import * as THREE from 'three';

import { MODEL_TARGET_SIZE } from '../../constants';
import { IS_DEV } from './env';
import { logModelHierarchy } from './debug';
import { removeHelperObjects } from './cleanup';
import { bakeTransformsIntoGeometry } from './bake';
import { getModelBoundingBox } from './metrics';

/**
 * Auto-scale model to target size.
 *
 * This function ensures consistent normalization by:
 * 1. Baking all transforms into geometry to eliminate nested scale issues
 * 2. Computing the world-space bounding box
 * 3. Scaling geometry vertices directly to achieve target size
 *
 * @returns The scale factor applied to normalize the model
 */
export function autoScaleModel(model: THREE.Group, targetSize: number = MODEL_TARGET_SIZE): number {
  model.updateMatrixWorld(true);

  logModelHierarchy(model, 'BEFORE auto-scale');

  const removedCount = removeHelperObjects(model);
  if (IS_DEV && removedCount > 0) {
    console.log(`[modelPreprocessing] Removed ${removedCount} helper objects`);
  }

  if (IS_DEV) console.log('[modelPreprocessing] Baking transforms into geometry...');
  bakeTransformsIntoGeometry(model);

  const box = getModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const rawMaxDimension = Math.max(size.x, size.y, size.z);

  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  const largest = dims[0];
  const secondLargest = dims[1];

  let effectiveMaxDimension: number;
  if (largest > secondLargest * 2.5 && secondLargest > 0) {
    effectiveMaxDimension = secondLargest * 1.5;
    if (IS_DEV) {
      console.log('[modelPreprocessing] Aspect ratio cap applied for scaling:', {
        largest: largest.toFixed(2),
        secondLargest: secondLargest.toFixed(2),
        capped: effectiveMaxDimension.toFixed(2),
      });
    }
  } else {
    effectiveMaxDimension = rawMaxDimension;
  }

  if (IS_DEV) {
    console.log('[modelPreprocessing] World-space bounds (after baking):', {
      min: `(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)})`,
      max: `(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`,
      size: `(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`,
      center: `(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
      rawMaxDimension: rawMaxDimension.toFixed(2),
      effectiveMaxDimension: effectiveMaxDimension.toFixed(2),
    });
  }

  if (effectiveMaxDimension <= 0 || !isFinite(effectiveMaxDimension)) {
    if (IS_DEV) {
      console.warn('[modelPreprocessing] Invalid effective dimension for scaling:', effectiveMaxDimension);
    }
    return 1;
  }

  const scaleFactor = targetSize / effectiveMaxDimension;

  if (IS_DEV) {
    console.log('[modelPreprocessing] Scale computation:', {
      targetSize,
      effectiveMaxDimension: effectiveMaxDimension.toFixed(4),
      scaleFactor: scaleFactor.toFixed(8),
    });
  }

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positionAttribute = geometry.attributes.position;

      if (positionAttribute) {
        for (let i = 0; i < positionAttribute.count; i++) {
          positionAttribute.setX(i, positionAttribute.getX(i) * scaleFactor);
          positionAttribute.setY(i, positionAttribute.getY(i) * scaleFactor);
          positionAttribute.setZ(i, positionAttribute.getZ(i) * scaleFactor);
        }
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }
    }
  });

  const verifyBox = getModelBoundingBox(model);
  const verifySize = new THREE.Vector3();
  verifyBox.getSize(verifySize);

  const actualMaxDimension = Math.max(verifySize.x, verifySize.y, verifySize.z);
  if (IS_DEV) {
    console.log('[modelPreprocessing] AFTER scaling - verification:', {
      newSize: `(${verifySize.x.toFixed(2)}, ${verifySize.y.toFixed(2)}, ${verifySize.z.toFixed(2)})`,
      newMaxDimension: actualMaxDimension.toFixed(2),
      expectedMaxDimension: targetSize.toFixed(2),
      match: Math.abs(actualMaxDimension - targetSize) < 0.01 ? 'OK' : 'MISMATCH',
    });
  }

  logModelHierarchy(model, 'AFTER auto-scale');

  return scaleFactor;
}

