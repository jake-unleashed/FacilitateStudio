import type { ModelMetrics } from '../../types/model';
import type { SceneObject } from '../../types';
import { MODEL_POSITION_SPACING } from '../../constants';

/**
 * Calculate optimal position for a new model to avoid overlapping existing objects.
 * Uses a spiral pattern to find an empty spot.
 */
export function calculateOptimalPosition(
  modelMetrics: ModelMetrics,
  existingObjects: SceneObject[]
): { x: number; y: number; z: number } {
  if (existingObjects.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const spacing = Math.max(MODEL_POSITION_SPACING, modelMetrics.maxDimension * 1.5);

  // Spiral outward to find non-overlapping position
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = attempt * 0.5 * Math.PI;
    const radius = spacing * (1 + Math.floor(attempt / 4));
    const x = Math.round(Math.cos(angle) * radius * 100) / 100;
    const z = Math.round(Math.sin(angle) * radius * 100) / 100;

    const hasOverlap = existingObjects.some((obj) => {
      const dx = obj.transform.x / 100 - x;
      const dz = obj.transform.z / 100 - z;
      return Math.sqrt(dx * dx + dz * dz) < spacing;
    });

    if (!hasOverlap) {
      return { x, y: 0, z };
    }
  }

  // Fallback: return last calculated position
  return { x: spacing * 5, y: 0, z: spacing * 5 };
}

/**
 * Generate a unique name for the model, avoiding duplicates.
 */
export function generateUniqueName(baseName: string, existingObjects: SceneObject[]): string {
  // Sanitize: remove extension, special chars, trim
  let name = baseName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .trim()
    .substring(0, 50);

  if (!name) name = 'Uploaded Model';

  const existingNames = new Set(existingObjects.map((obj) => obj.name));

  if (!existingNames.has(name)) return name;

  // Append incrementing number
  let counter = 2;
  while (existingNames.has(`${name} ${counter}`)) {
    counter++;
  }

  return `${name} ${counter}`;
}

