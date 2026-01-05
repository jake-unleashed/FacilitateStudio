/**
 * Model Loaders Utility
 * 
 * Provides utilities to load 3D models from base64 strings using Three.js loaders.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { preprocessModel, PreprocessedModel } from './modelPreprocessing';
import { optimizeMaterialsForScene } from './materialOptimization';
import { MODEL_TARGET_SIZE } from '../constants';

export type ModelFileType = 'obj' | 'fbx' | 'glb' | 'gltf';

/**
 * Convert base64 string to blob URL
 */
function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Get MIME type for file type
 */
function getMimeType(fileType: ModelFileType): string {
  switch (fileType) {
    case 'obj':
      return 'model/obj';
    case 'fbx':
      return 'application/octet-stream';
    case 'glb':
      return 'model/gltf-binary';
    case 'gltf':
      return 'model/gltf+json';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Normalize model to a Group for consistent structure
 */
function normalizeModelGeometry(model: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  
  // If it's already a group, clone it
  if (model instanceof THREE.Group) {
    model.children.forEach((child) => {
      group.add(child.clone());
    });
    return group;
  }

  // Otherwise, add the model to a group
  group.add(model);
  return group;
}

/**
 * Load OBJ model from base64
 */
async function loadOBJModel(base64: string): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();
    const blobUrl = base64ToBlobUrl(base64, getMimeType('obj'));
    
    loader.load(
      blobUrl,
      (object) => {
        URL.revokeObjectURL(blobUrl);
        resolve(object);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Failed to load OBJ model: ${error.message || 'Unknown error'}`));
      }
    );
  });
}

/**
 * Load FBX model from base64
 */
async function loadFBXModel(base64: string): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    const blobUrl = base64ToBlobUrl(base64, getMimeType('fbx'));
    
    loader.load(
      blobUrl,
      (object) => {
        URL.revokeObjectURL(blobUrl);
        resolve(object);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Failed to load FBX model: ${error.message || 'Unknown error'}`));
      }
    );
  });
}

/**
 * Load GLTF/GLB model from base64
 */
async function loadGLTFModel(base64: string, isGLB: boolean): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const blobUrl = base64ToBlobUrl(base64, getMimeType(isGLB ? 'glb' : 'gltf'));
    
    loader.load(
      blobUrl,
      (gltf) => {
        URL.revokeObjectURL(blobUrl);
        // GLTFLoader returns a GLTF object with a scene property
        resolve(gltf.scene);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Failed to load ${isGLB ? 'GLB' : 'GLTF'} model: ${error.message || 'Unknown error'}`));
      }
    );
  });
}

/**
 * Load model from base64 string based on file type
 */
export async function loadModelFromBase64(
  base64: string,
  fileType: ModelFileType
): Promise<THREE.Object3D> {
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
        model = await loadGLTFModel(base64, true);
        break;
      case 'gltf':
        model = await loadGLTFModel(base64, false);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Normalize to ensure consistent structure
    return normalizeModelGeometry(model);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load model: ${String(error)}`);
  }
}

/**
 * Load and preprocess model from base64 string
 * This is the recommended function to use for adding models to the scene
 */
export async function loadAndPreprocessModel(
  base64: string,
  fileType: ModelFileType,
  targetSize: number = MODEL_TARGET_SIZE
): Promise<PreprocessedModel> {
  // Load raw model
  const rawModel = await loadModelFromBase64(base64, fileType);
  
  // Optimize materials first (before preprocessing)
  optimizeMaterialsForScene(rawModel);
  
  // Preprocess model (scaling, centering, etc.)
  const preprocessed = preprocessModel(rawModel, targetSize);
  
  return preprocessed;
}

/**
 * Get appropriate loader for file type (for direct loader access if needed)
 */
export function getLoaderForFileType(fileType: ModelFileType): OBJLoader | FBXLoader | GLTFLoader {
  switch (fileType) {
    case 'obj':
      return new OBJLoader();
    case 'fbx':
      return new FBXLoader();
    case 'glb':
    case 'gltf':
      return new GLTFLoader();
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Calculate bounding box for a model (useful for auto-scaling)
 */
export function getModelBoundingBox(model: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

/**
 * Center model at origin
 */
export function centerModelAtOrigin(model: THREE.Object3D): void {
  const box = getModelBoundingBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
}

/**
 * Scale model to fit within a bounding box
 */
export function scaleModelToFit(
  model: THREE.Object3D,
  maxSize: number = 1
): void {
  const box = getModelBoundingBox(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  
  if (maxDimension > 0) {
    const scale = maxSize / maxDimension;
    model.scale.multiplyScalar(scale);
  }
}

