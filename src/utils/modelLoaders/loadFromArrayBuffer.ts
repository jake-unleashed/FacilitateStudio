import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import { createGLTFLoader } from './draco';
import { extractErrorMessage } from './errors';
import { IS_DEV } from './env';
import type { ModelFileType } from './types';
import { wrapInGroup } from './wrap';

/**
 * Load model directly from ArrayBuffer (preferred method).
 * Skips the base64 encoding/decoding overhead.
 */
export async function loadModelFromArrayBuffer(arrayBuffer: ArrayBuffer, fileType: ModelFileType): Promise<THREE.Group> {
  let model: THREE.Object3D;

  try {
    switch (fileType) {
      case 'obj': {
        const loader = new OBJLoader();
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        model = loader.parse(text);
        break;
      }
      case 'fbx': {
        const loader = new FBXLoader();
        model = loader.parse(arrayBuffer, '');
        break;
      }
      case 'glb': {
        const loader = createGLTFLoader();
        model = await new Promise((resolve, reject) => {
          loader.parse(
            arrayBuffer,
            '',
            (gltf) => resolve(gltf.scene),
            (error: unknown) => {
              const errorMessage = extractErrorMessage(error);
              if (IS_DEV) {
                console.error('[modelLoaders] GLB parsing failed:', error);
              }
              reject(new Error(`Failed to load GLB: ${errorMessage}`));
            }
          );
        });
        break;
      }
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (IS_DEV) {
      console.log(`[modelLoaders] ${fileType.toUpperCase()} loaded from ArrayBuffer`);
    }

    return wrapInGroup(model);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load model: ${String(error)}`);
  }
}

