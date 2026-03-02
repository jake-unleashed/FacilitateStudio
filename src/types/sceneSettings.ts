export interface SceneBackgroundImage {
  /** Storage key in Supabase storage bucket. */
  storageKey: string;
  /** Original file name selected by the user. */
  filename: string;
  /** Stored background image file size in bytes. */
  fileSize: number;
  /** Optional resolved URL used at runtime for rendering. */
  signedUrl?: string;
}

export type WorldEnvironmentStatus = 'generating' | 'ready' | 'error';

export interface SceneWorldEnvironment {
  worldId: string;
  operationId: string;
  status: WorldEnvironmentStatus;
  sourceImageFilename: string;
  spzUrl?: string;
  spzUrls?: Record<string, string>;
  thumbnailUrl?: string;
  worldMarbleUrl?: string;
  errorMessage?: string;
  /** Optional position offset from auto-fitted environment center-ground. */
  positionX?: number;
  /** Optional position offset from auto-fitted environment center-ground. */
  positionY?: number;
  /** Optional position offset from auto-fitted environment center-ground. */
  positionZ?: number;
  /** Optional rotation offset in degrees from auto-fitted orientation. */
  rotationX?: number;
  /** Optional rotation offset in degrees from auto-fitted orientation. */
  rotationY?: number;
  /** Optional rotation offset in degrees from auto-fitted orientation. */
  rotationZ?: number;
  /** Optional scale multiplier applied on top of auto-fit scale. */
  scale?: number;
  createdAt: string;
}

export interface SceneSettings {
  /** Optional 360 equirectangular panoramic background image. */
  backgroundImage?: SceneBackgroundImage;
  /** Optional generated volumetric world environment (Gaussian splat). */
  worldEnvironment?: SceneWorldEnvironment;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {};

export function toSceneSettings(value?: Partial<SceneSettings> | null): SceneSettings {
  const normalizedBackgroundImage = normalizeBackgroundImage(value?.backgroundImage);
  const normalizedWorldEnvironment = normalizeWorldEnvironment(value?.worldEnvironment);

  if (!normalizedBackgroundImage && !normalizedWorldEnvironment) {
    return DEFAULT_SCENE_SETTINGS;
  }

  return {
    ...(normalizedBackgroundImage ? { backgroundImage: normalizedBackgroundImage } : {}),
    ...(normalizedWorldEnvironment ? { worldEnvironment: normalizedWorldEnvironment } : {}),
  };
}

function normalizeBackgroundImage(
  backgroundImage?: Partial<SceneBackgroundImage> | null
): SceneBackgroundImage | undefined {
  if (!backgroundImage) return undefined;
  if (
    typeof backgroundImage.storageKey !== 'string' ||
    backgroundImage.storageKey.trim().length === 0 ||
    typeof backgroundImage.filename !== 'string' ||
    backgroundImage.filename.trim().length === 0 ||
    typeof backgroundImage.fileSize !== 'number' ||
    !Number.isFinite(backgroundImage.fileSize) ||
    backgroundImage.fileSize <= 0
  ) {
    return undefined;
  }
  return {
    storageKey: backgroundImage.storageKey,
    filename: backgroundImage.filename,
    fileSize: backgroundImage.fileSize,
    signedUrl: typeof backgroundImage.signedUrl === 'string' ? backgroundImage.signedUrl : undefined,
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function positiveFiniteNumber(value: unknown): number | undefined {
  const n = finiteNumber(value);
  return n !== undefined && n > 0 ? n : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

const VALID_WORLD_STATUSES: ReadonlySet<WorldEnvironmentStatus> = new Set(['generating', 'ready', 'error']);

function normalizeWorldEnvironment(
  worldEnvironment?: Partial<SceneWorldEnvironment> | null
): SceneWorldEnvironment | undefined {
  if (!worldEnvironment) return undefined;
  const status = worldEnvironment.status;
  if (!status || !VALID_WORLD_STATUSES.has(status)) return undefined;

  const worldId = nonEmptyString(worldEnvironment.worldId);
  const operationId = nonEmptyString(worldEnvironment.operationId);
  const sourceImageFilename = nonEmptyString(worldEnvironment.sourceImageFilename);
  const createdAt = nonEmptyString(worldEnvironment.createdAt);
  if (!worldId || !operationId || !sourceImageFilename || !createdAt) return undefined;

  const normalizedSpzUrls =
    worldEnvironment.spzUrls && typeof worldEnvironment.spzUrls === 'object'
      ? Object.fromEntries(
          Object.entries(worldEnvironment.spzUrls).filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === 'string' &&
              entry[0].length > 0 &&
              typeof entry[1] === 'string' &&
              entry[1].length > 0
          )
        )
      : undefined;

  return {
    worldId,
    operationId,
    status,
    sourceImageFilename,
    spzUrl: nonEmptyString(worldEnvironment.spzUrl),
    spzUrls: normalizedSpzUrls && Object.keys(normalizedSpzUrls).length > 0 ? normalizedSpzUrls : undefined,
    thumbnailUrl: nonEmptyString(worldEnvironment.thumbnailUrl),
    worldMarbleUrl: nonEmptyString(worldEnvironment.worldMarbleUrl),
    errorMessage: nonEmptyString(worldEnvironment.errorMessage),
    positionX: finiteNumber(worldEnvironment.positionX),
    positionY: finiteNumber(worldEnvironment.positionY),
    positionZ: finiteNumber(worldEnvironment.positionZ),
    rotationX: finiteNumber(worldEnvironment.rotationX),
    rotationY: finiteNumber(worldEnvironment.rotationY),
    rotationZ: finiteNumber(worldEnvironment.rotationZ),
    scale: positiveFiniteNumber(worldEnvironment.scale),
    createdAt,
  };
}
