import { describe, it, expect } from 'vitest';
import { getPublishedSceneBackgroundUrl, getSceneBackgroundUrl } from './sceneBackgroundUrl';
import type { SceneSettings } from '../types/sceneSettings';
import type { PublishedSnapshot } from '../types/publish';

describe('sceneBackgroundUrl', () => {
  describe('getSceneBackgroundUrl', () => {
    it('returns undefined when missing', () => {
      expect(getSceneBackgroundUrl(undefined)).toBeUndefined();
      expect(getSceneBackgroundUrl(null)).toBeUndefined();
      expect(getSceneBackgroundUrl({} as SceneSettings)).toBeUndefined();
    });

    it('returns undefined for empty strings', () => {
      const settings: SceneSettings = {
        backgroundImage: {
          storageKey: 'k',
          filename: 'f.jpg',
          fileSize: 123,
          signedUrl: '',
        },
      };
      expect(getSceneBackgroundUrl(settings)).toBeUndefined();
    });

    it('returns the signedUrl when present', () => {
      const settings: SceneSettings = {
        backgroundImage: {
          storageKey: 'k',
          filename: 'f.jpg',
          fileSize: 123,
          signedUrl: 'https://example.com/bg.jpg?token=abc',
        },
      };
      expect(getSceneBackgroundUrl(settings)).toBe('https://example.com/bg.jpg?token=abc');
    });
  });

  describe('getPublishedSceneBackgroundUrl', () => {
    it('prefers backgroundImage.signedUrl when present', () => {
      const sceneSettings: NonNullable<PublishedSnapshot['sceneSettings']> = {
        backgroundImageUrl: 'https://example.com/fallback.jpg',
        backgroundImage: {
          storageKey: 'k',
          filename: 'f.jpg',
          fileSize: 123,
          signedUrl: 'https://example.com/preferred.jpg',
        },
      };
      expect(getPublishedSceneBackgroundUrl(sceneSettings)).toBe('https://example.com/preferred.jpg');
    });

    it('falls back to backgroundImageUrl', () => {
      const sceneSettings: NonNullable<PublishedSnapshot['sceneSettings']> = {
        backgroundImageUrl: 'https://example.com/fallback.jpg',
      };
      expect(getPublishedSceneBackgroundUrl(sceneSettings)).toBe('https://example.com/fallback.jpg');
    });

    it('returns undefined when empty', () => {
      const sceneSettings: NonNullable<PublishedSnapshot['sceneSettings']> = {
        backgroundImageUrl: '',
        backgroundImage: {
          storageKey: 'k',
          filename: 'f.jpg',
          fileSize: 123,
          signedUrl: '',
        },
      };
      expect(getPublishedSceneBackgroundUrl(sceneSettings)).toBeUndefined();
    });
  });
});

