import { describe, it, expect } from 'vitest';
import {
  calculateLowestPointOffset,
  heightToYPosition,
  yPositionToHeight,
  calculateScaleAdjustedY,
  DEFAULT_MODEL_HEIGHT,
  INTERNAL_TO_WORLD,
} from './groundHeight';

// ============================================================================
// calculateLowestPointOffset Tests
// ============================================================================

// Unit cube has modelHeight = 1.0 (corners at ±0.5 in all dimensions)
const UNIT_CUBE_HEIGHT = 1.0;

describe('calculateLowestPointOffset', () => {
  describe('unrotated cube', () => {
    it('returns -0.5 for a unit cube with no rotation and scale 1', () => {
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-0.5, 5);
    });

    it('scales the offset proportionally with uniform scale', () => {
      const offset = calculateLowestPointOffset(0, 0, 0, 2, 2, 2, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-1.0, 5);
    });

    it('uses the Y scale for the lowest point when unrotated', () => {
      // With scaleY = 3, the cube is 3 units tall, so lowest point is at -1.5
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 3, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-1.5, 5);
    });

    it('returns 0 for zero Y scale (degenerate case)', () => {
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 0, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(0, 5);
    });
  });

  describe('rotation around Y axis only', () => {
    it('returns same offset for 45 degree Y rotation (no change in vertical extent)', () => {
      // Rotating around Y axis doesn't change the vertical extent of a cube
      const offset = calculateLowestPointOffset(0, 45, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-0.5, 5);
    });

    it('returns same offset for 90 degree Y rotation', () => {
      const offset = calculateLowestPointOffset(0, 90, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-0.5, 5);
    });
  });

  describe('rotation around X axis', () => {
    it('extends the lowest point for 45 degree X rotation', () => {
      // When rotated 45 degrees around X, a corner extends further down
      // The lowest point should be at approximately -sqrt(2)/2 ≈ -0.707
      const offset = calculateLowestPointOffset(45, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-Math.sqrt(2) / 2, 3);
    });

    it('returns same offset for 90 degree X rotation (cube is axis-aligned again)', () => {
      // 90 degree rotation around X makes the cube axis-aligned again
      const offset = calculateLowestPointOffset(90, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-0.5, 5);
    });
  });

  describe('rotation around Z axis', () => {
    it('extends the lowest point for 45 degree Z rotation', () => {
      // Similar to X rotation, Z rotation extends corners
      const offset = calculateLowestPointOffset(0, 0, 45, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-Math.sqrt(2) / 2, 3);
    });
  });

  describe('combined rotations', () => {
    it('handles combined X and Z rotations', () => {
      // Combined rotations should extend the lowest point even further
      const offset = calculateLowestPointOffset(45, 0, 45, 1, 1, 1, UNIT_CUBE_HEIGHT);
      // The exact value depends on the rotation order, but it should be more negative
      expect(offset).toBeLessThan(-0.5);
    });

    it('handles 180 degree rotation (cube is flipped)', () => {
      // 180 degree rotation around any axis should give same lowest point as 0
      const offset = calculateLowestPointOffset(180, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-0.5, 5);
    });
  });

  describe('combined scale and rotation', () => {
    it('applies scale before rotation correctly', () => {
      // Scale 2x, then rotate 45 degrees around X
      const offset = calculateLowestPointOffset(45, 0, 0, 2, 2, 2, UNIT_CUBE_HEIGHT);
      // Should be -sqrt(2) ≈ -1.414
      expect(offset).toBeCloseTo(-Math.sqrt(2), 3);
    });

    it('handles non-uniform scale with rotation', () => {
      // Tall cube (scaleY = 2) rotated 45 degrees around X
      const offset = calculateLowestPointOffset(45, 0, 0, 1, 2, 1, UNIT_CUBE_HEIGHT);
      // The corners at (±0.5, ±1, ±0.5) when rotated will extend differently
      expect(offset).toBeLessThan(-1);
    });
  });

  describe('edge cases', () => {
    it('handles very small rotations', () => {
      const offset = calculateLowestPointOffset(0.001, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset).toBeCloseTo(-0.5, 3);
    });

    it('handles negative rotations', () => {
      const offsetPos = calculateLowestPointOffset(45, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      const offsetNeg = calculateLowestPointOffset(-45, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offsetPos).toBeCloseTo(offsetNeg, 5);
    });

    it('handles rotations greater than 360 degrees', () => {
      const offset360 = calculateLowestPointOffset(360, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      const offset0 = calculateLowestPointOffset(0, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
      expect(offset360).toBeCloseTo(offset0, 5);
    });
  });

  describe('different model heights', () => {
    it('scales offset proportionally with model height', () => {
      // A model with height 2.0 should have offset -1.0 at scale 1
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1, 2.0);
      expect(offset).toBeCloseTo(-1.0, 5);
    });

    it('uses default model height when not specified', () => {
      // Default is 2.0, so offset should be -1.0
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-1.0, 5);
    });
  });
});

// ============================================================================
// heightToYPosition Tests
// ============================================================================

describe('heightToYPosition', () => {
  describe('basic conversions', () => {
    it('returns the absolute offset when height is 0', () => {
      // height = 0, lowestPointOffset = -0.5 (world units)
      // Y = 0 + |-0.5| * 100 = 50
      const y = heightToYPosition(0, -0.5);
      expect(y).toBe(50);
    });

    it('adds height to the offset', () => {
      // height = 100 (1 meter), lowestPointOffset = -0.5
      // Y = 100 + 50 = 150
      const y = heightToYPosition(100, -0.5);
      expect(y).toBe(150);
    });

    it('handles larger offsets', () => {
      // height = 0, lowestPointOffset = -1.0 (scaled cube)
      // Y = 0 + 100 = 100
      const y = heightToYPosition(0, -1.0);
      expect(y).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('handles zero offset', () => {
      const y = heightToYPosition(50, 0);
      expect(y).toBe(50);
    });

    it('handles positive offset (theoretical edge case)', () => {
      // Even if offset were positive, we use absolute value
      const y = heightToYPosition(50, 0.5);
      expect(y).toBe(100);
    });

    it('handles large heights', () => {
      const y = heightToYPosition(500, -0.5);
      expect(y).toBe(550);
    });
  });
});

// ============================================================================
// yPositionToHeight Tests
// ============================================================================

describe('yPositionToHeight', () => {
  describe('basic conversions', () => {
    it('returns 0 when Y equals the absolute offset', () => {
      // Y = 50, lowestPointOffset = -0.5
      // height = 50 - 50 = 0
      const height = yPositionToHeight(50, -0.5);
      expect(height).toBe(0);
    });

    it('returns positive height when Y is greater than offset', () => {
      // Y = 150, lowestPointOffset = -0.5
      // height = 150 - 50 = 100
      const height = yPositionToHeight(150, -0.5);
      expect(height).toBe(100);
    });

    it('clamps to 0 when Y would result in negative height', () => {
      // Y = 30, lowestPointOffset = -0.5
      // raw height = 30 - 50 = -20, clamped to 0
      const height = yPositionToHeight(30, -0.5);
      expect(height).toBe(0);
    });
  });

  describe('clamping behavior', () => {
    it('clamps negative height to 0', () => {
      const height = yPositionToHeight(0, -0.5);
      expect(height).toBe(0);
    });

    it('clamps very negative Y to 0', () => {
      const height = yPositionToHeight(-100, -0.5);
      expect(height).toBe(0);
    });
  });

  describe('roundtrip with heightToYPosition', () => {
    it('converts back and forth correctly for positive heights', () => {
      const originalHeight = 123;
      const offset = -0.707;
      const y = heightToYPosition(originalHeight, offset);
      const recoveredHeight = yPositionToHeight(y, offset);
      expect(recoveredHeight).toBeCloseTo(originalHeight, 5);
    });

    it('converts back to 0 for clamped heights', () => {
      const y = 20; // Will result in negative height
      const offset = -0.5;
      const height = yPositionToHeight(y, offset);
      expect(height).toBe(0);
      // Converting back should give the minimum valid Y
      const minY = heightToYPosition(0, offset);
      expect(minY).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('handles zero offset', () => {
      const height = yPositionToHeight(100, 0);
      expect(height).toBe(100);
    });

    it('handles very small heights', () => {
      const height = yPositionToHeight(50.001, -0.5);
      expect(height).toBeCloseTo(0.001, 5);
    });
  });
});

// ============================================================================
// calculateScaleAdjustedY Tests
// ============================================================================

describe('calculateScaleAdjustedY', () => {
  describe('basic scale adjustments', () => {
    it('returns same Y when scale does not change', () => {
      const result = calculateScaleAdjustedY(100, 1.0, 1.0, 2.0);
      expect(result).toBe(100);
    });

    it('increases Y when scaling up from 1.0 to 2.0', () => {
      // For a model with height 2.0, scaling from 1.0 to 2.0
      // Y adjustment = 2.0 * 50 * (2.0 - 1.0) = 100
      const result = calculateScaleAdjustedY(0, 1.0, 2.0, 2.0);
      expect(result).toBe(100);
    });

    it('decreases Y when scaling down from 2.0 to 1.0', () => {
      // Y adjustment = 2.0 * 50 * (1.0 - 2.0) = -100
      const result = calculateScaleAdjustedY(200, 2.0, 1.0, 2.0);
      expect(result).toBe(100);
    });

    it('handles fractional scales correctly', () => {
      // Scaling from 1.0 to 1.5
      // Y adjustment = 2.0 * 50 * (1.5 - 1.0) = 50
      const result = calculateScaleAdjustedY(100, 1.0, 1.5, 2.0);
      expect(result).toBe(150);
    });
  });

  describe('different model heights', () => {
    it('uses default model height when not specified', () => {
      // Default is 2.0, so result should be same as explicit 2.0
      const withDefault = calculateScaleAdjustedY(0, 1.0, 2.0);
      const withExplicit = calculateScaleAdjustedY(0, 1.0, 2.0, DEFAULT_MODEL_HEIGHT);
      expect(withDefault).toBe(withExplicit);
    });

    it('scales adjustment proportionally with model height', () => {
      // Model height 1.0: Y adjustment = 1.0 * 50 * (2.0 - 1.0) = 50
      const small = calculateScaleAdjustedY(0, 1.0, 2.0, 1.0);
      expect(small).toBe(50);

      // Model height 4.0: Y adjustment = 4.0 * 50 * (2.0 - 1.0) = 200
      const large = calculateScaleAdjustedY(0, 1.0, 2.0, 4.0);
      expect(large).toBe(200);
    });

    it('handles very small model heights', () => {
      // Model height 0.1: Y adjustment = 0.1 * 50 * (2.0 - 1.0) = 5
      const result = calculateScaleAdjustedY(0, 1.0, 2.0, 0.1);
      expect(result).toBe(5);
    });
  });

  describe('preserves ground contact', () => {
    it('keeps model bottom at ground level when starting at ground', () => {
      // If model is at ground (Y = modelHeight/2 * INTERNAL_TO_WORLD = 100 for height 2.0)
      // and we scale to 2.0, new Y should be 200 (to keep bottom at ground)
      const initialY = 100; // Center is 1m above ground (model height 2.0)
      const result = calculateScaleAdjustedY(initialY, 1.0, 2.0, 2.0);
      expect(result).toBe(200); // Center is now 2m above ground
    });

    it('maintains height above ground when scaling', () => {
      // Model floating 1m above ground (height above ground = 100 internal units)
      // Initial Y = groundOffset + heightAbove = 100 + 100 = 200
      const initialY = 200;
      const result = calculateScaleAdjustedY(initialY, 1.0, 2.0, 2.0);
      // After scaling: Y = 200 + 100 = 300
      // This means center is 3m up, model is 4m tall, so bottom is at 1m (100 internal)
      expect(result).toBe(300);
    });
  });

  describe('mathematical properties', () => {
    it('is linear with scale change', () => {
      const y = calculateScaleAdjustedY(0, 1.0, 3.0, 2.0);
      // Two 1.0 increments should equal one 2.0 increment
      const y1 = calculateScaleAdjustedY(0, 1.0, 2.0, 2.0);
      const y2 = calculateScaleAdjustedY(y1, 2.0, 3.0, 2.0);
      expect(y).toBeCloseTo(y2, 10);
    });

    it('is reversible (scale up then down returns to original)', () => {
      const original = 150;
      const scaledUp = calculateScaleAdjustedY(original, 1.0, 2.5, 2.0);
      const scaledBack = calculateScaleAdjustedY(scaledUp, 2.5, 1.0, 2.0);
      expect(scaledBack).toBeCloseTo(original, 10);
    });

    it('handles negative scale (theoretical edge case)', () => {
      // Negative scale is unusual but should still be mathematically consistent
      const result = calculateScaleAdjustedY(0, 1.0, -1.0, 2.0);
      // Y adjustment = 2.0 * 50 * (-1.0 - 1.0) = -200
      expect(result).toBe(-200);
    });
  });

  describe('edge cases', () => {
    it('handles zero current scale', () => {
      const result = calculateScaleAdjustedY(0, 0, 1.0, 2.0);
      // Y adjustment = 2.0 * 50 * (1.0 - 0) = 100
      expect(result).toBe(100);
    });

    it('handles very large scales', () => {
      const result = calculateScaleAdjustedY(0, 1.0, 100.0, 2.0);
      // Y adjustment = 2.0 * 50 * (100.0 - 1.0) = 9900
      expect(result).toBe(9900);
    });

    it('handles very small scale changes', () => {
      const result = calculateScaleAdjustedY(0, 1.0, 1.001, 2.0);
      // Y adjustment = 2.0 * 50 * 0.001 = 0.1
      expect(result).toBeCloseTo(0.1, 10);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('constants', () => {
  it('DEFAULT_MODEL_HEIGHT is 2.0', () => {
    expect(DEFAULT_MODEL_HEIGHT).toBe(2.0);
  });

  it('INTERNAL_TO_WORLD is 100', () => {
    expect(INTERNAL_TO_WORLD).toBe(100);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ground height integration', () => {
  it('maintains height when rotation changes', () => {
    const initialHeight = 100;
    const initialOffset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);

    // Rotate the cube
    const newOffset = calculateLowestPointOffset(45, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);

    // Calculate new Y to maintain same height
    const newY = heightToYPosition(initialHeight, newOffset);

    // Verify the height is maintained
    const recoveredHeight = yPositionToHeight(newY, newOffset);
    expect(recoveredHeight).toBeCloseTo(initialHeight, 5);

    // Also verify that the new offset is different (rotation changed the bounds)
    expect(newOffset).not.toBeCloseTo(initialOffset, 2);
  });

  it('maintains height when scale changes', () => {
    const initialHeight = 50;
    const initialOffset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);

    // Scale up
    const newOffset = calculateLowestPointOffset(0, 0, 0, 2, 2, 2, UNIT_CUBE_HEIGHT);

    // Calculate new Y to maintain same height
    const newY = heightToYPosition(initialHeight, newOffset);

    // Verify the height is maintained
    const recoveredHeight = yPositionToHeight(newY, newOffset);
    expect(recoveredHeight).toBeCloseTo(initialHeight, 5);

    // Also verify that the new offset is different (scale changed the bounds)
    expect(newOffset).not.toBeCloseTo(initialOffset, 2);
  });

  it('clamps height to 0 when rotation would push object below ground', () => {
    // Start at height 0
    const initialHeight = 0;
    const initialOffset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);
    const initialY = heightToYPosition(initialHeight, initialOffset);

    // The object is at Y = 50 (center is 0.5m above ground)

    // Now rotate - the offset becomes more negative
    const newOffset = calculateLowestPointOffset(45, 0, 0, 1, 1, 1, UNIT_CUBE_HEIGHT);

    // Calculate what height would be if we kept the same Y
    const heightIfUnchanged = yPositionToHeight(initialY, newOffset);

    // It should be clamped to 0 (not negative)
    expect(heightIfUnchanged).toBe(0);

    // The new Y to maintain height = 0 should be higher
    const newY = heightToYPosition(0, newOffset);
    expect(newY).toBeGreaterThan(initialY);
  });
});
