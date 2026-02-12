import type { PublishURLResult } from '../types/publish';
import type { Project } from '../types/project';
import { publishProject } from '../services/publishService';

/**
 * Generate a backend-backed publish URL for a project.
 *
 * @param project - The project to publish
 * @param userId - Authenticated user ID
 * @returns The publish result with URL and share token
 * @throws {Error} If project/userId is empty or invalid
 */
export async function generatePublishURL(project: Project, userId: string): Promise<PublishURLResult> {
  if (!project.id || !project.id.trim()) {
    throw new Error('Project ID is required to generate a publish URL');
  }
  if (!userId || !userId.trim()) {
    throw new Error('Authenticated user ID is required to generate a publish URL');
  }

  return publishProject(project, userId.trim());
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
