export type ToolType = 'select' | 'move' | 'rotate' | 'scale';

export interface Transform {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

export interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'zone' | 'text-popup' | 'wire';
  icon?: string;
  transform: Transform;
  properties: {
    visible: boolean;
    grabbable?: boolean;
    hasGravity?: boolean;
    locked?: boolean;
    color?: string;
  };
}

export interface SimStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export type SidebarSection = 'add' | 'steps' | 'scenes' | 'objects';
