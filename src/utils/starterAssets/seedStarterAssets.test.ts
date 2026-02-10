/**
 * Tests for seedStarterAssets - starter library version and reseed logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shouldReseedLibrary,
  getStarterAssetIds,
  STARTER_LIBRARY_VERSION,
} from './seedStarterAssets';

// Mock modelAssetStore to avoid IndexedDB in tests
vi.mock('../modelAssetStore', () => ({
  upsertAssetFromBlob: vi.fn().mockResolvedValue(undefined),
}));

// Mock discoverStarterAssets - we control the return value
vi.mock('./discoverStarterAssets', () => ({
  discoverStarterAssets: vi.fn(() => [
    { id: 'starter:test', name: 'test', fileType: 'glb' as const, url: '/test.glb' },
  ]),
}));

const LIBRARY_VERSION_KEY = 'facilitate-starter-library-version';

describe('seedStarterAssets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('shouldReseedLibrary', () => {
    it('returns true when never seeded (no localStorage entry)', () => {
      expect(shouldReseedLibrary()).toBe(true);
    });

    it('returns false when seeded with current version', () => {
      localStorage.setItem(LIBRARY_VERSION_KEY, STARTER_LIBRARY_VERSION);
      expect(shouldReseedLibrary()).toBe(false);
    });

    it('returns true when seeded with old version', () => {
      localStorage.setItem(LIBRARY_VERSION_KEY, '1');
      expect(shouldReseedLibrary()).toBe(true);
    });
  });

  describe('getStarterAssetIds', () => {
    it('returns array of starter asset IDs from discoverStarterAssets', () => {
      const ids = getStarterAssetIds();
      expect(ids).toEqual(['starter:test']);
    });
  });
});
