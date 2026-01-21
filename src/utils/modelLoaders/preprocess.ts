import type { PreprocessedModel } from '../modelPreprocessing';
import { preprocessModel } from '../modelPreprocessing';
import { optimizeMaterialsForScene } from '../materialOptimization';
import { MODEL_TARGET_SIZE } from '../../constants';

import { IS_DEV } from './env';
import { analyzeModelTextures } from './textureDiagnostics';
import type { ModelFileType } from './types';
import { loadModelFromArrayBuffer } from './loadFromArrayBuffer';
import { loadModelFromBase64 } from './loadFromBase64';

/**
 * Load and preprocess model from base64 string.
 * This is the recommended function to use for adding models to the scene.
 */
export async function loadAndPreprocessModel(
  base64: string,
  fileType: ModelFileType,
  targetSize: number = MODEL_TARGET_SIZE
): Promise<PreprocessedModel> {
  const rawModel = await loadModelFromBase64(base64, fileType);

  if (IS_DEV) {
    analyzeModelTextures(rawModel, `Uploaded ${fileType.toUpperCase()}`);
  }

  optimizeMaterialsForScene(rawModel);
  return preprocessModel(rawModel, targetSize);
}

/**
 * Load and preprocess model directly from ArrayBuffer.
 * Preferred method - avoids base64 overhead.
 */
export async function loadAndPreprocessModelFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileType: ModelFileType,
  targetSize: number = MODEL_TARGET_SIZE
): Promise<PreprocessedModel> {
  const rawModel = await loadModelFromArrayBuffer(arrayBuffer, fileType);

  if (IS_DEV) {
    analyzeModelTextures(rawModel, `Uploaded ${fileType.toUpperCase()}`);
  }

  optimizeMaterialsForScene(rawModel);
  return preprocessModel(rawModel, targetSize);
}

