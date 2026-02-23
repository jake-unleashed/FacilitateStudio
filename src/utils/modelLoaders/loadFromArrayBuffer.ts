import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import { createGLTFLoader } from './draco';
import { extractErrorMessage } from './errors';
import { IS_DEV } from './env';
import type { ModelFileType } from './types';
import { wrapInGroup } from './wrap';
import type { AssetTextureMap } from '../modelAssetStore';

function getTextureLookupKey(url: string): string | null {
  const normalized = url.split('?')[0].split('#')[0];
  const slashSegments = normalized.split('/');
  const finalSegment = slashSegments[slashSegments.length - 1] ?? '';
  const fileName = finalSegment.split('\\').pop() ?? finalSegment;
  const key = fileName.trim().toLowerCase();
  return key.length > 0 ? key : null;
}

/**
 * Load model directly from ArrayBuffer (preferred method).
 * Skips the base64 encoding/decoding overhead.
 */
export async function loadModelFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileType: ModelFileType,
  textures?: AssetTextureMap
): Promise<THREE.Group> {
  let model: THREE.Object3D;
  const blobUrls = new Map<string, string>();

  if (textures && Object.keys(textures).length > 0) {
    for (const [fileName, textureBlob] of Object.entries(textures)) {
      blobUrls.set(fileName.toLowerCase(), URL.createObjectURL(textureBlob));
    }
  }

  // Revoke all blob URLs. Called after images finish loading — NOT synchronously
  // after parse(), because THREE.js texture loading is async (Image src fetches).
  // Premature revocation causes black textures.
  const revokeBlobUrls = () => {
    for (const blobUrl of blobUrls.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    blobUrls.clear();
  };

  const loadingManager = new THREE.LoadingManager();
  if (blobUrls.size > 0) {
    loadingManager.setURLModifier((url) => {
      const key = getTextureLookupKey(url);
      if (!key) {
        return url;
      }
      return blobUrls.get(key) ?? url;
    });

    // onLoad fires after ALL tracked items (textures) have finished loading —
    // including failures, since itemError() also calls itemEnd() internally.
    // This is the correct point to revoke blob URLs.
    loadingManager.onLoad = revokeBlobUrls;
  }

  try {
    switch (fileType) {
      case 'obj': {
        const loader = new OBJLoader(loadingManager);
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        model = loader.parse(text);
        break;
      }
      case 'fbx': {
        const loader = new FBXLoader(loadingManager);
        model = loader.parse(arrayBuffer, '');
        break;
      }
      case 'glb': {
        const loader = createGLTFLoader(loadingManager);
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
    // Parsing failed outright — revoke immediately since these URLs won't be used.
    revokeBlobUrls();
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load model: ${String(error)}`);
  }
}

