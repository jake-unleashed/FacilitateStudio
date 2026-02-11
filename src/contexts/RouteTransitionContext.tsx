import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NavigateOptions, To } from 'react-router-dom';

interface RouteTransitionContextValue {
  transitionTo: (to: To, options?: NavigateOptions) => Promise<void>;
}

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null);

const FADE_DURATION_MS = 500;
const PRE_NAV_DELAY_MS = 250;

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function RouteTransitionProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(false);
  const [opacity, setOpacity] = useState<0 | 100>(0);
  const tokenRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

  const transitionTo = useCallback(
    async (to: To, options?: NavigateOptions) => {
      const prefersReducedMotion = getPrefersReducedMotion();
      if (prefersReducedMotion) {
        navigate(to, options);
        return;
      }

      const token = ++tokenRef.current;
      clearHideTimer();

      // Fade to opaque (outgoing)
      setIsVisible(true);
      setOpacity(0);
      await nextFrame();
      if (tokenRef.current !== token) return;
      setOpacity(100);

      // Give the fade a moment to feel intentional before routing.
      await sleep(PRE_NAV_DELAY_MS);
      if (tokenRef.current !== token) return;
      navigate(to, options);

      // Fade back out (incoming). Let the new route paint first.
      await nextFrame();
      if (tokenRef.current !== token) return;
      setOpacity(0);
      hideTimerRef.current = setTimeout(() => {
        if (tokenRef.current !== token) return;
        setIsVisible(false);
        hideTimerRef.current = null;
      }, FADE_DURATION_MS);
    },
    [clearHideTimer, navigate]
  );

  const value = useMemo<RouteTransitionContextValue>(() => ({ transitionTo }), [transitionTo]);

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}

      {isVisible && (
        <div
          className={`fixed inset-0 z-[1000] transition-opacity duration-500 ease-out ${
            opacity === 100 ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-slate-100" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]" />
        </div>
      )}
    </RouteTransitionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRouteTransition(): RouteTransitionContextValue {
  const navigate = useNavigate();
  const ctx = useContext(RouteTransitionContext);
  return useMemo<RouteTransitionContextValue>(() => {
    // Fallback for tests or isolated renders: behave like normal navigation without animation.
    if (!ctx) {
      return {
        transitionTo: async (to: To, options?: NavigateOptions) => {
          navigate(to, options);
        },
      };
    }
    return ctx;
  }, [ctx, navigate]);
}

