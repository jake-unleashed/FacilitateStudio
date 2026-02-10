/**
 * Starter Assets Discovery
 *
 * Uses Vite's import.meta.glob to discover starter model files at build time.
 * Generates stable IDs and metadata for each starter asset.
 */

import { parseFileType, type ModelFileType } from '../../types/model';

export interface StarterAssetDescriptor {
  /** Stable ID for this starter asset (e.g., "starter:cube") */
  id: string;
  /** Display name derived from filename */
  name: string;
  /** File type */
  fileType: ModelFileType;
  /** URL to the asset (provided by Vite) */
  url: string;
}

/**
 * Discover all starter model files using Vite's import.meta.glob.
 * This runs at build/dev time and produces a stable list of assets.
 *
 * @returns Array of starter asset descriptors with stable IDs
 */
export function discoverStarterAssets(): StarterAssetDescriptor[] {
  // Use Vite's import.meta.glob to get all model files in the starter assets folder
  // The `?url` query tells Vite to give us the URL to the file (not import its contents)
  const modelFiles = import.meta.glob<string>('/src/starterAssets/models/*.{glb,fbx}', {
    eager: true,
    query: '?url',
    import: 'default',
  });

  const assets: StarterAssetDescriptor[] = [];

  for (const [path, url] of Object.entries(modelFiles)) {
    // Extract filename from path (e.g., "/src/starterAssets/models/cube.glb" -> "cube.glb")
    const filename = path.split('/').pop() ?? '';
    if (!filename) continue;

    // Remove extension for display name and slug
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Create a URL-safe slug for the ID (skip if empty, e.g. file named ".glb")
    const slug = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) continue;

    try {
      const fileType = parseFileType(filename);

      assets.push({
        id: `starter:${slug}`,
        name: nameWithoutExt,
        fileType,
        url,
      });
    } catch (error) {
      console.warn(`[discoverStarterAssets] Skipping unsupported file: ${filename}`, error);
    }
  }

  // Sort by name for consistent ordering
  assets.sort((a, b) => a.name.localeCompare(b.name));

  return assets;
}
