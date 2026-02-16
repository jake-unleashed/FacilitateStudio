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

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { usePopup, PopupType } from '../contexts/PopupContext';
import { useLatestRef } from '../hooks/useLatestRef';

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

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const tabIndex = el.getAttribute('tabindex');
    if (tabIndex === '-1') return false;
    return true;
  });
}

export const GlobalPopup: React.FC = () => {
  const { popup, dismissPopup } = usePopup();

  // Track exit animation state
  const [isExiting, setIsExiting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const okButtonRef = useRef<HTMLButtonElement>(null);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Handle dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
    dismissTimeoutRef.current = setTimeout(() => {
      dismissTimeoutRef.current = null;
      setIsExiting(false);
      dismissPopup();
    }, ANIMATION_DURATION);
  }, [dismissPopup]);
  const handleDismissRef = useLatestRef(handleDismiss);

  // Reset exiting state when popup changes
  useEffect(() => {
    if (popup) {
      setIsExiting(false);
    }
  }, [popup]);

  // Focus management + focus trap + Escape.
  useEffect(() => {
    if (!popup) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = setTimeout(() => {
      okButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismissRef.current();
        return;
      }

      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const active = document.activeElement;
      const currentIndex = active ? focusables.indexOf(active as HTMLElement) : -1;

      if (currentIndex === -1) {
        e.preventDefault();
        (e.shiftKey ? focusables[focusables.length - 1] : focusables[0]).focus();
        return;
      }

      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + focusables.length) % focusables.length
        : (currentIndex + 1) % focusables.length;

      e.preventDefault();
      focusables[nextIndex].focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);

      // Ensure we don't set state after unmount.
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }

      const toRestore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      setTimeout(() => {
        toRestore?.focus?.();
      }, 0);
    };
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
        ref={dialogRef}
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
            ref={okButtonRef}
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
