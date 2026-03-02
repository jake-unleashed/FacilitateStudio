import type { SceneSettings } from '../types/sceneSettings';
import type { PublishedSnapshot } from '../types/publish';

type PublishedSceneSettings = PublishedSnapshot['sceneSettings'];

export function getSceneBackgroundUrl(sceneSettings?: SceneSettings | null): string | undefined {
  const signedUrl = sceneSettings?.backgroundImage?.signedUrl;
  return typeof signedUrl === 'string' && signedUrl.length > 0 ? signedUrl : undefined;
}

export function getSceneWorldEnvironmentUrl(sceneSettings?: SceneSettings | null): string | undefined {
  const spzUrl = sceneSettings?.worldEnvironment?.spzUrl;
  return typeof spzUrl === 'string' && spzUrl.length > 0 ? spzUrl : undefined;
}

export function getPublishedSceneBackgroundUrl(
  sceneSettings?: PublishedSceneSettings | null
): string | undefined {
  const fromBackgroundImage = sceneSettings?.backgroundImage?.signedUrl;
  if (typeof fromBackgroundImage === 'string' && fromBackgroundImage.length > 0) {
    return fromBackgroundImage;
  }

  const fallback = sceneSettings?.backgroundImageUrl;
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : undefined;
}

export function getPublishedSceneWorldEnvironmentUrl(
  sceneSettings?: PublishedSceneSettings | null
): string | undefined {
  const direct = sceneSettings?.worldEnvironment?.spzUrl;
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }
  const fallback =
    sceneSettings && typeof sceneSettings === 'object' && 'worldEnvironmentUrl' in sceneSettings
      ? (sceneSettings as PublishedSceneSettings & { worldEnvironmentUrl?: string }).worldEnvironmentUrl
      : undefined;
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : undefined;
}
