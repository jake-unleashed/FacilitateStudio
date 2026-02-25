import type { SceneObject, ChildMesh } from '../../types';
import type { AssetMetadata, ModelMetrics } from '../../types/model';
import type { AssetTextureMap } from '../../utils/modelAssetStore';
import { updateAssetMetadata } from '../../utils/modelAssetStore';
import { loadAndPreprocessModelFromArrayBuffer, extractChildMeshes } from '../../utils/modelLoaders';
import { cachePreprocessedModel } from '../../utils/modelCache';
import { calculateOptimalPosition, generateUniqueName } from './positioning';
import { createSceneObject } from './sceneObject';
import { serializeMetrics } from './metrics';

export interface ProcessModelBufferInput {
  assetId: string;
  assetName: string;
  fileType: AssetMetadata['fileType'];
  arrayBuffer: ArrayBuffer;
  textures?: AssetTextureMap;
  existingObjects: SceneObject[];
  persistMetadata?: boolean;
}

export interface ProcessModelBufferResult {
  metrics: ModelMetrics;
  children: ChildMesh[];
  sceneObject: SceneObject;
}

/**
 * Process model binary data, cache metrics, and create a scene object.
 */
export async function processModelBuffer(
  input: ProcessModelBufferInput
): Promise<ProcessModelBufferResult> {
  const preprocessed = await loadAndPreprocessModelFromArrayBuffer(
    input.arrayBuffer,
    input.fileType,
    undefined,
    input.textures
  );
  const metrics = serializeMetrics(preprocessed.metrics, preprocessed.originalScale);
  const children = extractChildMeshes(preprocessed.model);

  cachePreprocessedModel(input.assetId, preprocessed.model, metrics);

  if (input.persistMetadata !== false) {
    await updateAssetMetadata(input.assetId, { metrics, children });
  }

  if (import.meta.env.DEV) {
    const triangles = metrics.triangleCount ?? 0;
    const dims = `${metrics.size.x.toFixed(0)} × ${metrics.size.y.toFixed(0)} × ${metrics.size.z.toFixed(0)} cm`;
    console.log(
      `[processModelBuffer] "${input.assetName}" — ${triangles.toLocaleString()} triangles, ${children.length} mesh parts, size ${dims}`
    );
  }

  const position = calculateOptimalPosition(metrics, input.existingObjects);
  const uniqueName = generateUniqueName(input.assetName, input.existingObjects);
  const sceneObject = createSceneObject(input.assetId, uniqueName, position, metrics, children);

  return { metrics, children, sceneObject };
}
