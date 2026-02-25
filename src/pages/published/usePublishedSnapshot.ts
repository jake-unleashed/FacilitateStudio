import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedSnapshotByToken } from '../../services/publishService';
import { PopupOptions } from '../../contexts/PopupContext';
import { SceneObject, SimStep } from '../../types';
import { toSceneSettings, type SceneSettings } from '../../types/sceneSettings';
import type { SimulationSettings } from '../../types/simulationSettings';
import { toSimulationSettings } from '../../types/simulationSettings';
import { clearAssetResolver, setAssetResolver } from '../../utils/modelCache';
import { seedStarterAssets, shouldReseedLibrary } from '../../utils/starterAssets/seedStarterAssets';
import { preloadBackgroundTexture } from '../../utils/backgroundTextureCache';
import { logger } from '../../utils/logger';
import { getPublishedSceneBackgroundUrl } from '../../utils/sceneBackgroundUrl';

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
 * Also seeds starter assets if the snapshot references them.
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

        // Ensure starter assets are available if the snapshot references them.
        const usesStarter = snapshot.objects.some(
          (obj) =>
            typeof obj.properties?.modelAssetId === 'string' &&
            obj.properties.modelAssetId.startsWith('starter:')
        );
        if (usesStarter && shouldReseedLibrary()) {
          await seedStarterAssets();
        }

        setAssetResolver((assetId) => {
          const entry = snapshot.assetManifest?.[assetId];
          if (!entry) return null;
          return { url: entry.url, fileType: entry.fileType };
        });

        const backgroundUrl = getPublishedSceneBackgroundUrl(snapshot.sceneSettings);
        preloadBackgroundTexture(backgroundUrl);

        const normalizedSceneSettings = toSceneSettings({
          ...snapshot.sceneSettings,
          backgroundImage: snapshot.sceneSettings?.backgroundImage
            ? {
                ...snapshot.sceneSettings.backgroundImage,
                signedUrl: backgroundUrl,
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

