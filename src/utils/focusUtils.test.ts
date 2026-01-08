import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  // Constants
  MODEL_CAMERA_DISTANCE_MULTIPLIER,
  MIN_CAMERA_DISTANCE,
  MAX_CAMERA_DISTANCE,
  COMFORT_MIN,
  COMFORT_MAX,
  SOFT_FOCUS_INTENSITY,
  MIN_ZOOM_OUT_INTENSITY,
  ZOOM_OUT_INTENSITY_RANGE,
  MIN_INTERPOLATION_THRESHOLD,
  CAMERA_VIEWING_ANGLE,
  CAMERA_HEIGHT_FACTOR,
  // Functions
  calculateIdealDistance,
  calculateIdealCameraPosition,
  calculateZoomOutFactor,
  calculateZoomInFactor,
  calculateSoftFocus,
  calculatePrimitiveFocusTarget,
  sceneToWorldCoordinates,
  // Types
  FocusTarget,
} from './focusUtils';

// =============================================================================
// Constants Tests
// =============================================================================

describe('focusUtils constants', () => {
  it('MODEL_CAMERA_DISTANCE_MULTIPLIER is 2.5', () => {
    expect(MODEL_CAMERA_DISTANCE_MULTIPLIER).toBe(2.5);
  });

  it('MIN_CAMERA_DISTANCE is 0.5', () => {
    expect(MIN_CAMERA_DISTANCE).toBe(0.5);
  });

  it('MAX_CAMERA_DISTANCE is 20', () => {
    expect(MAX_CAMERA_DISTANCE).toBe(20);
  });

  it('COMFORT_MIN is 0.6 (60% of ideal)', () => {
    expect(COMFORT_MIN).toBe(0.6);
  });

  it('COMFORT_MAX is 2.0 (200% of ideal)', () => {
    expect(COMFORT_MAX).toBe(2.0);
  });

  it('SOFT_FOCUS_INTENSITY is 0.5', () => {
    expect(SOFT_FOCUS_INTENSITY).toBe(0.5);
  });

  it('MIN_ZOOM_OUT_INTENSITY is 0.6', () => {
    expect(MIN_ZOOM_OUT_INTENSITY).toBe(0.6);
  });

  it('ZOOM_OUT_INTENSITY_RANGE is 0.4', () => {
    expect(ZOOM_OUT_INTENSITY_RANGE).toBe(0.4);
  });

  it('MIN_INTERPOLATION_THRESHOLD is 0.05', () => {
    expect(MIN_INTERPOLATION_THRESHOLD).toBe(0.05);
  });

  it('CAMERA_VIEWING_ANGLE is PI/4 (45 degrees)', () => {
    expect(CAMERA_VIEWING_ANGLE).toBe(Math.PI / 4);
  });

  it('CAMERA_HEIGHT_FACTOR is 0.6', () => {
    expect(CAMERA_HEIGHT_FACTOR).toBe(0.6);
  });
});

// =============================================================================
// calculateIdealDistance Tests
// =============================================================================

describe('calculateIdealDistance', () => {
  describe('basic calculations', () => {
    it('multiplies bounds size by MODEL_CAMERA_DISTANCE_MULTIPLIER', () => {
      const boundsSize = 2.0;
      const expected = boundsSize * MODEL_CAMERA_DISTANCE_MULTIPLIER;
      expect(calculateIdealDistance(boundsSize)).toBe(expected);
    });

    it('returns 2.5 for unit bounds', () => {
      expect(calculateIdealDistance(1.0)).toBe(2.5);
    });

    it('returns 5.0 for bounds size 2.0', () => {
      expect(calculateIdealDistance(2.0)).toBe(5.0);
    });
  });

  describe('clamping behavior', () => {
    it('clamps to MIN_CAMERA_DISTANCE for very small bounds', () => {
      expect(calculateIdealDistance(0.1)).toBe(MIN_CAMERA_DISTANCE);
    });

    it('clamps to MIN_CAMERA_DISTANCE for zero bounds', () => {
      expect(calculateIdealDistance(0)).toBe(MIN_CAMERA_DISTANCE);
    });

    it('clamps to MAX_CAMERA_DISTANCE for very large bounds', () => {
      expect(calculateIdealDistance(100)).toBe(MAX_CAMERA_DISTANCE);
    });

    it('does not clamp values within valid range', () => {
      // boundsSize = 4.0 gives distance = 10.0 (within 0.5-20 range)
      expect(calculateIdealDistance(4.0)).toBe(10.0);
    });

    it('clamps at exact boundary - minimum', () => {
      // boundsSize = 0.2 gives distance = 0.5 (exactly at minimum)
      expect(calculateIdealDistance(0.2)).toBe(0.5);
    });

    it('clamps at exact boundary - maximum', () => {
      // boundsSize = 8.0 gives distance = 20.0 (exactly at maximum)
      expect(calculateIdealDistance(8.0)).toBe(20.0);
    });
  });

  describe('edge cases', () => {
    it('handles negative bounds (treats as small positive)', () => {
      // Negative bounds shouldn't happen but should still clamp to minimum
      expect(calculateIdealDistance(-1)).toBe(MIN_CAMERA_DISTANCE);
    });
  });
});

// =============================================================================
// calculateIdealCameraPosition Tests
// =============================================================================

describe('calculateIdealCameraPosition', () => {
  const createTarget = (
    x: number,
    y: number,
    z: number,
    size: number
  ): FocusTarget => ({
    targetX: x,
    targetY: y,
    targetZ: z,
    boundsSize: size,
  });

  describe('basic positioning', () => {
    it('positions camera at 45-degree angle from target', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const result = calculateIdealCameraPosition(target);

      // At 45 degrees, X and Z should be equal
      expect(result.x).toBeCloseTo(result.z, 5);
    });

    it('positions camera above target based on height factor', () => {
      const target = createTarget(0, 1.0, 0, 1.0);
      const result = calculateIdealCameraPosition(target);

      // Camera Y = targetY + distance * CAMERA_HEIGHT_FACTOR
      const expectedY = 1.0 + result.distance * CAMERA_HEIGHT_FACTOR;
      expect(result.y).toBeCloseTo(expectedY, 5);
    });

    it('calculates correct distance from target', () => {
      const target = createTarget(0, 0, 0, 2.0);
      const result = calculateIdealCameraPosition(target);

      expect(result.distance).toBe(calculateIdealDistance(2.0));
    });
  });

  describe('target offset handling', () => {
    it('offsets camera position based on target position', () => {
      const target1 = createTarget(0, 0, 0, 1.0);
      const target2 = createTarget(5, 0, 0, 1.0);

      const result1 = calculateIdealCameraPosition(target1);
      const result2 = calculateIdealCameraPosition(target2);

      // X should differ by 5 (the target offset)
      expect(result2.x - result1.x).toBeCloseTo(5, 5);
      // Z and distance should be the same
      expect(result2.z).toBeCloseTo(result1.z, 5);
      expect(result2.distance).toBe(result1.distance);
    });

    it('handles negative target coordinates', () => {
      const target = createTarget(-3, -1, -2, 1.0);
      const result = calculateIdealCameraPosition(target);

      // Camera should still be offset from target in the expected direction
      expect(result.x).toBeGreaterThan(target.targetX);
      expect(result.z).toBeGreaterThan(target.targetZ);
    });
  });

  describe('geometric consistency', () => {
    it('camera is at correct distance from target', () => {
      const target = createTarget(1, 2, 3, 2.0);
      const result = calculateIdealCameraPosition(target);

      const distance = Math.sqrt(
        Math.pow(result.x - target.targetX, 2) +
          Math.pow(result.y - target.targetY, 2) +
          Math.pow(result.z - target.targetZ, 2)
      );

      // Distance should be approximately the ideal distance (not exact due to height factor)
      // The horizontal distance should match
      const horizontalDistance = Math.sqrt(
        Math.pow(result.x - target.targetX, 2) +
          Math.pow(result.z - target.targetZ, 2)
      );
      expect(horizontalDistance).toBeCloseTo(result.distance, 5);
    });
  });
});

// =============================================================================
// calculateZoomOutFactor Tests
// =============================================================================

describe('calculateZoomOutFactor', () => {
  describe('edge of comfort zone (distanceRatio = COMFORT_MIN)', () => {
    it('returns MIN_ZOOM_OUT_INTENSITY at comfort zone edge', () => {
      const factor = calculateZoomOutFactor(COMFORT_MIN);
      expect(factor).toBeCloseTo(MIN_ZOOM_OUT_INTENSITY, 5);
    });
  });

  describe('very close to object (distanceRatio approaching 0)', () => {
    it('approaches 1.0 as distance ratio approaches 0', () => {
      const factor = calculateZoomOutFactor(0.01);
      expect(factor).toBeGreaterThan(0.95);
      expect(factor).toBeLessThanOrEqual(1.0);
    });

    it('returns exactly 1.0 at distance ratio 0', () => {
      const factor = calculateZoomOutFactor(0);
      expect(factor).toBe(MIN_ZOOM_OUT_INTENSITY + ZOOM_OUT_INTENSITY_RANGE);
    });
  });

  describe('intermediate distances', () => {
    it('returns ~0.80 at half of COMFORT_MIN', () => {
      // At distanceRatio = 0.3 (half of 0.6)
      // closenessFactor = 1 - 0.3/0.6 = 0.5
      // factor = 0.6 + 0.5 * 0.4 = 0.8
      const factor = calculateZoomOutFactor(COMFORT_MIN / 2);
      expect(factor).toBeCloseTo(0.8, 5);
    });

    it('increases monotonically as distance decreases', () => {
      const factor1 = calculateZoomOutFactor(0.5);
      const factor2 = calculateZoomOutFactor(0.3);
      const factor3 = calculateZoomOutFactor(0.1);

      expect(factor2).toBeGreaterThan(factor1);
      expect(factor3).toBeGreaterThan(factor2);
    });
  });

  describe('linearity', () => {
    it('has linear relationship with distance ratio', () => {
      // Factor should increase linearly as distance decreases
      const f1 = calculateZoomOutFactor(0.6);
      const f2 = calculateZoomOutFactor(0.3);
      const f3 = calculateZoomOutFactor(0.0);

      // Difference between adjacent points should be similar
      const diff1 = f2 - f1;
      const diff2 = f3 - f2;
      expect(diff1).toBeCloseTo(diff2, 5);
    });
  });
});

// =============================================================================
// calculateZoomInFactor Tests
// =============================================================================

describe('calculateZoomInFactor', () => {
  describe('edge of comfort zone (distanceRatio = COMFORT_MAX)', () => {
    it('returns SOFT_FOCUS_INTENSITY at comfort zone edge', () => {
      const factor = calculateZoomInFactor(COMFORT_MAX);
      expect(factor).toBeCloseTo(SOFT_FOCUS_INTENSITY, 5);
    });
  });

  describe('far from object', () => {
    it('increases as distance increases (before capping)', () => {
      // Use smaller values that won't hit the cap
      const factor1 = calculateZoomInFactor(2.5);
      const factor2 = calculateZoomInFactor(3.0);
      const factor3 = calculateZoomInFactor(3.5);

      expect(factor2).toBeGreaterThan(factor1);
      expect(factor3).toBeGreaterThan(factor2);
    });

    it('caps at 1.0 for very large distances', () => {
      const factor = calculateZoomInFactor(100);
      expect(factor).toBe(1.0);
    });

    it('returns 1.0 when ratio is 4x of COMFORT_MAX', () => {
      // At distanceRatio = 8.0 (4x of COMFORT_MAX = 2.0)
      // excessRatio = 8.0/2.0 - 1 = 3
      // factor = min(1.0, 0.5 * 3 + 0.5) = min(1.0, 2.0) = 1.0
      const factor = calculateZoomInFactor(8.0);
      expect(factor).toBe(1.0);
    });
  });

  describe('intermediate distances', () => {
    it('returns ~0.75 at 3x ideal distance', () => {
      // At distanceRatio = 3.0
      // excessRatio = 3.0/2.0 - 1 = 0.5
      // factor = 0.5 * 0.5 + 0.5 = 0.75
      const factor = calculateZoomInFactor(3.0);
      expect(factor).toBeCloseTo(0.75, 5);
    });
  });
});

// =============================================================================
// calculateSoftFocus Tests
// =============================================================================

describe('calculateSoftFocus', () => {
  const createTarget = (
    x: number,
    y: number,
    z: number,
    size: number
  ): FocusTarget => ({
    targetX: x,
    targetY: y,
    targetZ: z,
    boundsSize: size,
  });

  describe('within comfort zone', () => {
    it('does not move camera when at ideal distance', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      // Position camera at exactly the ideal distance along the direction vector
      // The idealCamera position includes a height offset, so we calculate actual distance
      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();

      // Place camera at exactly ideal distance
      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance,
        target.targetY + direction.y * idealCamera.distance,
        target.targetZ + direction.z * idealCamera.distance
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.shouldMoveCamera).toBe(false);
      expect(result.distanceRatio).toBeCloseTo(1.0, 2);
      expect(result.wasTooClose).toBe(false);
      expect(result.wasTooFar).toBe(false);
    });

    it('does not move camera at 80% of ideal distance', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      // Position camera at 80% of ideal distance
      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();
      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.8,
        target.targetY + direction.y * idealCamera.distance * 0.8,
        target.targetZ + direction.z * idealCamera.distance * 0.8
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.shouldMoveCamera).toBe(false);
      expect(result.distanceRatio).toBeCloseTo(0.8, 1);
      expect(result.wasTooClose).toBe(false);
      expect(result.wasTooFar).toBe(false);
    });

    it('does not move camera at 180% of ideal distance', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      // Position camera at 180% of ideal distance
      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();
      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 1.8,
        target.targetY + direction.y * idealCamera.distance * 1.8,
        target.targetZ + direction.z * idealCamera.distance * 1.8
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.shouldMoveCamera).toBe(false);
      expect(result.distanceRatio).toBeCloseTo(1.8, 1);
      expect(result.wasTooClose).toBe(false);
      expect(result.wasTooFar).toBe(false);
    });
  });

  describe('too close (needs zoom out)', () => {
    it('moves camera when at 50% of ideal distance', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      // Position camera at 50% of ideal distance
      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();
      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.5,
        target.targetY + direction.y * idealCamera.distance * 0.5,
        target.targetZ + direction.z * idealCamera.distance * 0.5
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.shouldMoveCamera).toBe(true);
      expect(result.wasTooClose).toBe(true);
      expect(result.wasTooFar).toBe(false);
      expect(result.newCameraPosition).toBeDefined();
    });

    it('has higher interpolation factor when very close', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();

      // 50% of ideal
      const pos50 = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.5,
        target.targetY + direction.y * idealCamera.distance * 0.5,
        target.targetZ + direction.z * idealCamera.distance * 0.5
      );

      // 20% of ideal (very close)
      const pos20 = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.2,
        target.targetY + direction.y * idealCamera.distance * 0.2,
        target.targetZ + direction.z * idealCamera.distance * 0.2
      );

      const result50 = calculateSoftFocus(pos50, target, idealCamera);
      const result20 = calculateSoftFocus(pos20, target, idealCamera);

      expect(result20.interpolationFactor).toBeGreaterThan(
        result50.interpolationFactor
      );
    });

    it('new camera position is between current and ideal', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();

      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.3,
        target.targetY + direction.y * idealCamera.distance * 0.3,
        target.targetZ + direction.z * idealCamera.distance * 0.3
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      if (result.newCameraPosition) {
        const currentDist = currentPos.distanceTo(
          new THREE.Vector3(target.targetX, target.targetY, target.targetZ)
        );
        const newDist = result.newCameraPosition.distanceTo(
          new THREE.Vector3(target.targetX, target.targetY, target.targetZ)
        );

        // New position should be further from target (zooming out)
        expect(newDist).toBeGreaterThan(currentDist);
        // But not further than ideal
        expect(newDist).toBeLessThanOrEqual(idealCamera.distance);
      }
    });
  });

  describe('too far (needs zoom in)', () => {
    it('moves camera when at 300% of ideal distance', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      // Position camera at 300% of ideal distance
      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();
      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 3.0,
        target.targetY + direction.y * idealCamera.distance * 3.0,
        target.targetZ + direction.z * idealCamera.distance * 3.0
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.shouldMoveCamera).toBe(true);
      expect(result.wasTooClose).toBe(false);
      expect(result.wasTooFar).toBe(true);
      expect(result.newCameraPosition).toBeDefined();
    });

    it('new camera position is closer to target', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();

      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 5.0,
        target.targetY + direction.y * idealCamera.distance * 5.0,
        target.targetZ + direction.z * idealCamera.distance * 5.0
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      if (result.newCameraPosition) {
        const currentDist = currentPos.distanceTo(
          new THREE.Vector3(target.targetX, target.targetY, target.targetZ)
        );
        const newDist = result.newCameraPosition.distanceTo(
          new THREE.Vector3(target.targetX, target.targetY, target.targetZ)
        );

        // New position should be closer to target (zooming in)
        expect(newDist).toBeLessThan(currentDist);
      }
    });
  });

  describe('boundary conditions', () => {
    it('correctly identifies just inside comfort zone (60.1%)', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();

      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.601,
        target.targetY + direction.y * idealCamera.distance * 0.601,
        target.targetZ + direction.z * idealCamera.distance * 0.601
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.wasTooClose).toBe(false);
      expect(result.wasTooFar).toBe(false);
    });

    it('correctly identifies just outside comfort zone (59.9%)', () => {
      const target = createTarget(0, 0, 0, 1.0);
      const idealCamera = calculateIdealCameraPosition(target);

      const direction = new THREE.Vector3(
        idealCamera.x - target.targetX,
        idealCamera.y - target.targetY,
        idealCamera.z - target.targetZ
      ).normalize();

      const currentPos = new THREE.Vector3(
        target.targetX + direction.x * idealCamera.distance * 0.599,
        target.targetY + direction.y * idealCamera.distance * 0.599,
        target.targetZ + direction.z * idealCamera.distance * 0.599
      );

      const result = calculateSoftFocus(currentPos, target, idealCamera);

      expect(result.wasTooClose).toBe(true);
    });
  });
});

// =============================================================================
// calculatePrimitiveFocusTarget Tests
// =============================================================================

describe('calculatePrimitiveFocusTarget', () => {
  it('creates target at parent position with default height offset', () => {
    const target = calculatePrimitiveFocusTarget(1, 0, 2);

    expect(target.targetX).toBe(1);
    expect(target.targetY).toBe(0.5); // default height offset
    expect(target.targetZ).toBe(2);
    expect(target.boundsSize).toBe(1);
  });

  it('uses custom height offset', () => {
    const target = calculatePrimitiveFocusTarget(0, 0, 0, 1.5);

    expect(target.targetY).toBe(1.5);
  });

  it('handles negative coordinates', () => {
    const target = calculatePrimitiveFocusTarget(-5, -2, -3, 0.5);

    expect(target.targetX).toBe(-5);
    expect(target.targetY).toBe(-1.5); // -2 + 0.5
    expect(target.targetZ).toBe(-3);
  });

  it('always returns boundsSize of 1', () => {
    const target1 = calculatePrimitiveFocusTarget(0, 0, 0, 0.1);
    const target2 = calculatePrimitiveFocusTarget(100, 100, 100, 10);

    expect(target1.boundsSize).toBe(1);
    expect(target2.boundsSize).toBe(1);
  });
});

// =============================================================================
// sceneToWorldCoordinates Tests
// =============================================================================

describe('sceneToWorldCoordinates', () => {
  it('divides all coordinates by 100', () => {
    const result = sceneToWorldCoordinates(100, 200, 300);

    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
  });

  it('negates Z coordinate', () => {
    const result = sceneToWorldCoordinates(0, 0, 100);

    expect(result.z).toBe(-1);
  });

  it('handles zero coordinates', () => {
    const result = sceneToWorldCoordinates(0, 0, 0);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(-0); // -0 equals 0
  });

  it('handles negative coordinates', () => {
    const result = sceneToWorldCoordinates(-100, -50, -200);

    expect(result.x).toBe(-1);
    expect(result.y).toBe(-0.5);
    expect(result.z).toBe(2); // -(-200)/100 = 2
  });

  it('handles fractional scene coordinates', () => {
    const result = sceneToWorldCoordinates(50, 25, 75);

    expect(result.x).toBe(0.5);
    expect(result.y).toBe(0.25);
    expect(result.z).toBe(-0.75);
  });

  it('roundtrip test with typical scene values', () => {
    // Typical scene object at (150, 50, 300)
    const result = sceneToWorldCoordinates(150, 50, 300);

    expect(result.x).toBe(1.5);
    expect(result.y).toBe(0.5);
    expect(result.z).toBe(-3);

    // Reverse transformation would be:
    // sceneX = worldX * 100 = 1.5 * 100 = 150 ✓
    // sceneY = worldY * 100 = 0.5 * 100 = 50 ✓
    // sceneZ = -worldZ * 100 = -(-3) * 100 = 300 ✓
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('focus system integration', () => {
  it('full focus workflow: target -> ideal -> soft focus calculation', () => {
    // Simulate a primitive cube at scene position (200, 0, -100)
    const scenePos = sceneToWorldCoordinates(200, 0, -100);

    // Create focus target for primitive
    const target = calculatePrimitiveFocusTarget(
      scenePos.x,
      scenePos.y,
      scenePos.z
    );

    expect(target.targetX).toBe(2);
    expect(target.targetY).toBe(0.5);
    expect(target.targetZ).toBe(1); // -(-100)/100 = 1

    // Calculate ideal camera position
    const idealCamera = calculateIdealCameraPosition(target);

    expect(idealCamera.distance).toBe(2.5); // boundsSize=1 * 2.5

    // Simulate current camera far away (default view)
    const currentPos = new THREE.Vector3(12, 8, 12);

    // Calculate soft focus
    const result = calculateSoftFocus(currentPos, target, idealCamera);

    // Camera is very far from target, should need to zoom in
    expect(result.shouldMoveCamera).toBe(true);
    expect(result.wasTooFar).toBe(true);
    expect(result.newCameraPosition).toBeDefined();

    // New position should be closer
    const currentDist = currentPos.distanceTo(
      new THREE.Vector3(target.targetX, target.targetY, target.targetZ)
    );
    const newDist = result.newCameraPosition!.distanceTo(
      new THREE.Vector3(target.targetX, target.targetY, target.targetZ)
    );
    expect(newDist).toBeLessThan(currentDist);
  });

  it('camera very close triggers aggressive zoom out', () => {
    const target = calculatePrimitiveFocusTarget(0, 0, 0);
    const idealCamera = calculateIdealCameraPosition(target);

    // Camera very close (10% of ideal distance)
    const veryClosePos = new THREE.Vector3(
      target.targetX + 0.25 * Math.cos(CAMERA_VIEWING_ANGLE),
      target.targetY + 0.25 * CAMERA_HEIGHT_FACTOR,
      target.targetZ + 0.25 * Math.sin(CAMERA_VIEWING_ANGLE)
    );

    const result = calculateSoftFocus(veryClosePos, target, idealCamera);

    expect(result.wasTooClose).toBe(true);
    expect(result.interpolationFactor).toBeGreaterThan(0.8); // Aggressive zoom out
    expect(result.shouldMoveCamera).toBe(true);
  });
});

