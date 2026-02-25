import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  clearBackgroundTextureCache,
  getBackgroundTextureCacheKey,
  getCachedBackgroundTexture,
  loadBackgroundTexture,
} from './backgroundTextureCache';

describe('backgroundTextureCache', () => {
  beforeEach(() => {
    clearBackgroundTextureCache();
    vi.restoreAllMocks();
  });

  describe('getBackgroundTextureCacheKey', () => {
    it('strips query params for stable cache keys', () => {
      expect(
        getBackgroundTextureCacheKey('https://example.com/a/b/c.jpg?token=abc&x=1')
      ).toBe('https://example.com/a/b/c.jpg');
    });

    it('returns the original string for non-URL inputs', () => {
      expect(getBackgroundTextureCacheKey('not a url')).toBe('not a url');
    });
  });

  it('reuses cached texture across different signed URL rotations', async () => {
    const loadSpy = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockImplementation((_url: string, onLoad?: (t: THREE.Texture) => void) => {
        const texture = new THREE.Texture();
        onLoad?.(texture);
        // Match the signature: return a Texture.
        return texture;
      });

    const urlA = 'https://example.com/bg/pano.jpg?token=abc';
    const urlB = 'https://example.com/bg/pano.jpg?token=def';

    await loadBackgroundTexture(urlA);

    const cachedFromB = getCachedBackgroundTexture(urlB);
    expect(cachedFromB).not.toBeNull();
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('evicts the least-recently used loaded textures beyond the cap', async () => {
    // This test relies on the module cap (MAX_CACHED_BACKGROUND_TEXTURES = 8).
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
      (_url: string, onLoad?: (t: THREE.Texture) => void) => {
        const texture = new THREE.Texture();
        onLoad?.(texture);
        return texture;
      }
    );

    const urls = Array.from({ length: 9 }, (_, i) => `https://example.com/bg/${i}.jpg?token=x`);
    for (const url of urls) {
      await loadBackgroundTexture(url);
    }

    // Oldest should be evicted once we exceed the cap.
    expect(getCachedBackgroundTexture(urls[0])).toBeNull();
    // Newest should still be cached.
    expect(getCachedBackgroundTexture(urls[8])).not.toBeNull();
  });
});

