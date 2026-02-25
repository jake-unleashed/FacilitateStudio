import type { ChildMesh, SceneObject, SimStep } from '../types';
import type { ModelFileType, ModelMetrics } from './model';
import type { SceneSettings } from './sceneSettings';
import type { SimulationSettings } from './simulationSettings';

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
  sceneSettings?: SceneSettings & {
    /** Public URL in the `published-assets` bucket for the 360 background image. */
    backgroundImageUrl?: string;
  };
  simulationSettings?: SimulationSettings;
  assetManifest: Record<string, AssetManifestEntry>;
}

export interface PublishURLResult {
  /** The shareable published URL. */
  url: string;
  /** High-entropy token used for public lookup. */
  shareToken: string;
}
