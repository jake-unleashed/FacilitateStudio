import { SceneObject, SimStep } from './types';
import { Box, Camera, Lightbulb, MapPin, MessageSquareText, Cable, LucideIcon } from 'lucide-react';

export const INITIAL_OBJECTS: SceneObject[] = [];

export const INITIAL_STEPS: SimStep[] = [];

export const OBJECT_ICONS: Record<string, LucideIcon> = {
  mesh: Box,
  camera: Camera,
  light: Lightbulb,
  zone: MapPin,
  'text-popup': MessageSquareText,
  wire: Cable,
};

// Camera default position and target for 3D navigation
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [12, 8, 12];
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

// Model preprocessing constants
export const MODEL_TARGET_SIZE = 2.0; // Max dimension in scene units (comfortable viewing size)
export const MODEL_MIN_SIZE = 0.1; // Minimum size to prevent invisible models
export const MODEL_MAX_SIZE = 10.0; // Maximum size before warning
export const MODEL_COMPLEXITY_WARNING_THRESHOLD = 100000; // Triangle count for performance warning
export const MODEL_POSITION_SPACING = 3.0; // Spacing between models when adding multiple
export const MODEL_CAMERA_DISTANCE_MULTIPLIER = 2.5; // Multiplier for camera distance based on model size
