import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../types/project';

interface UseEntryFadeArgs {
  currentProject: Project | null;
  isInitialized: boolean;
  currentProjectId: string | null;
}

interface UseEntryFadeResult {
  hasFirstFrame: boolean;
  setHasFirstFrame: (value: boolean) => void;
  isEntryFadeVisible: boolean;
  isEntryFadeFading: boolean;
  isEntryTransitionDone: boolean;
}

export function useEntryFade(args: UseEntryFadeArgs): UseEntryFadeResult {
  const { currentProject, isInitialized, currentProjectId } = args;

  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [isEntryFadeVisible, setIsEntryFadeVisible] = useState(false);
  const [isEntryFadeFading, setIsEntryFadeFading] = useState(false);
  const [isEntryTransitionDone, setIsEntryTransitionDone] = useState(true);
  const entryFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryFadeStartedAtRef = useRef<number | null>(null);
  const entryFadeCompletedRef = useRef(false);

  useEffect(() => {
    const isNewProject =
      !!currentProject && currentProject.objects.length === 0 && currentProject.steps.length === 0;
    if (!isInitialized || !isNewProject) {
      setIsEntryFadeVisible(false);
      setIsEntryFadeFading(false);
      setIsEntryTransitionDone(true);
      entryFadeCompletedRef.current = false;
      return;
    }

    if (entryFadeCompletedRef.current) return;

    if (!isEntryFadeVisible) {
      setIsEntryFadeVisible(true);
      setIsEntryFadeFading(false);
      setIsEntryTransitionDone(false);
      entryFadeStartedAtRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    if (!hasFirstFrame) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setIsEntryFadeVisible(false);
      setIsEntryFadeFading(false);
      setIsEntryTransitionDone(true);
      entryFadeCompletedRef.current = true;
      if (entryFadeTimerRef.current) {
        clearTimeout(entryFadeTimerRef.current);
        entryFadeTimerRef.current = null;
      }
      return;
    }

    const minVisibleMs = 200;
    const fadeMs = 380;
    const startedAt =
      entryFadeStartedAtRef.current ??
      (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = Math.max(0, now - startedAt);
    const remaining = Math.max(0, minVisibleMs - elapsed);

    if (entryFadeTimerRef.current) {
      clearTimeout(entryFadeTimerRef.current);
      entryFadeTimerRef.current = null;
    }

    entryFadeTimerRef.current = setTimeout(() => {
      setIsEntryFadeFading(true);
      entryFadeTimerRef.current = setTimeout(() => {
        setIsEntryFadeVisible(false);
        setIsEntryFadeFading(false);
        setIsEntryTransitionDone(true);
        entryFadeCompletedRef.current = true;
        entryFadeTimerRef.current = null;
      }, fadeMs);
    }, remaining);
  }, [currentProject, hasFirstFrame, isEntryFadeVisible, isInitialized]);

  useEffect(() => {
    setHasFirstFrame(false);
    entryFadeCompletedRef.current = false;
    entryFadeStartedAtRef.current = null;
    setIsEntryFadeVisible(false);
    setIsEntryFadeFading(false);
    setIsEntryTransitionDone(true);
    if (entryFadeTimerRef.current) {
      clearTimeout(entryFadeTimerRef.current);
      entryFadeTimerRef.current = null;
    }
  }, [currentProjectId]);

  useEffect(() => {
    return () => {
      if (entryFadeTimerRef.current) clearTimeout(entryFadeTimerRef.current);
    };
  }, []);

  return {
    hasFirstFrame,
    setHasFirstFrame,
    isEntryFadeVisible,
    isEntryFadeFading,
    isEntryTransitionDone,
  };
}
