/**
 * useTooltip Hook
 *
 * Manages tooltip visibility with hover delay and click behavior.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { UseTooltipReturn } from './types';
import { TOOLTIP_HOVER_DELAY, TOOLTIP_CLICK_DURATION } from './constants';

/**
 * Hook for managing tooltip visibility with hover delay and click behavior
 */
export function useTooltip(hoverText: string, isDragging: boolean): UseTooltipReturn {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipText, setTooltipText] = useState('');

  const hoverTimeoutRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handlePointerEnter = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!isDragging) {
        setTooltipText(hoverText);
        setShowTooltip(true);
      }
    }, TOOLTIP_HOVER_DELAY);
  }, [hoverText, isDragging]);

  const handlePointerLeave = useCallback(() => {
    setShowTooltip(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const showClickTooltip = useCallback((text: string) => {
    setTooltipText(text);
    setShowTooltip(true);
    clickTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
    }, TOOLTIP_CLICK_DURATION);
  }, []);

  const hideTooltip = useCallback(() => {
    setShowTooltip(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  return {
    showTooltip,
    tooltipText,
    handlePointerEnter,
    handlePointerLeave,
    showClickTooltip,
    hideTooltip,
  };
}
