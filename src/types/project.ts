import { SceneObject, SimStep } from '../types';
import type { SimulationSettings } from './simulationSettings';

/**
 * Represents a saved project/simulation in Facilitate Studio.
 */
export interface Project {
  /** Unique identifier for the project */
  id: string;
  /** User-defined project name */
  name: string;
  /** ISO timestamp of when the project was created */
  createdAt: string;
  /** ISO timestamp of when the project was last modified */
  updatedAt: string;
  /**
   * Optional thumbnail reference.
   *
   * Allowed forms:
   * - Base64 data URL (local-only, e.g. `data:image/jpeg;base64,...`)
   * - Storage reference (persisted, e.g. `thumb://{userId}/{projectId}.jpg`)
   */
  thumbnail?: string;
  /** All scene objects in the project */
  objects: SceneObject[];
  /** Simulation steps */
  steps: SimStep[];
  /** Trainee interaction settings used in preview and published modes */
  simulationSettings?: SimulationSettings;
}

/**
 * Metadata for displaying projects in the library view.
 * Excludes heavy data like objects for performance.
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}
