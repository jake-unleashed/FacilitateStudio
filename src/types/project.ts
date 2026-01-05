import { SceneObject, SimStep } from '../types';

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
  /** Optional base64 thumbnail image (future feature) */
  thumbnail?: string;
  /** All scene objects in the project */
  objects: SceneObject[];
  /** Simulation steps */
  steps: SimStep[];
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
