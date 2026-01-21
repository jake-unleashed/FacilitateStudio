import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { createGLTFLoader } from './draco';
import type { ModelFileType } from './types';

/**
 * Get appropriate loader for file type (for direct loader access if needed).
 * Note: GLTFLoader is returned with DRACO support pre-configured for GLB files.
 */
export function getLoaderForFileType(fileType: ModelFileType): OBJLoader | FBXLoader | GLTFLoader {
  switch (fileType) {
    case 'obj':
      return new OBJLoader();
    case 'fbx':
      return new FBXLoader();
    case 'glb':
      return createGLTFLoader();
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

