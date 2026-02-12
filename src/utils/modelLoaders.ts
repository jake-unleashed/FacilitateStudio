/**
 * Model Loaders Utility (facade)
 *
 * Kept as a stable public API while implementation is split across `src/utils/modelLoaders/*`.
 */

export type { ModelFileType } from './modelLoaders/types';
export type { PreprocessedModel } from './modelPreprocessing';

export { analyzeModelTextures, type TextureReport } from './modelLoaders/textureDiagnostics';

export { loadModelFromBase64 } from './modelLoaders/loadFromBase64';
export { loadModelFromArrayBuffer } from './modelLoaders/loadFromArrayBuffer';
export { loadModelFromUrl } from './modelLoaders/loadFromUrl';
export { loadAndPreprocessModel, loadAndPreprocessModelFromArrayBuffer } from './modelLoaders/preprocess';

export { getLoaderForFileType } from './modelLoaders/loaderFactory';
export { getModelBoundingBox, centerModelAtOrigin, scaleModelToFit } from './modelLoaders/transforms';

export { extractChildMeshes, findChildByPath, type ExtractedChildInfo } from './modelLoaders/childMeshes';
