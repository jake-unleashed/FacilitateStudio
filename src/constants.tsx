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
