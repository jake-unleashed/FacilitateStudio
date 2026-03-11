import { useEffect, useMemo, useRef } from 'react';
import type CameraControlsImpl from 'camera-controls';
import type { MutableRefObject } from 'react';
import type { SceneObject, SimStep } from '../types';
import { getEffectiveSimulationSettings, type SimulationSettings } from '../types/simulationSettings';
import { frameShowcaseObjects, getShowcaseObjects } from '../utils/showcaseCamera';
import { hasUsableSteps } from '../utils/stepValidation';
import { logger } from '../utils/logger';

interface UseShowcasePresentationArgs {
  objects: SceneObject[];
  steps: SimStep[];
  simulationSettings?: Partial<SimulationSettings> | null;
}

interface UseShowcasePresentationResult {
  showcaseObjects: SceneObject[];
  isShowcaseMode: boolean;
  effectiveSimulationSettings: SimulationSettings;
}

/**
 * Resolves whether a set of objects/steps should be presented as a showcase and
 * returns the effective trainee controls for that mode.
 */
export function useShowcasePresentation({
  objects,
  steps,
  simulationSettings,
}: UseShowcasePresentationArgs): UseShowcasePresentationResult {
  const showcaseObjects = useMemo(() => getShowcaseObjects(objects), [objects]);
  const isShowcaseMode = useMemo(
    () => showcaseObjects.length > 0 && !hasUsableSteps(steps),
    [showcaseObjects, steps]
  );
  const effectiveSimulationSettings = useMemo(
    () => getEffectiveSimulationSettings(simulationSettings, { showcaseMode: isShowcaseMode }),
    [isShowcaseMode, simulationSettings]
  );

  return {
    showcaseObjects,
    isShowcaseMode,
    effectiveSimulationSettings,
  };
}

interface UseShowcaseCameraFramingArgs {
  ready: boolean;
  showcaseObjects: SceneObject[];
  isShowcaseMode: boolean;
  controlsRef: MutableRefObject<CameraControlsImpl | null>;
  resetKey: string | null | undefined;
  logScope: string;
}

/**
 * Frames showcase content once after the scene and camera controls are ready.
 * Re-runs when the provided reset key changes (for example, a new project or token).
 */
export function useShowcaseCameraFraming({
  ready,
  showcaseObjects,
  isShowcaseMode,
  controlsRef,
  resetKey,
  logScope,
}: UseShowcaseCameraFramingArgs): void {
  const hasFramedRef = useRef(false);

  useEffect(() => {
    hasFramedRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (!ready || !isShowcaseMode || hasFramedRef.current) return;

    const controls = controlsRef.current;
    if (!controls || showcaseObjects.length === 0) return;

    let isCancelled = false;
    hasFramedRef.current = true;

    void frameShowcaseObjects(controls, showcaseObjects).catch((error) => {
      if (isCancelled) return;
      hasFramedRef.current = false;
      logger.warn(`[${logScope}] Failed to frame showcase scene:`, error);
    });

    return () => {
      isCancelled = true;
    };
  }, [controlsRef, isShowcaseMode, logScope, ready, showcaseObjects]);
}
