import type { SceneObject, SimStep } from '../../types';
import type { SceneSettings } from '../../types/sceneSettings';
import { toSceneSettings } from '../../types/sceneSettings';
import type { SimulationSettings } from '../../types/simulationSettings';
import { toSimulationSettings } from '../../types/simulationSettings';

export interface SaveDataSnapshot {
  name: string;
  objects: SceneObject[];
  steps: SimStep[];
  sceneSettings?: SceneSettings;
  simulationSettings?: SimulationSettings;
}

/**
 * Pre-serialized snapshot for efficient comparisons.
 *
 * We store the JSON strings so we don't repeatedly `JSON.stringify` the saved baseline
 * when checking for dirty state.
 */
export interface SerializedSnapshot {
  name: string;
  objectsLen: number;
  stepsLen: number;
  objectsJson: string;
  stepsJson: string;
  sceneSettingsJson: string;
  simulationSettingsJson: string;
}

export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : 'Unknown save error');
}

export function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function serializeSnapshot(data: SaveDataSnapshot): SerializedSnapshot {
  const sceneSettings = toSceneSettings(data.sceneSettings);
  const simulationSettings = toSimulationSettings(data.simulationSettings);
  return {
    name: data.name,
    objectsLen: data.objects.length,
    stepsLen: data.steps.length,
    objectsJson: JSON.stringify(data.objects),
    stepsJson: JSON.stringify(data.steps),
    sceneSettingsJson: JSON.stringify(sceneSettings),
    simulationSettingsJson: JSON.stringify(simulationSettings),
  };
}

export function hasSerializedChanged(current: SerializedSnapshot, saved: SerializedSnapshot | null): boolean {
  if (!saved) return false; // No baseline yet
  if (current.name !== saved.name) return true;
  if (current.objectsLen !== saved.objectsLen) return true;
  if (current.stepsLen !== saved.stepsLen) return true;
  if (current.objectsJson !== saved.objectsJson) return true;
  if (current.stepsJson !== saved.stepsJson) return true;
  if (current.sceneSettingsJson !== saved.sceneSettingsJson) return true;
  if (current.simulationSettingsJson !== saved.simulationSettingsJson) return true;
  return false;
}

