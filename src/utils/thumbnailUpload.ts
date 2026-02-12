import { supabase } from '../lib/supabase';

const THUMBNAIL_BUCKET = 'thumbnails';
const THUMBNAIL_STORAGE_PREFIX = 'thumb://';
// 24 hours — thumbnails are non-sensitive, and short TTLs cause broken images
// during long editing sessions. The user would need to reload after a full day
// for thumbnails to expire, which is a much better UX than the previous 1-hour window.
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
}

function base64ToBlob(base64Data: string, mimeType: string): Blob {
  if (typeof atob === 'function') {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  // Node/test fallback (atob is not guaranteed in non-browser environments)
  const buffer = Buffer.from(base64Data, 'base64');
  return new Blob([buffer], { type: mimeType });
}

export function isBase64Thumbnail(thumbnail: string | undefined): boolean {
  return typeof thumbnail === 'string' && thumbnail.startsWith('data:image/');
}

export function toThumbnailStorageRef(path: string): string {
  return `${THUMBNAIL_STORAGE_PREFIX}${path}`;
}

export function extractThumbnailStoragePath(
  thumbnail: string | null | undefined
): string | null {
  if (!thumbnail || !thumbnail.startsWith(THUMBNAIL_STORAGE_PREFIX)) {
    return null;
  }
  return thumbnail.slice(THUMBNAIL_STORAGE_PREFIX.length);
}

export async function uploadThumbnailToStorage(
  base64DataUrl: string,
  userId: string,
  projectId: string
): Promise<{ storagePath: string; signedUrl: string } | null> {
  const parsed = parseDataUrl(base64DataUrl);
  if (!parsed) return null;

  const blob = base64ToBlob(parsed.base64Data, parsed.mimeType);
  const storagePath = `${userId}/${projectId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(storagePath, blob, {
      contentType: parsed.mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.warn('[thumbnailUpload] Failed to upload thumbnail:', uploadError);
    return null;
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    console.warn('[thumbnailUpload] Uploaded thumbnail but failed to sign URL:', signedError);
    return null;
  }

  return {
    storagePath,
    signedUrl: signedData.signedUrl,
  };
}

export async function resolveThumbnailUrl(thumbnail: string | null | undefined): Promise<string | undefined> {
  if (!thumbnail) {
    return undefined;
  }

  const storagePath = extractThumbnailStoragePath(thumbnail);
  if (!storagePath) {
    return thumbnail;
  }

  const { data, error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn('[thumbnailUpload] Failed to resolve thumbnail URL:', error);
    return undefined;
  }

  return data.signedUrl;
}
