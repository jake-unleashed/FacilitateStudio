import { describe, it, expect } from 'vitest';
import {
  INITIAL_OBJECTS,
  INITIAL_STEPS,
  OBJECT_ICONS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from './constants';

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

  describe('Camera Constants', () => {
    describe('DEFAULT_CAMERA_POSITION', () => {
      it('should be a tuple of 3 numbers', () => {
        expect(DEFAULT_CAMERA_POSITION).toHaveLength(3);
        expect(typeof DEFAULT_CAMERA_POSITION[0]).toBe('number');
        expect(typeof DEFAULT_CAMERA_POSITION[1]).toBe('number');
        expect(typeof DEFAULT_CAMERA_POSITION[2]).toBe('number');
      });

      it('should have expected default values', () => {
        expect(DEFAULT_CAMERA_POSITION).toEqual([12, 8, 12]);
      });

      it('should position camera above and away from origin', () => {
        const [x, y, z] = DEFAULT_CAMERA_POSITION;
        expect(x).toBeGreaterThan(0); // Positive X
        expect(y).toBeGreaterThan(0); // Above ground
        expect(z).toBeGreaterThan(0); // Positive Z
      });
    });

    describe('DEFAULT_CAMERA_TARGET', () => {
      it('should be a tuple of 3 numbers', () => {
        expect(DEFAULT_CAMERA_TARGET).toHaveLength(3);
        expect(typeof DEFAULT_CAMERA_TARGET[0]).toBe('number');
        expect(typeof DEFAULT_CAMERA_TARGET[1]).toBe('number');
        expect(typeof DEFAULT_CAMERA_TARGET[2]).toBe('number');
      });

      it('should target the origin', () => {
        expect(DEFAULT_CAMERA_TARGET).toEqual([0, 0, 0]);
      });
    });
  });
});
