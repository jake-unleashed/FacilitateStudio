/**
 * Model Loaders Utility
 *
 * Provides utilities to load 3D models using Three.js loaders.
 *
 * TEXTURE LOADING ARCHITECTURE:
 * - GLB/FBX: Uses ArrayBuffer + loader.parse() to properly handle embedded textures
 * - OBJ: Uses text parsing (no texture support without MTL files)
 * - GLTF: Uses ArrayBuffer parsing (external textures won't resolve)
 *
 * The key insight is that using loader.parse(arrayBuffer) instead of loader.load(url)
 * ensures embedded textures in GLB/FBX files are properly extracted and applied.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { preprocessModel, PreprocessedModel } from './modelPreprocessing';
import { optimizeMaterialsForScene } from './materialOptimization';
import { MODEL_TARGET_SIZE } from '../constants';

export type ModelFileType = 'obj' | 'fbx' | 'glb' | 'gltf';

// =============================================================================
// Development Mode Detection
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV ?? process.env.NODE_ENV === 'development';

// =============================================================================
// Texture Diagnostics
// =============================================================================

export interface TextureReport {
  totalMeshes: number;
  meshesWithTextures: number;
  meshesWithoutTextures: number;
  textureTypes: Set<string>;
  issues: string[];
}

/**
 * Analyze a model's texture usage for diagnostics.
 * Only logs in development mode.
 */
export function analyzeModelTextures(model: THREE.Group, modelName?: string): TextureReport {
  const report: TextureReport = {
    totalMeshes: 0,
    meshesWithTextures: 0,
    meshesWithoutTextures: 0,
    textureTypes: new Set(),
    issues: [],
  };

  const textureProps = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'lightMap',
    'bumpMap',
    'displacementMap',
    'alphaMap',
    'envMap',
  ] as const;

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    report.totalMeshes++;
    let hasAnyTexture = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    for (const material of materials) {
      if (!material) continue;

      for (const prop of textureProps) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const texture = (material as any)[prop];
        if (texture instanceof THREE.Texture) {
          hasAnyTexture = true;
          report.textureTypes.add(prop);

          // Check for texture issues
          if (!texture.image) {
            report.issues.push(`${prop} texture has no image data`);
          }
        }
      }

      // Check for potential texture loading issues
      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.color.getHex() === 0x000000 && !material.map) {
          report.issues.push('Material is black without diffuse texture - may be missing texture');
        }
        if (material.transparent && material.opacity < 0.1 && !material.alphaMap) {
          report.issues.push('Material is nearly invisible without alpha texture');
        }
      }
    }

    if (hasAnyTexture) {
      report.meshesWithTextures++;
    } else {
      report.meshesWithoutTextures++;
    }
  });

  // Log in development mode
  if (IS_DEV) {
    const name = modelName ?? 'Unknown Model';
    console.log(`[TextureDiagnostics] ${name}:`);
    console.log(
      `  Meshes: ${report.totalMeshes} (${report.meshesWithTextures} textured, ${report.meshesWithoutTextures} untextured)`
    );
    if (report.textureTypes.size > 0) {
      console.log(`  Texture types: ${Array.from(report.textureTypes).join(', ')}`);
    }
    if (report.issues.length > 0) {
      console.warn(`  Issues:`, report.issues);
    }
  }

  return report;
}

// =============================================================================
// ArrayBuffer Conversion Utilities
// =============================================================================

/**
 * Convert base64 string to ArrayBuffer.
 * Used when we receive base64 data from storage.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert base64 string to text (for OBJ files which are text-based).
 */
function base64ToText(base64: string): string {
  const binaryString = atob(base64);
  // Use TextDecoder for proper UTF-8 handling
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// =============================================================================
// Model Normalization
// =============================================================================

/**
 * Wrap model in a Group for consistent structure.
 *
 * NOTE: We do NOT clone here. The original model from the loader is used directly.
 * Deep cloning is handled by the model cache when returning instances to the scene.
 * This prevents unnecessary cloning during the loading pipeline.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapInGroup(model: any): THREE.Group {
  // If already a Group with proper structure, return it directly
  if (model instanceof THREE.Group) {
    return model;
  }

  // Wrap in a Group for consistent hierarchy
  const group = new THREE.Group();
  group.add(model);
  return group;
}

// =============================================================================
// Model Loaders (ArrayBuffer-based for proper texture handling)
// =============================================================================

/**
 * Load OBJ model from base64 text.
 * OBJ files are text-based and don't support embedded textures.
 */
async function loadOBJModel(base64: string): Promise<THREE.Object3D> {
  const loader = new OBJLoader();
  const objText = base64ToText(base64);

  // OBJLoader.parse() takes text content directly
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

  // FBXLoader.parse() extracts embedded textures correctly
  // The second parameter is the resource path for external resources (empty for embedded)
  const object = loader.parse(arrayBuffer, '');

  if (IS_DEV) {
    console.log('[modelLoaders] FBX loaded via ArrayBuffer parsing (embedded textures supported)');
  }

  return object;
}

/**
 * Load GLTF/GLB model from ArrayBuffer.
 * GLB files have embedded textures that are properly extracted via parse().
 * GLTF files with external textures won't resolve (need multi-file upload).
 */
async function loadGLTFModel(base64: string, isGLB: boolean): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const arrayBuffer = base64ToArrayBuffer(base64);

  return new Promise((resolve, reject) => {
    // GLTFLoader.parse() properly handles embedded textures in GLB
    // For GLTF with external textures, they won't resolve but the model loads
    loader.parse(
      arrayBuffer,
      '', // Resource path (empty - all resources should be embedded for GLB)
      (gltf) => {
        if (IS_DEV) {
          console.log(`[modelLoaders] ${isGLB ? 'GLB' : 'GLTF'} loaded via ArrayBuffer parsing`);
          if (!isGLB) {
            console.log(
              '[modelLoaders] Note: GLTF external textures require multi-file upload (not supported)'
            );
          }
        }
        resolve(gltf.scene);
      },
      (error) => {
        reject(
          new Error(
            `Failed to load ${isGLB ? 'GLB' : 'GLTF'} model: ${error.message || 'Unknown error'}`
          )
        );
      }
    );
  });
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Load model from base64 string based on file type.
 * Uses ArrayBuffer-based parsing for proper embedded texture support.
 */
export async function loadModelFromBase64(
  base64: string,
  fileType: ModelFileType
): Promise<THREE.Group> {
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

    // Wrap in Group for consistent structure
    return wrapInGroup(model);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load model: ${String(error)}`);
  }
}

/**
 * Load model directly from ArrayBuffer (preferred method).
 * Skips the base64 encoding/decoding overhead.
 */
export async function loadModelFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileType: ModelFileType
): Promise<THREE.Group> {
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
      case 'glb':
      case 'gltf': {
        const loader = new GLTFLoader();
        model = await new Promise((resolve, reject) => {
          loader.parse(
            arrayBuffer,
            '',
            (gltf) => resolve(gltf.scene),
            (error) =>
              reject(
                new Error(
                  `Failed to load ${fileType.toUpperCase()}: ${error.message || 'Unknown error'}`
                )
              )
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

/**
 * Load and preprocess model from base64 string.
 * This is the recommended function to use for adding models to the scene.
 */
export async function loadAndPreprocessModel(
  base64: string,
  fileType: ModelFileType,
  targetSize: number = MODEL_TARGET_SIZE
): Promise<PreprocessedModel> {
  // Load raw model using ArrayBuffer-based parsing
  const rawModel = await loadModelFromBase64(base64, fileType);

  // Run texture diagnostics in dev mode
  if (IS_DEV) {
    analyzeModelTextures(rawModel, `Uploaded ${fileType.toUpperCase()}`);
  }

  // Optimize materials (with smart fallbacks for missing textures)
  optimizeMaterialsForScene(rawModel);

  // Preprocess model (scaling, centering, etc.)
  const preprocessed = preprocessModel(rawModel, targetSize);

  return preprocessed;
}

/**
 * Load and preprocess model directly from ArrayBuffer.
 * Preferred method - avoids base64 overhead.
 */
export async function loadAndPreprocessModelFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileType: ModelFileType,
  targetSize: number = MODEL_TARGET_SIZE
): Promise<PreprocessedModel> {
  // Load raw model
  const rawModel = await loadModelFromArrayBuffer(arrayBuffer, fileType);

  // Run texture diagnostics in dev mode
  if (IS_DEV) {
    analyzeModelTextures(rawModel, `Uploaded ${fileType.toUpperCase()}`);
  }

  // Optimize materials (with smart fallbacks for missing textures)
  optimizeMaterialsForScene(rawModel);

  // Preprocess model (scaling, centering, etc.)
  const preprocessed = preprocessModel(rawModel, targetSize);

  return preprocessed;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get appropriate loader for file type (for direct loader access if needed).
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
 * Calculate bounding box for a model (useful for auto-scaling).
 */
export function getModelBoundingBox(model: THREE.Group): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

/**
 * Center model at origin.
 */
export function centerModelAtOrigin(model: THREE.Group): void {
  const box = getModelBoundingBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
}

/**
 * Scale model to fit within a bounding box.
 */
export function scaleModelToFit(model: THREE.Group, maxSize: number = 1): void {
  const box = getModelBoundingBox(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (maxDimension > 0) {
    const scale = maxSize / maxDimension;
    model.scale.multiplyScalar(scale);
  }
}

// Re-export PreprocessedModel type for convenience
export type { PreprocessedModel } from './modelPreprocessing';

// =============================================================================
// Child Mesh Extraction
// =============================================================================

import { ChildMesh, DEFAULT_TRANSFORM } from '../types';

/**
 * Information about an extracted child mesh for scene hierarchy display.
 */
export interface ExtractedChildInfo {
  name: string;
  path: string[];
  meshCount: number;
}

/**
 * Extract child mesh hierarchy from a loaded 3D model.
 * Returns an array of ChildMesh objects suitable for storing in SceneObject.children.
 *
 * The extraction strategy:
 * 1. Skip single-mesh models (no hierarchy to show)
 * 2. Recursively traverse the ENTIRE hierarchy (all levels deep)
 * 3. Add every named mesh/group that contains geometry
 * 4. Use meaningful names from the model or generate fallbacks
 *
 * Children are stored in a flat list with full paths - the UI uses path depth for indentation.
 */
export function extractChildMeshes(model: THREE.Group): ChildMesh[] {
  const children: ChildMesh[] = [];

  // First pass: count total meshes and named groups
  let meshCount = 0;
  let namedGroupCount = 0;

  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      meshCount++;
    }
    if (child instanceof THREE.Group && child.name && child.name !== '' && child !== model) {
      namedGroupCount++;
    }
  });

  // Skip if there's only one mesh or no meaningful hierarchy
  if (meshCount <= 1 && namedGroupCount === 0) {
    if (IS_DEV) {
      console.log('[extractChildMeshes] Single mesh model, no children to extract');
    }
    return children;
  }

  // Track visited paths to avoid duplicates
  const visitedPaths = new Set<string>();

  /**
   * Recursively extract ALL children at ALL levels.
   * This differs from the previous implementation by:
   * 1. Always recursing into named groups (not stopping at them)
   * 2. Collecting meshes and groups at every level of the hierarchy
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractChildrenRecursive(obj: any, currentPath: string[]): void {
    for (const child of obj.children) {
      const childPath = [...currentPath, child.name || `child_${child.id}`];
      const pathKey = childPath.join('/');

      // Skip if already processed
      if (visitedPaths.has(pathKey)) continue;

      // Check if this child or its descendants contain meshes
      let hasMeshes = false;
      child.traverse((desc: THREE.Object3D) => {
        if (desc instanceof THREE.Mesh) {
          hasMeshes = true;
        }
      });

      if (!hasMeshes) continue;

      // If this is a mesh directly, add it
      if (child instanceof THREE.Mesh) {
        visitedPaths.add(pathKey);
        children.push({
          name: sanitizeChildName(child.name) || `Part ${children.length + 1}`,
          path: childPath,
          localTransform: { ...DEFAULT_TRANSFORM },
        });
        // Meshes don't have meaningful children, so no recursion needed
      } else {
        // This is a group (Group or Object3D with children)
        const hasName = child.name && child.name !== '' && !child.name.startsWith('_');

        if (hasName) {
          visitedPaths.add(pathKey);
          children.push({
            name: sanitizeChildName(child.name),
            path: childPath,
            localTransform: { ...DEFAULT_TRANSFORM },
          });
        }

        // ALWAYS recurse into groups to find nested children (this is the key change)
        // Even if this group was named and added, we still want to find its children
        extractChildrenRecursive(child, childPath);
      }
    }
  }

  extractChildrenRecursive(model, []);

  // If we didn't find any named children, extract all meshes with generated names
  if (children.length === 0 && meshCount > 1) {
    let partIndex = 1;
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && (child as THREE.Object3D) !== (model as THREE.Object3D)) {
        const path = getObjectPath(model, child);
        if (path) {
          children.push({
            name: sanitizeChildName(child.name) || `Part ${partIndex++}`,
            path: path,
            localTransform: { ...DEFAULT_TRANSFORM },
          });
        }
      }
    });
  }

  if (IS_DEV) {
    console.log(
      `[extractChildMeshes] Extracted ${children.length} children:`,
      children.map((c) => ({ name: c.name, depth: c.path.length }))
    );
  }

  return children;
}

/**
 * Get the path from root to a specific object in the hierarchy.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getObjectPath(root: any, target: any): string[] | null {
  const path: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findPath(obj: any, current: string[]): boolean {
    if (obj === target) {
      path.push(...current);
      return true;
    }
    for (const child of obj.children) {
      const childPath = [...current, child.name || `child_${child.id}`];
      if (findPath(child, childPath)) {
        return true;
      }
    }
    return false;
  }

  findPath(root, []);
  return path.length > 0 ? path : null;
}

/**
 * Sanitize a child name for display.
 * Removes common prefixes, underscores to spaces, etc.
 */
function sanitizeChildName(name: string): string {
  if (!name) return '';

  // Remove common prefixes
  let cleaned = name
    .replace(/^(Object|Mesh|Group|Node|Scene)_?/i, '')
    .replace(/^_+/, '')
    .replace(/_+$/, '');

  // Convert underscores/dashes to spaces for readability
  cleaned = cleaned.replace(/[_-]+/g, ' ');

  // Title case
  cleaned = cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();

  return cleaned || name;
}

/**
 * Find a child object in a model by its path.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findChildByPath(model: any, path: string[]): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = model;

  for (const segment of path) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = current.children.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.name === segment || `child_${c.id}` === segment
    );
    if (!child) {
      if (IS_DEV) {
        console.warn(`[findChildByPath] Could not find segment "${segment}" in path`, path);
      }
      return null;
    }
    current = child;
  }

  return current;
}
