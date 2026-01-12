/**
 * GlobalPopup Component
 *
 * A global, dismissible popup that displays centered on screen.
 * Used for errors, warnings, info, and success messages throughout the app.
 *
 * Features:
 * - Centered on screen with semi-transparent backdrop
 * - Persists until explicitly dismissed (no auto-dismiss)
 * - Supports multiple types with appropriate styling
 * - Message text is selectable for copying
 * - Accessible with proper ARIA attributes
 */

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { usePopup, PopupType } from '../contexts/PopupContext';

// =============================================================================
// Constants
// =============================================================================

/** Animation duration for enter/exit in ms */
const ANIMATION_DURATION = 200;

/** Configuration for each popup type */
const POPUP_TYPE_CONFIG: Record<
  PopupType,
  {
    icon: typeof AlertCircle;
    iconColor: string;
    borderColor: string;
    titleColor: string;
    messageColor: string;
    shadowColor: string;
  }
> = {
  error: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    borderColor: 'border-red-200',
    titleColor: 'text-red-800',
    messageColor: 'text-red-600',
    shadowColor: 'shadow-red-500/10',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    borderColor: 'border-amber-200',
    titleColor: 'text-amber-800',
    messageColor: 'text-amber-600',
    shadowColor: 'shadow-amber-500/10',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-200',
    titleColor: 'text-blue-800',
    messageColor: 'text-blue-600',
    shadowColor: 'shadow-blue-500/10',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    borderColor: 'border-green-200',
    titleColor: 'text-green-800',
    messageColor: 'text-green-600',
    shadowColor: 'shadow-green-500/10',
  },
};

// =============================================================================
// Component
// =============================================================================

export const GlobalPopup: React.FC = () => {
  const { popup, dismissPopup } = usePopup();

  // Track exit animation state
  const [isExiting, setIsExiting] = useState(false);

  // Handle dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      dismissPopup();
    }, ANIMATION_DURATION);
  }, [dismissPopup]);

  // Reset exiting state when popup changes
  useEffect(() => {
    if (popup) {
      setIsExiting(false);
    }
  }, [popup]);

  // Don't render if no popup
  if (!popup) {
    return null;
  }

  // Use popup directly from context
  const currentPopup = popup;

  const config = POPUP_TYPE_CONFIG[currentPopup.type];
  const Icon = config.icon;

  return (
    <div
      className={`
        fixed inset-0 z-[100] flex items-center justify-center
        transition-opacity duration-200 ease-out
        ${isExiting ? 'opacity-0' : 'opacity-100'}
      `}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
      aria-describedby="popup-message"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

      {/* Popup Card */}
      <div
        className={`
          relative mx-4 w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl
          transition-all duration-200 ease-out
          ${config.borderColor} ${config.shadowColor}
          ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
        `}
      >
        {/* Content */}
        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 pt-0.5">
            <Icon size={24} className={config.iconColor} aria-hidden="true" />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <h2 id="popup-title" className={`text-lg font-semibold ${config.titleColor}`}>
              {currentPopup.title}
            </h2>
            <p
              id="popup-message"
              className={`mt-2 select-text text-sm leading-relaxed ${config.messageColor}`}
            >
              {currentPopup.message}
            </p>
          </div>
        </div>

        {/* OK Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleDismiss}
            className="rounded-lg bg-slate-800 px-8 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalPopup;
