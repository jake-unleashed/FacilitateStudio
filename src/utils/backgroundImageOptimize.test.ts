import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_OUTPUT_WIDTH,
  needsOptimization,
  optimizeBackgroundImage,
  OPTIMIZATION_SIZE_THRESHOLD_BYTES,
} from './backgroundImageOptimize';

type MockBitmap = Pick<ImageBitmap, 'width' | 'height' | 'close'>;

function createBitmap(width: number, height: number): MockBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  };
}

function createFile(name: string, sizeBytes: number, type: string): File {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true });
  return file;
}

/** Make requestAnimationFrame synchronous so tests don't wait for real frames. */
function stubRaf(): void {
  const immediateRaf = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
  vi.stubGlobal('requestAnimationFrame', immediateRaf);
  if (typeof window !== 'undefined') {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(immediateRaf);
  }
}

describe('backgroundImageOptimize', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubRaf();
  });

  it('returns false from needsOptimization for small images within width limit', async () => {
    const createImageBitmapMock = vi.fn().mockResolvedValue(createBitmap(4096, 2048));
    vi.stubGlobal('createImageBitmap', createImageBitmapMock);
    const file = createFile('small.jpg', 2 * 1024 * 1024, 'image/jpeg');

    await expect(needsOptimization(file)).resolves.toBe(false);
    expect(createImageBitmapMock).toHaveBeenCalledOnce();
  });

  it('returns true from needsOptimization when file exceeds size threshold', async () => {
    const createImageBitmapMock = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmapMock);
    const file = createFile('large.jpg', OPTIMIZATION_SIZE_THRESHOLD_BYTES + 1, 'image/jpeg');

    await expect(needsOptimization(file)).resolves.toBe(true);
    expect(createImageBitmapMock).not.toHaveBeenCalled();
  });

  it('optimizes oversized panoramas: one decode, drawImage to target size, JPEG output', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const sourceBitmap = createBitmap(12000, 6000);
    const createImageBitmapMock = vi.fn().mockResolvedValue(sourceBitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmapMock);

    const drawImageMock = vi.fn();
    const toBlobMock = vi.fn((callback: BlobCallback) => {
      callback(new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }));
    });
    const getContextMock = vi.fn().mockReturnValue({ drawImage: drawImageMock });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string): HTMLElement => {
      if (String(tagName).toLowerCase() === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: getContextMock,
          toBlob: toBlobMock,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const file = createFile('panorama.png', OPTIMIZATION_SIZE_THRESHOLD_BYTES + 10, 'image/png');
    const optimized = await optimizeBackgroundImage(file);

    expect(optimized.type).toBe('image/jpeg');
    expect(optimized.name).toBe('panorama.jpg');
    expect(optimized.size).toBe(1024);

    // Only ONE decode — no second createImageBitmap for resize
    expect(createImageBitmapMock).toHaveBeenCalledOnce();
    expect(createImageBitmapMock).toHaveBeenCalledWith(file);

    // drawImage scales source to target dimensions (8192 wide for a 2:1 panorama)
    const expectedHeight = Math.round(6000 * (MAX_OUTPUT_WIDTH / 12000)); // 4096
    expect(drawImageMock).toHaveBeenCalledWith(sourceBitmap, 0, 0, MAX_OUTPUT_WIDTH, expectedHeight);
  });

  it('returns original file when optimization is not needed', async () => {
    const createImageBitmapMock = vi
      .fn()
      .mockResolvedValueOnce(createBitmap(2048, 1024));
    vi.stubGlobal('createImageBitmap', createImageBitmapMock);

    const file = createFile('already-good.webp', 4 * 1024 * 1024, 'image/webp');
    const optimized = await optimizeBackgroundImage(file);

    expect(optimized).toBe(file);
  });

  it('throws a user-friendly error when image decoding fails', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));
    const file = createFile('broken.webp', 3 * 1024 * 1024, 'image/webp');

    await expect(optimizeBackgroundImage(file)).rejects.toThrow(
      'Unable to optimize background image. Try a smaller JPG, PNG, or WebP image.'
    );
  });
});
