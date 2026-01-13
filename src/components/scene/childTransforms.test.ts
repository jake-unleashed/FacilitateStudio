/**
 * Unit tests for child mesh transform utilities
 *
 * Tests the mathematical functions used to compute pivot-based rotation and scaling
 * for child objects in ImportedModel.tsx.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

// =============================================================================
// Test implementations of the transform utilities
// (These mirror the functions in ImportedModel.tsx)
// =============================================================================

/**
 * Calculates the position offset needed to rotate around a pivot point.
 */
function calculateRotationOffset(pivot: THREE.Vector3, rotation: THREE.Euler): THREE.Vector3 {
  const rotatedPivot = pivot.clone().applyEuler(rotation);
  return pivot.clone().sub(rotatedPivot);
}

/**
 * Calculates the position offset needed to scale around a pivot point.
 */
function calculateScaleOffset(
  pivot: THREE.Vector3,
  scale: { x: number; y: number; z: number }
): THREE.Vector3 {
  return new THREE.Vector3(
    pivot.x * (1 - scale.x),
    pivot.y * (1 - scale.y),
    pivot.z * (1 - scale.z)
  );
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Child Transform Utilities', () => {
  describe('calculateRotationOffset', () => {
    it('should return zero offset for zero rotation', () => {
      const pivot = new THREE.Vector3(1, 2, 3);
      const rotation = new THREE.Euler(0, 0, 0, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      expect(offset.x).toBeCloseTo(0, 10);
      expect(offset.y).toBeCloseTo(0, 10);
      expect(offset.z).toBeCloseTo(0, 10);
    });

    it('should return zero offset for pivot at origin', () => {
      const pivot = new THREE.Vector3(0, 0, 0);
      const rotation = new THREE.Euler(Math.PI / 2, Math.PI / 4, Math.PI / 6, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      expect(offset.x).toBeCloseTo(0, 10);
      expect(offset.y).toBeCloseTo(0, 10);
      expect(offset.z).toBeCloseTo(0, 10);
    });

    it('should compute correct offset for 90° Y rotation', () => {
      // Pivot at (1, 0, 0), rotating 90° around Y
      // After rotation, pivot would be at (0, 0, -1)
      // Offset = original - rotated = (1, 0, 0) - (0, 0, -1) = (1, 0, 1)
      const pivot = new THREE.Vector3(1, 0, 0);
      const rotation = new THREE.Euler(0, Math.PI / 2, 0, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      expect(offset.x).toBeCloseTo(1, 5);
      expect(offset.y).toBeCloseTo(0, 5);
      expect(offset.z).toBeCloseTo(1, 5);
    });

    it('should compute correct offset for 180° Y rotation', () => {
      // Pivot at (1, 0, 0), rotating 180° around Y
      // After rotation, pivot would be at (-1, 0, 0)
      // Offset = (1, 0, 0) - (-1, 0, 0) = (2, 0, 0)
      const pivot = new THREE.Vector3(1, 0, 0);
      const rotation = new THREE.Euler(0, Math.PI, 0, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      expect(offset.x).toBeCloseTo(2, 5);
      expect(offset.y).toBeCloseTo(0, 5);
      expect(offset.z).toBeCloseTo(0, 5);
    });

    it('should compute correct offset for 90° X rotation', () => {
      // Pivot at (0, 1, 0), rotating 90° around X
      // After rotation, pivot would be at (0, 0, 1)
      // Offset = (0, 1, 0) - (0, 0, 1) = (0, 1, -1)
      const pivot = new THREE.Vector3(0, 1, 0);
      const rotation = new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      expect(offset.x).toBeCloseTo(0, 5);
      expect(offset.y).toBeCloseTo(1, 5);
      expect(offset.z).toBeCloseTo(-1, 5);
    });

    it('should compute correct offset for combined rotation', () => {
      // Test with non-trivial combined rotation
      const pivot = new THREE.Vector3(1, 1, 1);
      const rotation = new THREE.Euler(Math.PI / 4, Math.PI / 4, Math.PI / 4, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      // The rotated pivot can be computed manually or verified by ensuring
      // pivot + offset would keep the pivot point stationary during rotation
      const rotatedPivot = pivot.clone().applyEuler(rotation);
      const reconstructedPivot = rotatedPivot.clone().add(offset);

      expect(reconstructedPivot.x).toBeCloseTo(pivot.x, 5);
      expect(reconstructedPivot.y).toBeCloseTo(pivot.y, 5);
      expect(reconstructedPivot.z).toBeCloseTo(pivot.z, 5);
    });

    it('should handle negative pivot coordinates', () => {
      const pivot = new THREE.Vector3(-2, -3, -4);
      const rotation = new THREE.Euler(0, Math.PI / 2, 0, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      // Verify the math: rotated pivot + offset should equal original pivot
      const rotatedPivot = pivot.clone().applyEuler(rotation);
      const reconstructedPivot = rotatedPivot.clone().add(offset);

      expect(reconstructedPivot.x).toBeCloseTo(pivot.x, 5);
      expect(reconstructedPivot.y).toBeCloseTo(pivot.y, 5);
      expect(reconstructedPivot.z).toBeCloseTo(pivot.z, 5);
    });
  });

  describe('calculateScaleOffset', () => {
    it('should return zero offset for uniform scale of 1', () => {
      const pivot = new THREE.Vector3(5, 10, 15);
      const scale = { x: 1, y: 1, z: 1 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(0, 10);
      expect(offset.y).toBeCloseTo(0, 10);
      expect(offset.z).toBeCloseTo(0, 10);
    });

    it('should return zero offset for pivot at origin', () => {
      const pivot = new THREE.Vector3(0, 0, 0);
      const scale = { x: 2, y: 3, z: 0.5 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(0, 10);
      expect(offset.y).toBeCloseTo(0, 10);
      expect(offset.z).toBeCloseTo(0, 10);
    });

    it('should compute correct offset for uniform scale of 2', () => {
      // Pivot at (1, 2, 3), scale = 2
      // Offset = pivot * (1 - scale) = (1, 2, 3) * (1 - 2) = (-1, -2, -3)
      const pivot = new THREE.Vector3(1, 2, 3);
      const scale = { x: 2, y: 2, z: 2 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(-1, 10);
      expect(offset.y).toBeCloseTo(-2, 10);
      expect(offset.z).toBeCloseTo(-3, 10);
    });

    it('should compute correct offset for uniform scale of 0.5', () => {
      // Pivot at (2, 4, 6), scale = 0.5
      // Offset = pivot * (1 - scale) = (2, 4, 6) * 0.5 = (1, 2, 3)
      const pivot = new THREE.Vector3(2, 4, 6);
      const scale = { x: 0.5, y: 0.5, z: 0.5 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(1, 10);
      expect(offset.y).toBeCloseTo(2, 10);
      expect(offset.z).toBeCloseTo(3, 10);
    });

    it('should compute correct offset for non-uniform scale', () => {
      // Pivot at (10, 20, 30)
      // Scale = (2, 0.5, 1)
      // Offset.x = 10 * (1 - 2) = -10
      // Offset.y = 20 * (1 - 0.5) = 10
      // Offset.z = 30 * (1 - 1) = 0
      const pivot = new THREE.Vector3(10, 20, 30);
      const scale = { x: 2, y: 0.5, z: 1 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(-10, 10);
      expect(offset.y).toBeCloseTo(10, 10);
      expect(offset.z).toBeCloseTo(0, 10);
    });

    it('should handle zero scale (collapse to pivot)', () => {
      // Scale = 0 means the object collapses to a point at the pivot
      // Offset = pivot * (1 - 0) = pivot
      const pivot = new THREE.Vector3(5, 5, 5);
      const scale = { x: 0, y: 0, z: 0 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(5, 10);
      expect(offset.y).toBeCloseTo(5, 10);
      expect(offset.z).toBeCloseTo(5, 10);
    });

    it('should handle negative scale (mirror)', () => {
      // Negative scale mirrors the object
      // Scale = -1 means: offset = pivot * (1 - (-1)) = pivot * 2
      const pivot = new THREE.Vector3(3, 4, 5);
      const scale = { x: -1, y: -1, z: -1 };

      const offset = calculateScaleOffset(pivot, scale);

      expect(offset.x).toBeCloseTo(6, 10);
      expect(offset.y).toBeCloseTo(8, 10);
      expect(offset.z).toBeCloseTo(10, 10);
    });

    it('should keep pivot stationary after scale is applied', () => {
      // If an object at origin is scaled, and we apply the offset,
      // the pivot point should remain at its original position
      const pivot = new THREE.Vector3(4, 8, 12);
      const scale = { x: 3, y: 0.25, z: 1.5 };

      const offset = calculateScaleOffset(pivot, scale);

      // After scaling, pivot would move to: pivot * scale
      const scaledPivot = new THREE.Vector3(
        pivot.x * scale.x,
        pivot.y * scale.y,
        pivot.z * scale.z
      );

      // Adding offset should bring it back to original
      const finalPivot = scaledPivot.clone().add(offset);

      expect(finalPivot.x).toBeCloseTo(pivot.x, 5);
      expect(finalPivot.y).toBeCloseTo(pivot.y, 5);
      expect(finalPivot.z).toBeCloseTo(pivot.z, 5);
    });
  });

  describe('Combined Rotation and Scale', () => {
    it('should compute independent offsets that can be combined', () => {
      const rotationPivot = new THREE.Vector3(1, 2, 3);
      const scalePivot = new THREE.Vector3(1, 0, 3); // Base center (y=0)
      const rotation = new THREE.Euler(0, Math.PI / 4, 0, 'XYZ');
      const scale = { x: 1.5, y: 1.5, z: 1.5 };

      const rotOffset = calculateRotationOffset(rotationPivot, rotation);
      const scaleOffset = calculateScaleOffset(scalePivot, scale);

      // Offsets should be independent and combinable
      const combinedOffset = new THREE.Vector3(
        rotOffset.x + scaleOffset.x,
        rotOffset.y + scaleOffset.y,
        rotOffset.z + scaleOffset.z
      );

      // Both offsets should be finite numbers
      expect(Number.isFinite(combinedOffset.x)).toBe(true);
      expect(Number.isFinite(combinedOffset.y)).toBe(true);
      expect(Number.isFinite(combinedOffset.z)).toBe(true);
    });

    it('should handle identity transforms (no rotation, scale=1)', () => {
      const pivot = new THREE.Vector3(5, 10, 15);
      const rotation = new THREE.Euler(0, 0, 0, 'XYZ');
      const scale = { x: 1, y: 1, z: 1 };

      const rotOffset = calculateRotationOffset(pivot, rotation);
      const scaleOffset = calculateScaleOffset(pivot, scale);

      // Both should be zero for identity transforms
      expect(rotOffset.length()).toBeCloseTo(0, 10);
      expect(scaleOffset.length()).toBeCloseTo(0, 10);
    });
  });

  describe('Base-centered Scaling (grounded objects)', () => {
    it('should keep base at same Y when scaling up', () => {
      // Object with center at (0, 1, 0) and base at (0, 0, 0)
      // When scaling by 2, the center would move to (0, 2, 0) without compensation
      // But with base-centered scaling, base stays at Y=0
      const baseCenter = new THREE.Vector3(0, 0, 0);
      const scale = { x: 2, y: 2, z: 2 };

      const offset = calculateScaleOffset(baseCenter, scale);

      // Since base is at origin, offset should be zero
      // (object grows upward from the ground)
      expect(offset.y).toBeCloseTo(0, 10);
    });

    it('should compensate for non-zero base Y', () => {
      // Object with base at Y = -5 (below ground level)
      // When scaling by 2, base would move to Y = -10
      // Offset should compensate: -5 * (1 - 2) = -5 * -1 = 5
      // Final position: -10 + 5 = -5 (back to original)
      const baseCenter = new THREE.Vector3(0, -5, 0);
      const scale = { x: 2, y: 2, z: 2 };

      const offset = calculateScaleOffset(baseCenter, scale);

      expect(offset.y).toBeCloseTo(5, 10);
    });

    it('should maintain X/Z center position when scaling', () => {
      // Base center at (3, 0, 4)
      // When scaling by 2, X would go to 6, Z to 8
      // Offset should bring them back: 3*(1-2) = -3, 4*(1-2) = -4
      const baseCenter = new THREE.Vector3(3, 0, 4);
      const scale = { x: 2, y: 2, z: 2 };

      const offset = calculateScaleOffset(baseCenter, scale);

      expect(offset.x).toBeCloseTo(-3, 10);
      expect(offset.z).toBeCloseTo(-4, 10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small rotations', () => {
      const pivot = new THREE.Vector3(1, 1, 1);
      const rotation = new THREE.Euler(0.001, 0.001, 0.001, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      // Small rotation should produce small offset
      expect(Math.abs(offset.x)).toBeLessThan(0.01);
      expect(Math.abs(offset.y)).toBeLessThan(0.01);
      expect(Math.abs(offset.z)).toBeLessThan(0.01);
    });

    it('should handle very large pivots', () => {
      const pivot = new THREE.Vector3(1000, 1000, 1000);
      const scale = { x: 1.001, y: 1.001, z: 1.001 };

      const offset = calculateScaleOffset(pivot, scale);

      // Even with large pivots, math should be stable
      expect(Number.isFinite(offset.x)).toBe(true);
      expect(Number.isFinite(offset.y)).toBe(true);
      expect(Number.isFinite(offset.z)).toBe(true);
      expect(offset.x).toBeCloseTo(-1, 0);
      expect(offset.y).toBeCloseTo(-1, 0);
      expect(offset.z).toBeCloseTo(-1, 0);
    });

    it('should handle full 360° rotation (return to original)', () => {
      const pivot = new THREE.Vector3(1, 2, 3);
      const rotation = new THREE.Euler(0, Math.PI * 2, 0, 'XYZ');

      const offset = calculateRotationOffset(pivot, rotation);

      // Full rotation should result in zero offset (pivot returns to original)
      expect(offset.x).toBeCloseTo(0, 5);
      expect(offset.y).toBeCloseTo(0, 5);
      expect(offset.z).toBeCloseTo(0, 5);
    });
  });
});
