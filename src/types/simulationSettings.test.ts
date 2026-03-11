import { describe, expect, it } from 'vitest';
import { getEffectiveSimulationSettings, toSimulationSettings } from './simulationSettings';

describe('simulationSettings', () => {
  it('defaults showcase controls on when showcase mode is active and settings are unconfigured', () => {
    expect(getEffectiveSimulationSettings(undefined, { showcaseMode: true })).toEqual({
      allowOrbit: true,
      allowZoom: true,
      showcaseControlsConfigured: undefined,
    });
  });

  it('respects explicit showcase control configuration', () => {
    expect(
      getEffectiveSimulationSettings(
        {
          allowOrbit: false,
          allowZoom: true,
          showcaseControlsConfigured: true,
        },
        { showcaseMode: true }
      )
    ).toEqual({
      allowOrbit: false,
      allowZoom: true,
      showcaseControlsConfigured: true,
    });
  });

  it('preserves the showcase configuration marker during normalization', () => {
    expect(
      toSimulationSettings({
        allowOrbit: false,
        allowZoom: false,
        showcaseControlsConfigured: true,
      })
    ).toEqual({
      allowOrbit: false,
      allowZoom: false,
      showcaseControlsConfigured: true,
    });
  });
});
