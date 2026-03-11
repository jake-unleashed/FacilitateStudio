import * as THREE from 'three';

import { MODEL_TARGET_SIZE } from '../../constants';
import { IS_DEV } from './env';
import type { PreprocessedModel } from './types';

import { validateModel } from './validate';
import { autoScaleModel } from './scale';
import { alignModelToGround } from './ground';
import { disableModelAnimations } from './animations';
import { calculateModelMetrics } from './metrics';
import { repairModelNormals } from './normals';
import type { ImportDiagnostics } from '../../types/model';

/**
 * Main preprocessing pipeline
 * Applies all normalization steps in the correct order
 */
export function preprocessModel(
  model: THREE.Group,
  targetSize: number = MODEL_TARGET_SIZE,
  importDiagnostics: ImportDiagnostics
): PreprocessedModel {
  if (IS_DEV) {
    console.group('[modelPreprocessing] ========== PREPROCESSING PIPELINE START ==========');
    console.log('Target size:', targetSize);
  }

  const validation = validateModel(model);
  if (!validation.valid) {
    if (IS_DEV) console.groupEnd();
    throw new Error(`Invalid model: ${validation.error}`);
  }

  const processedModel = model.clone();
  if (IS_DEV) console.log('Model cloned successfully');

  // NOTE: We intentionally skip centerModelPivot() here.
  // The previous implementation had a coordinate space bug where world-space center
  // was subtracted from local-space vertex positions, which corrupts models with
  // non-identity transforms in their hierarchy (very common with FBX models).
  // The ImportedModel component handles pivot centering at render time instead.

  if (IS_DEV) console.log('--- Step 1: Auto-scale ---');
  const originalScale = autoScaleModel(processedModel, targetSize);

  if (IS_DEV) console.log('--- Step 2: Align to ground ---');
  alignModelToGround(processedModel);

  if (IS_DEV) console.log('--- Step 3: Repair normals ---');
  repairModelNormals(processedModel, importDiagnostics);

  // Step 4: Normalize orientation (skip for now - can cause unexpected rotations)
  // normalizeModelOrientation(processedModel);

  disableModelAnimations(processedModel);

  if (IS_DEV) console.log('--- Step 5: Final metrics ---');
  const metrics = calculateModelMetrics(processedModel);

  if (IS_DEV) {
    console.log('[modelPreprocessing] FINAL STATE:', {
      boundingBox: {
        min: `(${metrics.boundingBox.min.x.toFixed(2)}, ${metrics.boundingBox.min.y.toFixed(2)}, ${metrics.boundingBox.min.z.toFixed(2)})`,
        max: `(${metrics.boundingBox.max.x.toFixed(2)}, ${metrics.boundingBox.max.y.toFixed(2)}, ${metrics.boundingBox.max.z.toFixed(2)})`,
      },
      size: `(${metrics.size.x.toFixed(2)}, ${metrics.size.y.toFixed(2)}, ${metrics.size.z.toFixed(2)})`,
      maxDimension: metrics.maxDimension.toFixed(2),
      scaleApplied: originalScale.toFixed(8),
      rootScale: `(${processedModel.scale.x.toFixed(8)}, ${processedModel.scale.y.toFixed(8)}, ${processedModel.scale.z.toFixed(8)})`,
    });
    console.log('[modelPreprocessing] ========== PREPROCESSING PIPELINE END ==========');
    console.groupEnd();
  }

  return {
    model: processedModel,
    metrics,
    originalScale,
    importDiagnostics,
  };
}
