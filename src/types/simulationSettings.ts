export interface SimulationSettings {
  allowOrbit: boolean;
  allowZoom: boolean;
}

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  allowOrbit: false,
  allowZoom: false,
};

export function toSimulationSettings(
  value?: Partial<SimulationSettings> | null
): SimulationSettings {
  return {
    allowOrbit: value?.allowOrbit ?? DEFAULT_SIMULATION_SETTINGS.allowOrbit,
    allowZoom: value?.allowZoom ?? DEFAULT_SIMULATION_SETTINGS.allowZoom,
  };
}
