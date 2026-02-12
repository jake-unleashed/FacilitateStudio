import type { ChildMesh, SceneObject, SimStep } from '../types';
import type { ModelFileType, ModelMetrics } from './model';

export interface AssetManifestEntry {
  /** Public URL in the `published-assets` bucket. */
  url: string;
  fileType: ModelFileType;
  metrics?: ModelMetrics;
  children?: ChildMesh[];
}

export interface PublishedSnapshot {
  name: string;
  objects: SceneObject[];
  steps: SimStep[];
  assetManifest: Record<string, AssetManifestEntry>;
}

export interface PublishURLResult {
  /** The shareable published URL. */
  url: string;
  /** High-entropy token used for public lookup. */
  shareToken: string;
}
