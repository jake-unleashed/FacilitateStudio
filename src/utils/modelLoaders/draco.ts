import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LoadingManager } from 'three';

let dracoLoader: DRACOLoader | null = null;

/**
 * Get or create the shared DRACO loader instance.
 * Uses Google's CDN for the Draco decoder files.
 */
export function getDRACOLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    // Use Google's CDN for Draco decoder - widely available and reliable
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' }); // Use JS decoder for broader compatibility
  }
  return dracoLoader;
}

/**
 * Create a GLTFLoader with DRACO support configured.
 */
export function createGLTFLoader(manager?: LoadingManager): GLTFLoader {
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(getDRACOLoader());
  return loader;
}

