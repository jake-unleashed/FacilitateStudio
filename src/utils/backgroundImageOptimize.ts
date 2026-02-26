const BYTES_PER_MB = 1024 * 1024;
const JPEG_MIME_TYPE = 'image/jpeg';

export const MAX_INPUT_FILE_SIZE_BYTES = 100 * BYTES_PER_MB;
export const OPTIMIZATION_SIZE_THRESHOLD_BYTES = 20 * BYTES_PER_MB;
export const MAX_OUTPUT_WIDTH = 8192;
export const JPEG_QUALITY = 0.85;

interface ImageDimensions {
  width: number;
  height: number;
}

function toOptimizedFileName(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex <= 0 ? filename : filename.slice(0, dotIndex);
  return `${base || 'background'}.jpg`;
}

function getTargetDimensions(dimensions: ImageDimensions): ImageDimensions {
  if (dimensions.width <= MAX_OUTPUT_WIDTH) {
    return dimensions;
  }
  const ratio = MAX_OUTPUT_WIDTH / dimensions.width;
  return {
    width: MAX_OUTPUT_WIDTH,
    height: Math.max(1, Math.round(dimensions.height * ratio)),
  };
}

async function decodeImageBitmap(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Your browser does not support background image optimization.');
  }
  return createImageBitmap(file);
}

function imageBitmapDimensions(bitmap: ImageBitmap): ImageDimensions {
  return { width: bitmap.width, height: bitmap.height };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode optimized background image.'));
          return;
        }
        resolve(blob);
      },
      JPEG_MIME_TYPE,
      JPEG_QUALITY
    );
  });
}

/**
 * Yields two animation frames, guaranteeing the browser has painted at least
 * once before we start a potentially long-running synchronous operation.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function needsOptimization(file: File): Promise<boolean> {
  if (file.size > OPTIMIZATION_SIZE_THRESHOLD_BYTES) {
    return true;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodeImageBitmap(file);
    const { width } = imageBitmapDimensions(bitmap);
    return width > MAX_OUTPUT_WIDTH;
  } finally {
    bitmap?.close();
  }
}

export async function optimizeBackgroundImage(file: File): Promise<File> {
  let shouldOptimize = false;
  try {
    shouldOptimize = await needsOptimization(file);
  } catch {
    throw new Error('Unable to optimize background image. Try a smaller JPG, PNG, or WebP image.');
  }
  if (!shouldOptimize) return file;

  let sourceBitmap: ImageBitmap | null = null;
  try {
    // Single decode — createImageBitmap runs off the main thread in modern browsers,
    // so the UI stays responsive during the download/decompress phase.
    // We previously decoded twice (once for dimensions, once for resize), which doubled
    // the off-thread work. Now we decode once and scale during drawImage instead.
    sourceBitmap = await decodeImageBitmap(file);
    const targetDimensions = getTargetDimensions(imageBitmapDimensions(sourceBitmap));

    const canvas = createCanvas(targetDimensions.width, targetDimensions.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to process background image.');
    }

    // Scale to target size during draw (avoids a second createImageBitmap call).
    context.drawImage(sourceBitmap, 0, 0, targetDimensions.width, targetDimensions.height);
    sourceBitmap.close();
    sourceBitmap = null;

    // canvas.toBlob (JPEG encoding) can block the main thread for several seconds
    // on large images, preventing any React renders from painting. Yielding two
    // animation frames here guarantees the loading indicator is visible to the user
    // before the encoder starts running.
    await yieldToBrowser();

    const optimizedBlob = await toJpegBlob(canvas);

    return new File([optimizedBlob], toOptimizedFileName(file.name), {
      type: JPEG_MIME_TYPE,
      lastModified: Date.now(),
    });
  } catch {
    throw new Error('Unable to optimize background image. Try a smaller JPG, PNG, or WebP image.');
  } finally {
    sourceBitmap?.close();
  }
}
