export interface SimulationSettings {
  allowOrbit: boolean;
  allowZoom: boolean;
  /**
   * Indicates the creator has explicitly configured showcase-mode controls.
   * When absent, zero-step showcase flows can fall back to friendlier defaults.
   */
  showcaseControlsConfigured?: boolean;
}

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  allowOrbit: false,
  allowZoom: false,
};

/**
 * Normalizes persisted simulation settings so the runtime always has booleans for
 * orbit/zoom while preserving optional showcase metadata.
 */
export function toSimulationSettings(
  value?: Partial<SimulationSettings> | null
): SimulationSettings {
  return {
    allowOrbit: value?.allowOrbit ?? DEFAULT_SIMULATION_SETTINGS.allowOrbit,
    allowZoom: value?.allowZoom ?? DEFAULT_SIMULATION_SETTINGS.allowZoom,
    showcaseControlsConfigured: value?.showcaseControlsConfigured,
  };
}

/**
 * Resolves the runtime trainee controls for a scene, including the friendlier
 * defaults used by zero-step showcase mode before creators explicitly configure it.
 */
export function getEffectiveSimulationSettings(
  value?: Partial<SimulationSettings> | null,
  options?: { showcaseMode?: boolean }
): SimulationSettings {
  const normalized = toSimulationSettings(value);
  if (!options?.showcaseMode || normalized.showcaseControlsConfigured) {
    return normalized;
  }

  return {
    ...normalized,
    allowOrbit: true,
    allowZoom: true,
  };
}
