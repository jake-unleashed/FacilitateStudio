import * as THREE from 'three';

import type { ModelFileType } from './types';
import { loadAndPreprocessModelFromArrayBuffer } from './preprocess';

const MODEL_FETCH_TIMEOUT_MS = 60_000;

/**
 * Load and preprocess a model directly from a remote URL.
 * Intended for published-viewer style flows where assets are resolved from cloud URLs.
 */
export async function loadModelFromUrl(url: string, fileType: ModelFileType): Promise<THREE.Group> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch model from URL (${response.status} ${response.statusText})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const preprocessed = await loadAndPreprocessModelFromArrayBuffer(arrayBuffer, fileType);
  return preprocessed.model;
}

