import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedSnapshotByToken } from '../../services/publishService';
import { PopupOptions } from '../../contexts/PopupContext';
import { SceneObject, SimStep } from '../../types';
import { toSceneSettings, type SceneSettings } from '../../types/sceneSettings';
import type { SimulationSettings } from '../../types/simulationSettings';
import { toSimulationSettings } from '../../types/simulationSettings';
import { clearAssetResolver, setAssetResolver } from '../../utils/modelCache';
import { preloadBackgroundTexture } from '../../utils/backgroundTextureCache';
import { logger } from '../../utils/logger';
import { getPublishedSceneBackgroundUrl, getPublishedSceneWorldEnvironmentUrl } from '../../utils/sceneBackgroundUrl';
import { getStarterAssetById } from '../../services/starterAssetService';

interface PublishedProject {
  objects: SceneObject[];
  steps: SimStep[];
  name: string;
  sceneSettings: SceneSettings;
  simulationSettings: SimulationSettings;
}

interface UsePublishedSnapshotResult {
  project: PublishedProject | null;
  isInitialized: boolean;
  previewObjects: SceneObject[];
  setPreviewObjects: Dispatch<SetStateAction<SceneObject[]>>;
}

/**
 * Loads a published simulation snapshot (by share token) and configures the asset resolver.
 * Starter assets referenced by the snapshot are resolved from the starter catalog on demand.
 *
 * This hook owns lifecycle cleanup for the asset resolver.
 */
export function usePublishedSnapshot(
  tokenParam: string | null,
  showPopup: (options: PopupOptions) => void
): UsePublishedSnapshotResult {
  const [project, setProject] = useState<PublishedProject | null>(null);
  const [previewObjects, setPreviewObjects] = useState<SceneObject[]>([]);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const isInitialized = useMemo(() => loadedToken === tokenParam, [loadedToken, tokenParam]);

  useEffect(() => {
    let isCancelled = false;

    // Reset initialization when token changes.
    setLoadedToken(null);
    setProject(null);
    setPreviewObjects([]);

    if (!tokenParam) {
      setLoadedToken(null);
      return;
    }

    const loadProject = async () => {
      try {
        const snapshot = await fetchPublishedSnapshotByToken(tokenParam);
        if (isCancelled) return;

        if (!snapshot) {
          setProject(null);
          setLoadedToken(tokenParam);
          return;
        }

        setAssetResolver(async (assetId) => {
          try {
            const entry = snapshot.assetManifest?.[assetId];
            if (entry) {
              return { url: entry.url, fileType: entry.fileType };
            }

            if (assetId.startsWith('starter:')) {
              const starter = await getStarterAssetById(assetId);
              if (
                starter &&
                (starter.fileType === 'glb' || starter.fileType === 'fbx' || starter.fileType === 'obj')
              ) {
                return { url: starter.publicUrl, fileType: starter.fileType };
              }
            }

            return null;
          } catch (error) {
            logger.warn('[usePublishedSnapshot] Failed to resolve asset for published snapshot:', {
              assetId,
              error,
            });
            return null;
          }
        });

        const backgroundUrl = getPublishedSceneBackgroundUrl(snapshot.sceneSettings);
        const worldEnvironmentUrl = getPublishedSceneWorldEnvironmentUrl(snapshot.sceneSettings);
        preloadBackgroundTexture(backgroundUrl);

        const normalizedSceneSettings = toSceneSettings({
          ...snapshot.sceneSettings,
          backgroundImage: snapshot.sceneSettings?.backgroundImage
            ? {
                ...snapshot.sceneSettings.backgroundImage,
                signedUrl: backgroundUrl,
              }
            : undefined,
          worldEnvironment: snapshot.sceneSettings?.worldEnvironment
            ? {
                ...snapshot.sceneSettings.worldEnvironment,
                spzUrl: worldEnvironmentUrl ?? snapshot.sceneSettings.worldEnvironment.spzUrl,
              }
            : undefined,
        });

        setProject({
          objects: snapshot.objects,
          steps: snapshot.steps,
          name: snapshot.name,
          sceneSettings: normalizedSceneSettings,
          simulationSettings: toSimulationSettings(snapshot.simulationSettings),
        });
        setPreviewObjects(snapshot.objects.map((obj) => ({ ...obj })));
        setLoadedToken(tokenParam);
      } catch (error) {
        logger.error('[usePublishedSnapshot] Failed to load published snapshot:', error);
        showPopup({
          type: 'error',
          title: 'Training Load Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load this training right now. Please try again.',
        });
        setProject(null);
        setLoadedToken(tokenParam);
      }
    };

    void loadProject();

    return () => {
      isCancelled = true;
      clearAssetResolver();
    };
  }, [showPopup, tokenParam]);

  return { project, isInitialized, previewObjects, setPreviewObjects };
}

