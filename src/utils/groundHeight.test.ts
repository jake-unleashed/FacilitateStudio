import { describe, it, expect } from 'vitest';
import { calculateLowestPointOffset, heightToYPosition, yPositionToHeight } from './groundHeight';

// ============================================================================
// calculateLowestPointOffset Tests
// ============================================================================

describe('calculateLowestPointOffset', () => {
  describe('unrotated cube', () => {
    it('returns -0.5 for a unit cube with no rotation and scale 1', () => {
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-0.5, 5);
    });

    it('scales the offset proportionally with uniform scale', () => {
      const offset = calculateLowestPointOffset(0, 0, 0, 2, 2, 2);
      expect(offset).toBeCloseTo(-1.0, 5);
    });

    it('uses the Y scale for the lowest point when unrotated', () => {
      // With scaleY = 3, the cube is 3 units tall, so lowest point is at -1.5
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 3, 1);
      expect(offset).toBeCloseTo(-1.5, 5);
    });

    it('returns 0 for zero Y scale (degenerate case)', () => {
      const offset = calculateLowestPointOffset(0, 0, 0, 1, 0, 1);
      expect(offset).toBeCloseTo(0, 5);
    });
  });

  describe('rotation around Y axis only', () => {
    it('returns same offset for 45 degree Y rotation (no change in vertical extent)', () => {
      // Rotating around Y axis doesn't change the vertical extent of a cube
      const offset = calculateLowestPointOffset(0, 45, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-0.5, 5);
    });

    it('returns same offset for 90 degree Y rotation', () => {
      const offset = calculateLowestPointOffset(0, 90, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-0.5, 5);
    });
  });

  describe('rotation around X axis', () => {
    it('extends the lowest point for 45 degree X rotation', () => {
      // When rotated 45 degrees around X, a corner extends further down
      // The lowest point should be at approximately -sqrt(2)/2 ≈ -0.707
      const offset = calculateLowestPointOffset(45, 0, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-Math.sqrt(2) / 2, 3);
    });

    it('returns same offset for 90 degree X rotation (cube is axis-aligned again)', () => {
      // 90 degree rotation around X makes the cube axis-aligned again
      const offset = calculateLowestPointOffset(90, 0, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-0.5, 5);
    });
  });

  describe('rotation around Z axis', () => {
    it('extends the lowest point for 45 degree Z rotation', () => {
      // Similar to X rotation, Z rotation extends corners
      const offset = calculateLowestPointOffset(0, 0, 45, 1, 1, 1);
      expect(offset).toBeCloseTo(-Math.sqrt(2) / 2, 3);
    });
  });

  describe('combined rotations', () => {
    it('handles combined X and Z rotations', () => {
      // Combined rotations should extend the lowest point even further
      const offset = calculateLowestPointOffset(45, 0, 45, 1, 1, 1);
      // The exact value depends on the rotation order, but it should be more negative
      expect(offset).toBeLessThan(-0.5);
    });

    it('handles 180 degree rotation (cube is flipped)', () => {
      // 180 degree rotation around any axis should give same lowest point as 0
      const offset = calculateLowestPointOffset(180, 0, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-0.5, 5);
    });
  });

  describe('combined scale and rotation', () => {
    it('applies scale before rotation correctly', () => {
      // Scale 2x, then rotate 45 degrees around X
      const offset = calculateLowestPointOffset(45, 0, 0, 2, 2, 2);
      // Should be -sqrt(2) ≈ -1.414
      expect(offset).toBeCloseTo(-Math.sqrt(2), 3);
    });

    it('handles non-uniform scale with rotation', () => {
      // Tall cube (scaleY = 2) rotated 45 degrees around X
      const offset = calculateLowestPointOffset(45, 0, 0, 1, 2, 1);
      // The corners at (±0.5, ±1, ±0.5) when rotated will extend differently
      expect(offset).toBeLessThan(-1);
    });
  });

  describe('edge cases', () => {
    it('handles very small rotations', () => {
      const offset = calculateLowestPointOffset(0.001, 0, 0, 1, 1, 1);
      expect(offset).toBeCloseTo(-0.5, 3);
    });

    it('handles negative rotations', () => {
      const offsetPos = calculateLowestPointOffset(45, 0, 0, 1, 1, 1);
      const offsetNeg = calculateLowestPointOffset(-45, 0, 0, 1, 1, 1);
      expect(offsetPos).toBeCloseTo(offsetNeg, 5);
    });

    it('handles rotations greater than 360 degrees', () => {
      const offset360 = calculateLowestPointOffset(360, 0, 0, 1, 1, 1);
      const offset0 = calculateLowestPointOffset(0, 0, 0, 1, 1, 1);
      expect(offset360).toBeCloseTo(offset0, 5);
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
// Integration Tests
// ============================================================================

describe('ground height integration', () => {
  it('maintains height when rotation changes', () => {
    const initialHeight = 100;
    const initialOffset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1);

    // Rotate the cube
    const newOffset = calculateLowestPointOffset(45, 0, 0, 1, 1, 1);

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
    const initialOffset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1);

    // Scale up
    const newOffset = calculateLowestPointOffset(0, 0, 0, 2, 2, 2);

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
    const initialOffset = calculateLowestPointOffset(0, 0, 0, 1, 1, 1);
    const initialY = heightToYPosition(initialHeight, initialOffset);

    // The object is at Y = 50 (center is 0.5m above ground)

    // Now rotate - the offset becomes more negative
    const newOffset = calculateLowestPointOffset(45, 0, 0, 1, 1, 1);

    // Calculate what height would be if we kept the same Y
    const heightIfUnchanged = yPositionToHeight(initialY, newOffset);

    // It should be clamped to 0 (not negative)
    expect(heightIfUnchanged).toBe(0);

    // The new Y to maintain height = 0 should be higher
    const newY = heightToYPosition(0, newOffset);
    expect(newY).toBeGreaterThan(initialY);
  });
});
