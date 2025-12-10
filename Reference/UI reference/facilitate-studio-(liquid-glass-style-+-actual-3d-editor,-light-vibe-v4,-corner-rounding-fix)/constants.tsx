import { SceneObject, SimStep } from './types';
import { Box, Camera, Lightbulb, MapPin, MessageSquareText, Cable } from 'lucide-react';

export const INITIAL_OBJECTS: SceneObject[] = [
  {
    id: 'obj-1',
    name: 'Primary Cube',
    type: 'mesh',
    transform: { x: -200, y: 50, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    properties: { visible: true, grabbable: true, hasGravity: true, color: '#3b82f6' }
  },
  {
    id: 'obj-2',
    name: 'Accent Block',
    type: 'mesh',
    transform: { x: 200, y: 50, z: -150, rotationX: 0, rotationY: 45, rotationZ: 0, scaleX: 1.2, scaleY: 1.2, scaleZ: 1.2 },
    properties: { visible: true, grabbable: false, hasGravity: true, color: '#eab308' }
  },
  {
    id: 'obj-4',
    name: 'Module Alpha',
    type: 'mesh',
    transform: { x: 0, y: 50, z: 200, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    properties: { visible: true, locked: false, color: '#a855f7' }
  }
];

export const INITIAL_STEPS: SimStep[] = [
  { id: 'step-1', title: 'Initialize System', description: 'Locate and verify power supply.', completed: true },
  { id: 'step-2', title: 'Safety Check', description: 'Ensure all safety barriers are in place.', completed: false },
  { id: 'step-3', title: 'Activate Pump', description: 'Turn on the main industrial pump.', completed: false },
  { id: 'step-4', title: 'Monitor Pressure', description: 'Wait for pressure to stabilize.', completed: false },
];

export const OBJECT_ICONS: Record<string, any> = {
  mesh: Box,
  camera: Camera,
  light: Lightbulb,
  zone: MapPin,
  'text-popup': MessageSquareText,
  wire: Cable
};