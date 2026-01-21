import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import { base64ToArrayBuffer, base64ToText } from './base64';
import { createGLTFLoader } from './draco';
import { extractErrorMessage } from './errors';
import { IS_DEV } from './env';
import type { ModelFileType } from './types';
import { wrapInGroup } from './wrap';

/**
 * Load OBJ model from base64 text.
 * OBJ files are text-based and don't support embedded textures.
 */
async function loadOBJModel(base64: string): Promise<THREE.Object3D> {
  const loader = new OBJLoader();
  const objText = base64ToText(base64);
  const object = loader.parse(objText);

  if (IS_DEV) {
    console.log('[modelLoaders] OBJ loaded via text parsing (no texture support)');
  }

  return object;
}

/**
 * Load FBX model from ArrayBuffer.
 * FBX files can contain embedded textures which are properly extracted via parse().
 */
async function loadFBXModel(base64: string): Promise<THREE.Object3D> {
  const loader = new FBXLoader();
  const arrayBuffer = base64ToArrayBuffer(base64);
  const object = loader.parse(arrayBuffer, '');

  if (IS_DEV) {
    console.log('[modelLoaders] FBX loaded via ArrayBuffer parsing (embedded textures supported)');
  }

  return object;
}

/**
 * Load GLB model from ArrayBuffer.
 * GLB files have embedded textures that are properly extracted via parse().
 */
async function loadGLBModel(base64: string): Promise<THREE.Object3D> {
  const loader = createGLTFLoader();
  const arrayBuffer = base64ToArrayBuffer(base64);

  return new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        if (IS_DEV) {
          console.log('[modelLoaders] GLB loaded via ArrayBuffer parsing');
        }
        resolve(gltf.scene);
      },
      (error: unknown) => {
        const errorMessage = extractErrorMessage(error);
        if (IS_DEV) {
          console.error('[modelLoaders] GLB parsing failed:', error);
        }
        reject(new Error(`Failed to load GLB: ${errorMessage}`));
      }
    );
  });
}

/**
 * Load model from base64 string based on file type.
 * Uses ArrayBuffer-based parsing for proper embedded texture support.
 */
export async function loadModelFromBase64(base64: string, fileType: ModelFileType): Promise<THREE.Group> {
  let model: THREE.Object3D;

  try {
    switch (fileType) {
      case 'obj':
        model = await loadOBJModel(base64);
        break;
      case 'fbx':
        model = await loadFBXModel(base64);
        break;
      case 'glb':
        model = await loadGLBModel(base64);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    return wrapInGroup(model);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load model: ${String(error)}`);
  }
}

