/**
 * PopupContext
 *
 * Global context for displaying dismissible popups/modals throughout the app.
 * Provides a standardized way to show errors, warnings, info, and success messages
 * that appear centered on screen and persist until dismissed.
 *
 * Usage:
 *   const { showPopup, dismissPopup } = usePopup();
 *   showPopup({ type: 'error', title: 'Upload Failed', message: 'File is too large' });
 */

/* eslint-disable react-refresh/only-export-components */
// Disabled: This file exports both PopupProvider (component) and usePopup (hook).
// Co-locating hooks with their context is the standard React pattern.
// Helper functions are in popupHelpers.ts but re-exported here for convenience.

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// =============================================================================
// Types
// =============================================================================

/** Popup types with associated styling */
export type PopupType = 'error' | 'warning' | 'info' | 'success';

/** Options for displaying a popup */
export interface PopupOptions {
  /** The type of popup - determines icon and color scheme */
  type: PopupType;
  /** Bold title displayed at the top of the popup */
  title: string;
  /** Detailed message content (can be multi-line, selectable for copying) */
  message: string;
}

/** Current popup state */
export interface PopupState extends PopupOptions {
  /** Unique ID for this popup instance */
  id: string;
}

/** Context value exposed to consumers */
interface PopupContextValue {
  /** Currently displayed popup (null if none) */
  popup: PopupState | null;
  /** Display a new popup (replaces any existing popup) */
  showPopup: (options: PopupOptions) => void;
  /** Dismiss the current popup */
  dismissPopup: () => void;
}

// =============================================================================
// Context
// =============================================================================

const PopupContext = createContext<PopupContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface PopupProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages global popup state.
 * Wrap your app (or page) with this to enable popup functionality.
 */
export const PopupProvider: React.FC<PopupProviderProps> = ({ children }) => {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const showPopup = useCallback((options: PopupOptions) => {
    const id = `popup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setPopup({ ...options, id });
  }, []);

  const dismissPopup = useCallback(() => {
    setPopup(null);
  }, []);

  return (
    <PopupContext.Provider value={{ popup, showPopup, dismissPopup }}>
      {children}
    </PopupContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access popup functionality from any component.
 * Must be used within a PopupProvider.
 */
export function usePopup(): PopupContextValue {
  const context = useContext(PopupContext);

  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }

  return context;
}

// =============================================================================
// Re-export Convenience Functions
// =============================================================================
// Helper functions are in a separate file to allow fast refresh to work properly.
// Re-exported here for backward compatibility.

export {
  createErrorPopup,
  createWarningPopup,
  createInfoPopup,
  createSuccessPopup,
} from './popupHelpers';
