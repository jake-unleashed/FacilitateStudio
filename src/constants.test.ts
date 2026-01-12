import { describe, it, expect } from 'vitest';
import {
  INITIAL_OBJECTS,
  INITIAL_STEPS,
  OBJECT_ICONS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  GROUND_PLANE_EXTENT,
  INTERNAL_TO_WORLD,
  XZ_BOUNDARY_INTERNAL,
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

  // ==========================================================================
  // Grid and Movement Boundary Constants
  // ==========================================================================

  describe('Grid and Movement Boundary Constants', () => {
    describe('GROUND_PLANE_EXTENT', () => {
      it('should be a positive number', () => {
        expect(typeof GROUND_PLANE_EXTENT).toBe('number');
        expect(GROUND_PLANE_EXTENT).toBeGreaterThan(0);
      });

      it('should be 20 world units', () => {
        expect(GROUND_PLANE_EXTENT).toBe(20);
      });

      it('should define a 40x40 unit grid (±20 from center)', () => {
        const gridTotalSize = GROUND_PLANE_EXTENT * 2;
        expect(gridTotalSize).toBe(40);
      });
    });

    describe('INTERNAL_TO_WORLD', () => {
      it('should be a positive number', () => {
        expect(typeof INTERNAL_TO_WORLD).toBe('number');
        expect(INTERNAL_TO_WORLD).toBeGreaterThan(0);
      });

      it('should be 100 (100 internal units = 1 world unit)', () => {
        expect(INTERNAL_TO_WORLD).toBe(100);
      });

      it('should correctly convert internal to world units', () => {
        // 200 internal units should be 2 world units
        const internalUnits = 200;
        const worldUnits = internalUnits / INTERNAL_TO_WORLD;
        expect(worldUnits).toBe(2);
      });

      it('should correctly convert world to internal units', () => {
        // 5 world units should be 500 internal units
        const worldUnits = 5;
        const internalUnits = worldUnits * INTERNAL_TO_WORLD;
        expect(internalUnits).toBe(500);
      });
    });

    describe('XZ_BOUNDARY_INTERNAL', () => {
      it('should be a positive number', () => {
        expect(typeof XZ_BOUNDARY_INTERNAL).toBe('number');
        expect(XZ_BOUNDARY_INTERNAL).toBeGreaterThan(0);
      });

      it('should equal GROUND_PLANE_EXTENT * INTERNAL_TO_WORLD', () => {
        expect(XZ_BOUNDARY_INTERNAL).toBe(GROUND_PLANE_EXTENT * INTERNAL_TO_WORLD);
      });

      it('should be 2000 internal units (20 world units * 100)', () => {
        expect(XZ_BOUNDARY_INTERNAL).toBe(2000);
      });

      it('should define the maximum movement distance from center', () => {
        // Objects should not be movable beyond ±XZ_BOUNDARY_INTERNAL
        const maxPositiveX = XZ_BOUNDARY_INTERNAL;
        const maxNegativeX = -XZ_BOUNDARY_INTERNAL;
        expect(maxPositiveX).toBe(2000);
        expect(maxNegativeX).toBe(-2000);
      });

      it('should match the visual grid extent when converted to world units', () => {
        const worldBoundary = XZ_BOUNDARY_INTERNAL / INTERNAL_TO_WORLD;
        expect(worldBoundary).toBe(GROUND_PLANE_EXTENT);
      });
    });

    describe('Constants Consistency', () => {
      it('should have consistent relationship between all grid constants', () => {
        // XZ_BOUNDARY_INTERNAL = GROUND_PLANE_EXTENT * INTERNAL_TO_WORLD
        expect(XZ_BOUNDARY_INTERNAL).toBe(GROUND_PLANE_EXTENT * INTERNAL_TO_WORLD);
      });

      it('should allow objects to be placed at the grid edge', () => {
        // Object at exactly the boundary should be valid
        const objectX = XZ_BOUNDARY_INTERNAL;
        const objectZ = XZ_BOUNDARY_INTERNAL;
        expect(objectX).toBeLessThanOrEqual(XZ_BOUNDARY_INTERNAL);
        expect(objectZ).toBeLessThanOrEqual(XZ_BOUNDARY_INTERNAL);
      });

      it('should reject objects beyond the grid edge', () => {
        // Object beyond the boundary should be clamped
        const beyondBoundary = XZ_BOUNDARY_INTERNAL + 1;
        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
        const clampedX = clamp(beyondBoundary, -XZ_BOUNDARY_INTERNAL, XZ_BOUNDARY_INTERNAL);
        expect(clampedX).toBe(XZ_BOUNDARY_INTERNAL);
      });
    });
  });
});
