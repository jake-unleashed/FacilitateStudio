/**
 * PreviewMode Types
 *
 * Shared types used by preview-mode components and the canvas wiring.
 */

/**
 * Target (object or child mesh) to be outlined in preview mode.
 * This is intentionally separate from editor selection state.
 */
export interface PreviewOutlineTarget {
  objectId: string;
  childPath: string | null;
}
