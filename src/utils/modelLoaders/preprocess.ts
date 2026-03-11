import type { PreprocessedModel } from '../modelPreprocessing';
import { preprocessModel } from '../modelPreprocessing';
import { optimizeMaterialsForScene } from '../materialOptimization';
import { MODEL_TARGET_SIZE } from '../../constants';
import { createImportDiagnostics } from '../importDiagnostics';

import { IS_DEV } from './env';
import { analyzeModelTextures } from './textureDiagnostics';
import type { ModelFileType } from './types';
import { loadModelFromArrayBuffer } from './loadFromArrayBuffer';
import { loadModelFromBase64 } from './loadFromBase64';
import type { AssetTextureMap } from '../modelAssetStore';

function captureTextureDiagnostics(rawModel: Awaited<ReturnType<typeof loadModelFromBase64>>, fileType: ModelFileType) {
  const importDiagnostics = createImportDiagnostics(fileType);
  const textureReport = analyzeModelTextures(rawModel, `Uploaded ${fileType.toUpperCase()}`);

  if (textureReport.issues.some((issue) => issue.includes('no image data'))) {
    importDiagnostics.missingTextureDataCount = textureReport.issues.filter((issue) =>
      issue.includes('no image data')
    ).length;
    // Do not surface this directly to end users.
    // Some loaders attach texture objects before their image data has finished resolving,
    // so checking immediately after parse can produce noisy false positives.
  }

  return importDiagnostics;
}

function finalizeImportedModel(
  rawModel: Awaited<ReturnType<typeof loadModelFromBase64>>,
  fileType: ModelFileType,
  targetSize: number
): PreprocessedModel {
  const importDiagnostics = captureTextureDiagnostics(rawModel, fileType);
  const optimizationResult = optimizeMaterialsForScene(rawModel, {
    fileType,
    diagnostics: importDiagnostics,
  });

  if (IS_DEV && optimizationResult.suspiciousMaterials > 0) {
    console.log(
      '[modelLoaders] Suspicious materials detected:',
      optimizationResult.suspiciousMaterials
    );
  }

  return preprocessModel(rawModel, targetSize, importDiagnostics);
}

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
  return finalizeImportedModel(rawModel, fileType, targetSize);
}

/**
 * Load and preprocess model directly from ArrayBuffer.
 * Preferred method - avoids base64 overhead.
 */
export async function loadAndPreprocessModelFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileType: ModelFileType,
  targetSize: number = MODEL_TARGET_SIZE,
  textures?: AssetTextureMap
): Promise<PreprocessedModel> {
  const rawModel = await loadModelFromArrayBuffer(arrayBuffer, fileType, textures);
  return finalizeImportedModel(rawModel, fileType, targetSize);
}
