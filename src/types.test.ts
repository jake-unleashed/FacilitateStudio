import { describe, it, expect } from 'vitest';
import type { Transform, SceneObject, SimStep, SidebarSection, ToolType } from './types';

describe('Types', () => {
  describe('Transform', () => {
    it('should have correct structure', () => {
      const transform: Transform = {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      };
      expect(transform).toBeDefined();
      expect(transform.x).toBe(0);
      expect(transform.scaleX).toBe(1);
    });
  });

  describe('SceneObject', () => {
    it('should have correct structure', () => {
      const object: SceneObject = {
        id: 'test-1',
        name: 'Test Object',
        type: 'mesh',
        transform: {
          x: 0,
          y: 0,
          z: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        },
        properties: {
          visible: true,
          grabbable: true,
          hasGravity: false,
          color: '#ff0000',
        },
      };
      expect(object.id).toBe('test-1');
      expect(object.type).toBe('mesh');
      expect(object.properties.visible).toBe(true);
    });

    it('should support all object types', () => {
      const types: SceneObject['type'][] = [
        'mesh',
        'light',
        'camera',
        'zone',
        'text-popup',
        'wire',
      ];
      types.forEach((type) => {
        const obj: SceneObject = {
          id: `test-${type}`,
          name: `Test ${type}`,
          type,
          transform: {
            x: 0,
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
          },
          properties: { visible: true },
        };
        expect(obj.type).toBe(type);
      });
    });
  });

  describe('SimStep', () => {
    it('should have correct structure', () => {
      const step: SimStep = {
        id: 'step-1',
        title: 'Test Step',
        description: 'A test step description',
        completed: false,
      };
      expect(step.id).toBe('step-1');
      expect(step.completed).toBe(false);
    });
  });

  describe('SidebarSection', () => {
    it('should support all sidebar sections', () => {
      const sections: SidebarSection[] = ['add', 'steps', 'scenes', 'objects'];
      expect(sections).toHaveLength(4);
    });
  });

  describe('ToolType', () => {
    it('should support all tool types', () => {
      const tools: ToolType[] = ['select', 'move', 'rotate', 'scale'];
      expect(tools).toHaveLength(4);
    });
  });
});
