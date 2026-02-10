/**
 * HelpIcon Component
 *
 * A reusable help icon with hover tooltip.
 * Shows a "?" icon that reveals explanatory text on hover/focus.
 */

import React, { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

export interface HelpIconProps {
  /** The help text to display in the tooltip */
  content: string;
  /** Optional additional CSS classes for the icon wrapper */
  className?: string;
  /** Optional aria-label (defaults to "Help") */
  ariaLabel?: string;
}

/**
 * HelpIcon - displays a small "?" icon with a hover tooltip
 *
 * Features:
 * - Consistent styling across the app
 * - Portal-based tooltip positioned above the icon
 * - Keyboard accessible (shows on focus, dismisses on Escape)
 * - ARIA compliant with proper associations
 */
export const HelpIcon = memo<HelpIconProps>(({ content, className = '', ariaLabel = 'Help' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showTooltip]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowTooltip(false);
      iconRef.current?.blur();
    }
  }, []);

  return (
    <>
      <span
        ref={iconRef}
        className={`inline-flex cursor-help ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        aria-describedby={showTooltip ? tooltipId : undefined}
      >
        <HelpCircle size={12} className="text-slate-400" />
      </span>

      {showTooltip &&
        createPortal(
          <div
            id={tooltipId}
            className="pointer-events-none fixed z-[100] w-52 -translate-x-1/2 -translate-y-full rounded-lg border border-white/40 bg-slate-800/95 px-3 py-2 text-center text-xs leading-relaxed text-white shadow-lg backdrop-blur-sm"
            style={{ top: position.top, left: position.left }}
            role="tooltip"
          >
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/40 bg-slate-800/95" />
            {content}
          </div>,
          document.body
        )}
    </>
  );
});

HelpIcon.displayName = 'HelpIcon';
