import { describe, it, expect } from 'vitest';
import { INITIAL_OBJECTS, INITIAL_STEPS, OBJECT_ICONS } from './constants';

describe('Constants', () => {
  describe('INITIAL_OBJECTS', () => {
    it('should have at least one object', () => {
      expect(INITIAL_OBJECTS.length).toBeGreaterThan(0);
    });

    it('should have valid structure for each object', () => {
      INITIAL_OBJECTS.forEach((obj) => {
        expect(obj).toHaveProperty('id');
        expect(obj).toHaveProperty('name');
        expect(obj).toHaveProperty('type');
        expect(obj).toHaveProperty('transform');
        expect(obj).toHaveProperty('properties');
        expect(obj.properties).toHaveProperty('visible');
      });
    });

    it('should have unique IDs', () => {
      const ids = INITIAL_OBJECTS.map((obj) => obj.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid transform properties', () => {
      INITIAL_OBJECTS.forEach((obj) => {
        expect(typeof obj.transform.x).toBe('number');
        expect(typeof obj.transform.y).toBe('number');
        expect(typeof obj.transform.z).toBe('number');
        expect(typeof obj.transform.scaleX).toBe('number');
        expect(typeof obj.transform.scaleY).toBe('number');
        expect(typeof obj.transform.scaleZ).toBe('number');
      });
    });
  });

  describe('INITIAL_STEPS', () => {
    it('should have at least one step', () => {
      expect(INITIAL_STEPS.length).toBeGreaterThan(0);
    });

    it('should have valid structure for each step', () => {
      INITIAL_STEPS.forEach((step) => {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('completed');
        expect(typeof step.completed).toBe('boolean');
      });
    });

    it('should have unique IDs', () => {
      const ids = INITIAL_STEPS.map((step) => step.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have at least one completed step', () => {
      const completedSteps = INITIAL_STEPS.filter((step) => step.completed);
      expect(completedSteps.length).toBeGreaterThan(0);
    });
  });

  describe('OBJECT_ICONS', () => {
    it('should have icons for common object types', () => {
      expect(OBJECT_ICONS).toHaveProperty('mesh');
      expect(OBJECT_ICONS).toHaveProperty('camera');
      expect(OBJECT_ICONS).toHaveProperty('light');
      expect(OBJECT_ICONS).toHaveProperty('zone');
    });

    it('should have valid icon components', () => {
      Object.values(OBJECT_ICONS).forEach((icon) => {
        // Lucide icons are forwardRef components which are objects with $$typeof
        expect(icon).toBeDefined();
        expect(icon.$$typeof).toBeDefined();
      });
    });
  });
});
