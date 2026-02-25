export interface SceneBackgroundImage {
  /** Storage key in Supabase storage bucket. */
  storageKey: string;
  /** Original file name selected by the user. */
  filename: string;
  /** Original file size in bytes. */
  fileSize: number;
  /** Optional resolved URL used at runtime for rendering. */
  signedUrl?: string;
}

export interface SceneSettings {
  /** Optional 360 equirectangular panoramic background image. */
  backgroundImage?: SceneBackgroundImage;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {};

export function toSceneSettings(value?: Partial<SceneSettings> | null): SceneSettings {
  if (!value?.backgroundImage) {
    return DEFAULT_SCENE_SETTINGS;
  }

  const backgroundImage = value.backgroundImage;
  if (
    typeof backgroundImage.storageKey !== 'string' ||
    backgroundImage.storageKey.trim().length === 0 ||
    typeof backgroundImage.filename !== 'string' ||
    backgroundImage.filename.trim().length === 0 ||
    typeof backgroundImage.fileSize !== 'number' ||
    !Number.isFinite(backgroundImage.fileSize) ||
    backgroundImage.fileSize <= 0
  ) {
    return DEFAULT_SCENE_SETTINGS;
  }

  return {
    backgroundImage: {
      storageKey: backgroundImage.storageKey,
      filename: backgroundImage.filename,
      fileSize: backgroundImage.fileSize,
      signedUrl: typeof backgroundImage.signedUrl === 'string' ? backgroundImage.signedUrl : undefined,
    },
  };
}
