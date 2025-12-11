import { describe, it, expect } from 'vitest';
import { INITIAL_OBJECTS, INITIAL_STEPS, OBJECT_ICONS } from './constants';

describe('Constants', () => {
  describe('INITIAL_OBJECTS', () => {
    it('should be an empty array for a fresh project', () => {
      expect(INITIAL_OBJECTS).toEqual([]);
    });

    it('should be an array', () => {
      expect(Array.isArray(INITIAL_OBJECTS)).toBe(true);
    });
  });

  describe('INITIAL_STEPS', () => {
    it('should be an empty array for a fresh project', () => {
      expect(INITIAL_STEPS).toEqual([]);
    });

    it('should be an array', () => {
      expect(Array.isArray(INITIAL_STEPS)).toBe(true);
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
