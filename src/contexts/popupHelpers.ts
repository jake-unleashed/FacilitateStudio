/**
 * Popup Helper Functions
 *
 * Convenience functions for creating popup options.
 * Separated from PopupContext.tsx to allow fast refresh to work properly.
 */

import { PopupOptions } from './PopupContext';

/**
 * Helper to create error popup options
 */
export function createErrorPopup(title: string, message: string): PopupOptions {
  return { type: 'error', title, message };
}

/**
 * Helper to create warning popup options
 */
export function createWarningPopup(title: string, message: string): PopupOptions {
  return { type: 'warning', title, message };
}

/**
 * Helper to create info popup options
 */
export function createInfoPopup(title: string, message: string): PopupOptions {
  return { type: 'info', title, message };
}

/**
 * Helper to create success popup options
 */
export function createSuccessPopup(title: string, message: string): PopupOptions {
  return { type: 'success', title, message };
}
