import { supabase } from '../lib/supabase';

const BACKGROUND_BUCKET = 'user-assets';
const BACKGROUND_STORAGE_PREFIX = 'bg://';
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export const SUPPORTED_BACKGROUND_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_BACKGROUND_IMAGE_SIZE_BYTES = 100 * 1024 * 1024;

export interface UploadBackgroundImageResult {
  storagePath: string;
  signedUrl: string;
}

function sanitizeFileName(filename: string): string {
  return filename.replace(/[/\\]/g, '_');
}

export function isValidBackgroundImageFileType(type: string): boolean {
  return (SUPPORTED_BACKGROUND_IMAGE_TYPES as readonly string[]).includes(type);
}

export function toBackgroundImageStorageRef(path: string): string {
  return `${BACKGROUND_STORAGE_PREFIX}${path}`;
}

export function extractBackgroundImageStoragePath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(BACKGROUND_STORAGE_PREFIX)) {
    return null;
  }
  return value.slice(BACKGROUND_STORAGE_PREFIX.length);
}

export async function uploadBackgroundImageToStorage(
  file: File,
  userId: string,
  projectId: string
): Promise<UploadBackgroundImageResult> {
  const storagePath = `${userId}/${projectId}/background/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BACKGROUND_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    throw new Error('Failed to upload background image. Please try again.');
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(BACKGROUND_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    throw new Error('Failed to prepare background image. Please try again.');
  }

  return {
    storagePath,
    signedUrl: signedData.signedUrl,
  };
}

export async function resolveBackgroundImageUrl(
  storagePathOrRef: string | null | undefined
): Promise<string | undefined> {
  if (!storagePathOrRef) return undefined;

  const storagePath = extractBackgroundImageStoragePath(storagePathOrRef) ?? storagePathOrRef;
  const { data, error } = await supabase.storage
    .from(BACKGROUND_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return undefined;
  }
  return data.signedUrl;
}

export async function removeBackgroundImageFromStorage(
  storagePathOrRef: string | null | undefined
): Promise<void> {
  if (!storagePathOrRef) return;
  const storagePath = extractBackgroundImageStoragePath(storagePathOrRef) ?? storagePathOrRef;
  await supabase.storage.from(BACKGROUND_BUCKET).remove([storagePath]);
}
