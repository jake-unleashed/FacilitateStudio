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
