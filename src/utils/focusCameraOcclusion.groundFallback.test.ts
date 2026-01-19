import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { calculateIdealCameraPosition, type FocusTarget } from './focusUtils';

vi.mock('./previewCameraCalculator', () => {
  return {
    generatePreviewCameraCandidatesWithPitchTiers: vi.fn(),
  };
});

vi.mock('./previewCameraOcclusion', () => {
  return {
    pickBestPreviewCameraCandidateByRaycastWithMetrics: vi.fn(),
    pickBestPreviewCameraCandidateByRaycastWithMetricsAsync: vi.fn(),
    // Not used in these tests, but `focusCameraOcclusion.ts` defines quick-focus which imports it.
    evaluateCameraVisibility: vi.fn(() => ({ clearFraction: 1 })),
  };
});

type Candidate = {
  position: [number, number, number];
  azimuth: number;
  azimuthDelta: number;
  pitch?: number;
  pitchDelta?: number;
  tierIndex?: number;
};

function candidate(position: [number, number, number], azimuth: number): Candidate {
  return { position, azimuth, azimuthDelta: 0, pitch: 0, pitchDelta: 0, tierIndex: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('calculateOcclusionAwareFocusCamera (ground fallback)', () => {
  it('early-accepts a clear above-ground base-tier candidate (no extra tiers)', async () => {
    const { generatePreviewCameraCandidatesWithPitchTiers } = await import('./previewCameraCalculator');
    const { pickBestPreviewCameraCandidateByRaycastWithMetrics } = await import('./previewCameraOcclusion');
    const { calculateOcclusionAwareFocusCamera, MIN_FOCUS_CAMERA_Y } = await import('./focusCameraOcclusion');

    const baseCandidates = [candidate([1, MIN_FOCUS_CAMERA_Y + 1, 3], 0.1)];

    (generatePreviewCameraCandidatesWithPitchTiers as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ pitchTiers }: { pitchTiers: unknown[] }) => {
        // Base tier has a single pitch tier.
        expect(pitchTiers.length).toBe(1);
        return baseCandidates;
      }
    );

    (pickBestPreviewCameraCandidateByRaycastWithMetrics as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ candidates }: { candidates: Candidate[] }) => {
        return {
          candidate: candidates[0],
          score: 10,
          minVisibility: 1,
          avgVisibility: 1,
          clearCount: 1,
          clearFraction: 1,
          sampleCount: 1,
        };
      }
    );

    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      verticalTiers: { enabled: true },
    });

    expect(result.position.y).toBeGreaterThanOrEqual(MIN_FOCUS_CAMERA_Y);
    expect(result.azimuth).toBeCloseTo(baseCandidates[0].azimuth, 6);
    expect(result.position.x).toBeCloseTo(baseCandidates[0].position[0], 6);
    expect(result.position.y).toBeCloseTo(baseCandidates[0].position[1], 6);
    expect(result.position.z).toBeCloseTo(baseCandidates[0].position[2], 6);
    expect(generatePreviewCameraCandidatesWithPitchTiers).toHaveBeenCalledTimes(1);
    expect(pickBestPreviewCameraCandidateByRaycastWithMetrics).toHaveBeenCalledTimes(1);
  });

  it('skips an underground base-tier winner and returns the best above-ground candidate from already-tested tiers', async () => {
    const { generatePreviewCameraCandidatesWithPitchTiers } = await import('./previewCameraCalculator');
    const { pickBestPreviewCameraCandidateByRaycastWithMetrics } = await import('./previewCameraOcclusion');
    const { calculateOcclusionAwareFocusCamera, MIN_FOCUS_CAMERA_Y } = await import('./focusCameraOcclusion');

    const baseCandidates = [candidate([1, MIN_FOCUS_CAMERA_Y - 1, 3], 0.1)];
    const fallbackCandidates = [candidate([9, MIN_FOCUS_CAMERA_Y + 2, 7], 1.2)];

    (generatePreviewCameraCandidatesWithPitchTiers as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ pitchTiers }: { pitchTiers: unknown[] }) => {
        return pitchTiers.length === 1 ? baseCandidates : fallbackCandidates;
      }
    );

    (pickBestPreviewCameraCandidateByRaycastWithMetrics as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ candidates }: { candidates: Candidate[] }) => {
        return {
          candidate: candidates[0],
          score: 10,
          minVisibility: 1,
          avgVisibility: 1,
          clearCount: 1,
          clearFraction: 1,
          sampleCount: 1,
        };
      }
    );

    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      verticalTiers: { enabled: true },
    });

    expect(result.position.y).toBeGreaterThanOrEqual(MIN_FOCUS_CAMERA_Y);
    expect(result.azimuth).toBeCloseTo(fallbackCandidates[0].azimuth, 6);
    expect(result.position.x).toBeCloseTo(fallbackCandidates[0].position[0], 6);
    expect(result.position.y).toBeCloseTo(fallbackCandidates[0].position[1], 6);
    expect(result.position.z).toBeCloseTo(fallbackCandidates[0].position[2], 6);
    expect(generatePreviewCameraCandidatesWithPitchTiers).toHaveBeenCalledTimes(2);
  });

  it('falls back to the ideal position when no above-ground candidate exists', async () => {
    const { generatePreviewCameraCandidatesWithPitchTiers } = await import('./previewCameraCalculator');
    const { pickBestPreviewCameraCandidateByRaycastWithMetrics } = await import('./previewCameraOcclusion');
    const { calculateOcclusionAwareFocusCamera, MIN_FOCUS_CAMERA_Y } = await import('./focusCameraOcclusion');

    const undergroundCandidates = [candidate([1, MIN_FOCUS_CAMERA_Y - 10, 3], 0.1)];

    (generatePreviewCameraCandidatesWithPitchTiers as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => undergroundCandidates
    );

    (pickBestPreviewCameraCandidateByRaycastWithMetrics as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ candidates }: { candidates: Candidate[] }) => {
        return {
          candidate: candidates[0],
          score: 10,
          minVisibility: 1,
          avgVisibility: 1,
          clearCount: 1,
          clearFraction: 1,
          sampleCount: 1,
        };
      }
    );

    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: -10, targetZ: 0, boundsSize: 1 };
    const ideal = calculateIdealCameraPosition(target);

    const result = calculateOcclusionAwareFocusCamera({
      target,
      scene,
      targetObjectId: 'target',
      verticalTiers: { enabled: false },
    });

    expect(result.position.y).toBeGreaterThanOrEqual(MIN_FOCUS_CAMERA_Y);
    expect(result.position.x).toBeCloseTo(ideal.x, 6);
    expect(result.position.z).toBeCloseTo(ideal.z, 6);
  });
});

describe('calculateOcclusionAwareFocusCameraAsync (ground fallback)', () => {
  it('skips an underground base-tier winner and returns the best above-ground candidate from already-tested tiers', async () => {
    const { generatePreviewCameraCandidatesWithPitchTiers } = await import('./previewCameraCalculator');
    const { pickBestPreviewCameraCandidateByRaycastWithMetricsAsync } = await import('./previewCameraOcclusion');
    const { calculateOcclusionAwareFocusCameraAsync, MIN_FOCUS_CAMERA_Y } = await import(
      './focusCameraOcclusion'
    );

    const baseCandidates = [candidate([1, MIN_FOCUS_CAMERA_Y - 1, 3], 0.1)];
    const fallbackCandidates = [candidate([9, MIN_FOCUS_CAMERA_Y + 2, 7], 1.2)];

    (generatePreviewCameraCandidatesWithPitchTiers as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ pitchTiers }: { pitchTiers: unknown[] }) => {
        return pitchTiers.length === 1 ? baseCandidates : fallbackCandidates;
      }
    );

    (pickBestPreviewCameraCandidateByRaycastWithMetricsAsync as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ candidates }: { candidates: Candidate[] }) => {
        return {
          candidate: candidates[0],
          score: 10,
          minVisibility: 1,
          avgVisibility: 1,
          clearCount: 1,
          clearFraction: 1,
          sampleCount: 1,
        };
      }
    );

    const scene = new THREE.Scene();
    const target: FocusTarget = { targetX: 0, targetY: 0, targetZ: 0, boundsSize: 1 };

    const result = await calculateOcclusionAwareFocusCameraAsync({
      target,
      scene,
      targetObjectId: 'target',
      verticalTiers: { enabled: true },
    });

    expect(result.position.y).toBeGreaterThanOrEqual(MIN_FOCUS_CAMERA_Y);
    expect(result.azimuth).toBeCloseTo(fallbackCandidates[0].azimuth, 6);
    expect(result.position.x).toBeCloseTo(fallbackCandidates[0].position[0], 6);
    expect(result.position.y).toBeCloseTo(fallbackCandidates[0].position[1], 6);
    expect(result.position.z).toBeCloseTo(fallbackCandidates[0].position[2], 6);
    expect(generatePreviewCameraCandidatesWithPitchTiers).toHaveBeenCalledTimes(2);
  });
});

