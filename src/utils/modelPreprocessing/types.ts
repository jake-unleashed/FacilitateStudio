import type * as THREE from 'three';

export interface ModelMetrics {
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  bottomY: number;
  topY: number;
  maxDimension: number;
  triangleCount?: number;
}

export interface PreprocessedModel {
  model: THREE.Group;
  metrics: ModelMetrics;
  originalScale: number; // Scale factor applied during preprocessing
}

