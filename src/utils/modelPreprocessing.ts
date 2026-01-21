/**
 * Model Preprocessing Utility (facade)
 *
 * Kept as a stable public API while implementation is split across `src/utils/modelPreprocessing/*`.
 */

export type { ModelMetrics, PreprocessedModel } from './modelPreprocessing/types';

export { getModelBoundingBox, calculateModelMetrics } from './modelPreprocessing/metrics';
export { centerModelPivot } from './modelPreprocessing/pivot';
export { autoScaleModel } from './modelPreprocessing/scale';
export { alignModelToGround } from './modelPreprocessing/ground';
export { disableModelAnimations } from './modelPreprocessing/animations';
export { validateModel } from './modelPreprocessing/validate';
export { preprocessModel } from './modelPreprocessing/preprocess';

