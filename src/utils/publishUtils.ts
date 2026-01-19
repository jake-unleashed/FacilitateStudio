import type { PublishURLResult } from '../types/publish';

/**
 * Generate a shareable URL for a project (MVP).
 *
 * This MVP uses a project-ID-based URL that loads the project from IndexedDB.
 * - Works for the creator in their own browser (same origin + same storage).
 * - Will NOT work for other people/devices until Phase 2 (backend storage).
 *
 * @param projectId - The project ID to publish
 * @returns The publish result with URL and warning message
 * @throws {Error} If projectId is empty or invalid
 */
export function generatePublishURL(projectId: string): PublishURLResult {
  if (!projectId || !projectId.trim()) {
    throw new Error('Project ID is required to generate a publish URL');
  }

  // URL-encode the project ID to handle special characters safely
  const encodedProjectId = encodeURIComponent(projectId.trim());

  return {
    url: `${window.location.origin}/published?projectId=${encodedProjectId}`,
    warning: 'Share this link to let others experience your simulation.',
  };
}

/**
 * Copy text to clipboard using modern Clipboard API with fallback.
 *
 * @param text - Text to copy
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern Clipboard API (preferred)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback: create temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('[publishUtils] Failed to copy to clipboard:', error);
    return false;
  }
}
