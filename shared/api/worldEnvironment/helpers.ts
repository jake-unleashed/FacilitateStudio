import { z } from 'zod';
import { WORLD_LABS_API_BASE_URL, WORLD_LABS_DEFAULT_MODEL } from './constants.js';
import type { ParsedDataUrlImage, WorldEnvironmentStatusResponse } from './types.js';

const createRequestSchema = z
  .object({
    imageDataUrl: z.string().trim().min(1),
    imageName: z.string().trim().optional(),
  })
  .passthrough();

function sanitizeDisplayName(name?: string): string | undefined {
  if (!name) return undefined;
  const withoutExt = name.replace(/\.[^/.]+$/, '').trim();
  if (!withoutExt) return undefined;
  return withoutExt.slice(0, 120);
}

function normalizeExtensionFromMime(mimeType: string): ParsedDataUrlImage['extension'] | null {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

export function parseWorldEnvironmentCreateRequestBody(data: unknown):
  | {
      ok: true;
      imageDataUrl: string;
      imageName?: string;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    } {
  const parsed = createRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Missing or invalid "imageDataUrl" field' };
  }

  const imageDataUrl = parsed.data.imageDataUrl.trim();
  if (!imageDataUrl.startsWith('data:image/')) {
    return { ok: false, status: 400, error: 'imageDataUrl must be an image data URL' };
  }

  return {
    ok: true,
    imageDataUrl,
    imageName: parsed.data.imageName,
  };
}

export function parseImageDataUrl(dataUrl: string): ParsedDataUrlImage {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Only base64 image data URLs are supported');
  }

  const mimeType = match[1].toLowerCase();
  const extension = normalizeExtensionFromMime(mimeType);
  if (!extension) {
    throw new Error('Unsupported image type. Use JPG, PNG, or WebP');
  }

  const dataBase64 = match[2];
  return {
    mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : (mimeType as ParsedDataUrlImage['mimeType']),
    extension,
    dataBase64,
  };
}

async function parseJsonOrThrow(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`World Labs request failed with status ${response.status}`);
  }
}

function extractProgress(metadata: unknown): number | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const record = metadata as Record<string, unknown>;
  const candidates = [
    record.progress,
    record.progress_percentage,
    record.progressPercent,
    record.percent,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.max(0, Math.min(100, Math.round(candidate)));
    }
  }
  return undefined;
}

function pickBestSpzUrl(spzUrls: Record<string, string> | null | undefined): string | undefined {
  if (!spzUrls) return undefined;
  const preferredKeyOrder = ['ultra', 'max', 'full', 'high', 'medium', 'low'];
  for (const key of preferredKeyOrder) {
    const value = spzUrls[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  for (const value of Object.values(spzUrls)) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  const message = record.message;
  if (typeof message === 'string' && message.trim().length > 0) return message;
  const detail = record.detail;
  if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  return fallback;
}

export async function createWorldEnvironmentGeneration(args: {
  apiKey: string;
  imageDataUrl: string;
  imageName?: string;
}): Promise<{ operationId: string }> {
  const parsedImage = parseImageDataUrl(args.imageDataUrl);
  const payload = {
    display_name: sanitizeDisplayName(args.imageName),
    model: WORLD_LABS_DEFAULT_MODEL,
    world_prompt: {
      type: 'image',
      image_prompt: {
        source: 'data_base64',
        data_base64: parsedImage.dataBase64,
        extension: parsedImage.extension,
      },
      is_pano: false,
    },
  };

  const response = await fetch(`${WORLD_LABS_API_BASE_URL}/marble/v1/worlds:generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'WLT-Api-Key': args.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrThrow(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, `World generation failed with status ${response.status}`));
  }

  const operationId =
    data && typeof data === 'object' ? (data as { operation_id?: unknown }).operation_id : undefined;
  if (typeof operationId !== 'string' || operationId.length === 0) {
    throw new Error('World Labs did not return a valid operation_id');
  }
  return { operationId };
}

export async function getWorldEnvironmentStatus(args: {
  apiKey: string;
  operationId: string;
}): Promise<WorldEnvironmentStatusResponse> {
  const response = await fetch(
    `${WORLD_LABS_API_BASE_URL}/marble/v1/operations/${encodeURIComponent(args.operationId)}`,
    {
      method: 'GET',
      headers: {
        'WLT-Api-Key': args.apiKey,
      },
    }
  );
  const data = await parseJsonOrThrow(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, `Status request failed with status ${response.status}`));
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid World Labs operation response');
  }
  const payload = data as Record<string, unknown>;
  const done = payload.done === true;
  const operationError = payload.error;
  if (operationError && typeof operationError === 'object') {
    const message = extractErrorMessage(operationError, 'World generation failed');
    return {
      done: true,
      error: message,
    };
  }

  if (!done) {
    return {
      done: false,
      progress: extractProgress(payload.metadata),
    };
  }

  const world = payload.response;
  if (!world || typeof world !== 'object') {
    return {
      done: true,
      error: 'World generation completed without a world payload',
    };
  }

  const worldRecord = world as Record<string, unknown>;
  const worldId = typeof worldRecord.world_id === 'string' ? worldRecord.world_id : undefined;
  const worldMarbleUrl =
    typeof worldRecord.world_marble_url === 'string' ? worldRecord.world_marble_url : undefined;
  const assets = worldRecord.assets;
  const thumbnailUrl =
    assets && typeof assets === 'object' && typeof (assets as Record<string, unknown>).thumbnail_url === 'string'
      ? ((assets as Record<string, unknown>).thumbnail_url as string)
      : undefined;
  const splats = assets && typeof assets === 'object' ? (assets as Record<string, unknown>).splats : undefined;
  const spzUrlsRaw =
    splats && typeof splats === 'object' ? (splats as Record<string, unknown>).spz_urls : undefined;
  const spzUrls =
    spzUrlsRaw && typeof spzUrlsRaw === 'object'
      ? Object.fromEntries(
          Object.entries(spzUrlsRaw as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0
          )
        )
      : {};
  const spzUrl = pickBestSpzUrl(spzUrls);

  if (!worldId || !spzUrl) {
    return {
      done: true,
      error: 'World generation completed but no SPZ environment URL was returned',
    };
  }

  return {
    done: true,
    result: {
      worldId,
      worldMarbleUrl,
      spzUrl,
      spzUrls,
      thumbnailUrl,
    },
  };
}
