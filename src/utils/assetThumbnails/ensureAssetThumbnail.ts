/**
 * Asset Thumbnail Generation
 *
 * Generates thumbnails from 3D models by rendering them in an offscreen scene.
 * Thumbnails are cached in asset metadata to avoid regeneration.
 */

import * as THREE from 'three';
import { getAsset, getAssetMetadata, updateAssetMetadata, blobToArrayBuffer } from '../modelAssetStore';
import { loadAndPreprocessModelFromArrayBuffer } from '../modelLoaders';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { logger } from '../logger';

/**
 * Throttle to limit concurrent thumbnail generation.
 * Only one thumbnail can be generated at a time to avoid UI freezing.
 */
class ThumbnailThrottle {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.isProcessing = false;
  }
}

const thumbnailThrottle = new ThumbnailThrottle();

/**
 * Lighten a color if it's too dark (prevents black materials).
 */
function ensureMinLuminance(color: THREE.Color, minLuminance: number): void {
  const r = color.r;
  const g = color.g;
  const b = color.b;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luminance < minLuminance && luminance > 0) {
    const scale = minLuminance / luminance;
    color.r = Math.min(1, r * scale);
    color.g = Math.min(1, g * scale);
    color.b = Math.min(1, b * scale);
  } else if (luminance === 0) {
    color.setHex(0x444444); // Pure black -> dark gray so mesh is visible
  }
}

/**
 * Generate a thumbnail from a Three.js model by rendering it in an offscreen scene.
 * Uses strong, even lighting to prevent dark/black thumbnails on PBR and basic materials.
 *
 * @param model - The preprocessed Three.js model
 * @returns Base64 data URL of the thumbnail, or null if generation fails
 */
async function generateThumbnailFromModel(model: THREE.Group): Promise<string | null> {
  const renderer = new THREE.WebGLRenderer({
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(640, 360);
  renderer.setPixelRatio(2);
  renderer.setClearColor(0xe2e8f0, 1.0); // slate-200 - visible but not harsh
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Linear avoids ACES crushing darks; higher exposure = brighter output
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.8;

  const scene = new THREE.Scene();

  // Studio environment for metallic/roughness materials
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  const renderModel = model.clone(true);
  renderModel.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      if (!mat) return;
      // Handle PBR materials
      if (mat instanceof THREE.MeshStandardMaterial) {
        // Make metallic surfaces less extreme so they reflect environment better
        mat.metalness = Math.min(mat.metalness ?? 0, 0.7);
        mat.roughness = Math.max(mat.roughness ?? 0.5, 0.25);
        mat.envMapIntensity = 2.5; // Strong environment reflection
        if (mat.color) ensureMinLuminance(mat.color, 0.15);
        // Add subtle emissive so nothing goes pure black
        mat.emissive = mat.emissive?.clone() ?? new THREE.Color(0x000000);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.15);
        mat.needsUpdate = true;
      }
      // Handle MeshBasicMaterial (ignores all lights - will be black without fix)
      else if (mat instanceof THREE.MeshBasicMaterial) {
        const baseColor = mat.color?.clone() ?? new THREE.Color(0x888888);
        ensureMinLuminance(baseColor, 0.2);
        // Convert to MeshLambertMaterial so it responds to light
        const lambert = new THREE.MeshLambertMaterial({
          color: baseColor,
          map: mat.map,
          transparent: mat.transparent,
          opacity: mat.opacity,
        });
        const idx = materials.indexOf(mat);
        if (Array.isArray(mesh.material)) mesh.material[idx] = lambert;
        else mesh.material = lambert;
      }
      // Handle MeshLambertMaterial
      else if (mat instanceof THREE.MeshLambertMaterial && mat.color) {
        ensureMinLuminance(mat.color, 0.15);
        mat.emissive = mat.emissive?.clone() ?? new THREE.Color(0x000000);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.12);
        mat.needsUpdate = true;
      }
    });
  });
  scene.add(renderModel);

  const box = new THREE.Box3().setFromObject(renderModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  const camera = new THREE.PerspectiveCamera(40, 640 / 360, 0.05, 2000);
  const distance = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360)) * 1.2;
  camera.position.set(
    center.x + distance * 0.7,
    center.y + distance * 0.55,
    center.z + distance * 0.7
  );
  camera.lookAt(center);

  // Strong, even lighting (aligned with main editor scene style but brighter)
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(center.x + distance, center.y + distance * 1.2, center.z + distance);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 2.0);
  fillLight.position.set(center.x - distance * 0.8, center.y + distance * 0.7, center.z + distance * 0.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
  rimLight.position.set(center.x, center.y + distance * 0.6, center.z - distance * 1.2);
  scene.add(rimLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbccdd, 1.2);
  hemiLight.position.set(0, distance * 2, 0);
  scene.add(hemiLight);

  // Point lights add localized punch (like main scene)
  const pointLight1 = new THREE.PointLight(0xffffff, 3.0, distance * 3);
  pointLight1.position.set(center.x + distance, center.y + distance, center.z + distance);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xffffff, 2.0, distance * 3);
  pointLight2.position.set(center.x - distance * 0.6, center.y + distance * 0.8, center.z - distance * 0.5);
  scene.add(pointLight2);

  renderer.render(scene, camera);

  const offscreen = document.createElement('canvas');
  offscreen.width = 320;
  offscreen.height = 180;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    pmremGenerator.dispose();
    envTexture.dispose();
    renderer.dispose();
    scene.clear();
    return null;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, 320, 180);

  const thumbnail = offscreen.toDataURL('image/jpeg', 0.92);

  pmremGenerator.dispose();
  envTexture.dispose();
  renderer.dispose();
  scene.clear();

  return thumbnail;
}

/**
 * Ensure an asset has a thumbnail, generating it if needed.
 * Thumbnails are cached in asset metadata.
 *
 * @param assetId - The asset ID
 * @returns The thumbnail data URL, or null if generation fails
 */
export async function ensureAssetThumbnail(assetId: string): Promise<string | null> {
  // Check if thumbnail already exists
  const metadata = await getAssetMetadata(assetId);
  if (!metadata) {
    logger.warn(`[ensureAssetThumbnail] Asset not found: ${assetId}`);
    return null;
  }

  if (metadata.thumbnail) {
    return metadata.thumbnail;
  }

  // Generate thumbnail (throttled to avoid UI freezing)
  return thumbnailThrottle.add(async () => {
    logger.log(`[ensureAssetThumbnail] Generating thumbnail for ${assetId}`);

    try {
      // Load the asset
      const asset = await getAsset(assetId);
      if (!asset) {
        logger.warn(`[ensureAssetThumbnail] Asset data not found: ${assetId}`);
        return null;
      }

      // Preprocess the model
      const arrayBuffer = await blobToArrayBuffer(asset.blob);
      const preprocessed = await loadAndPreprocessModelFromArrayBuffer(
        arrayBuffer,
        metadata.fileType
      );

      // Generate thumbnail
      const thumbnail = await generateThumbnailFromModel(preprocessed.model);

      if (thumbnail) {
        // Cache in metadata
        await updateAssetMetadata(assetId, {
          thumbnail,
          thumbnailUpdatedAt: new Date().toISOString(),
        });
        logger.log(`[ensureAssetThumbnail] Thumbnail generated and cached for ${assetId}`);
      }

      return thumbnail;
    } catch (error) {
      logger.error(`[ensureAssetThumbnail] Failed to generate thumbnail for ${assetId}:`, error);
      return null;
    }
  });
}
