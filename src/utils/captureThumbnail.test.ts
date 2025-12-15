import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureThumbnail } from './captureThumbnail';

describe('captureThumbnail', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockOffscreenCanvas: HTMLCanvasElement;
  let mockOffscreenContext: CanvasRenderingContext2D;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    // Create mock source canvas (simulating WebGL canvas)
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Create mock offscreen canvas context
    mockOffscreenContext = {
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    // Create mock offscreen canvas
    mockOffscreenCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockOffscreenContext),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockImageData'),
    } as unknown as HTMLCanvasElement;

    // Mock document.createElement to return our mock offscreen canvas
    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockOffscreenCanvas;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful capture', () => {
    it('should return a base64 JPEG data URL', async () => {
      const result = await captureThumbnail(mockCanvas);

      expect(result).toBe('data:image/jpeg;base64,mockImageData');
    });

    it('should create an offscreen canvas with correct dimensions (320x180)', async () => {
      await captureThumbnail(mockCanvas);

      expect(mockOffscreenCanvas.width).toBe(320);
      expect(mockOffscreenCanvas.height).toBe(180);
    });

    it('should get 2D context from offscreen canvas', async () => {
      await captureThumbnail(mockCanvas);

      expect(mockOffscreenCanvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('should draw the background gradient first', async () => {
      await captureThumbnail(mockCanvas);

      expect(mockOffscreenContext.createRadialGradient).toHaveBeenCalled();
      expect(mockOffscreenContext.fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
    });

    it('should composite the source canvas on top of the gradient', async () => {
      await captureThumbnail(mockCanvas);

      expect(mockOffscreenContext.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0, 320, 180);
    });

    it('should export as JPEG with 0.7 quality', async () => {
      await captureThumbnail(mockCanvas);

      expect(mockOffscreenCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.7);
    });

    it('should draw gradient before drawing the source canvas', async () => {
      const callOrder: string[] = [];

      mockOffscreenContext.fillRect = vi.fn(() => callOrder.push('fillRect'));
      mockOffscreenContext.drawImage = vi.fn(() => callOrder.push('drawImage'));

      await captureThumbnail(mockCanvas);

      expect(callOrder).toEqual(['fillRect', 'drawImage']);
    });
  });

  describe('gradient configuration', () => {
    it('should create a radial gradient centered in the canvas', async () => {
      await captureThumbnail(mockCanvas);

      // Center should be at (160, 90) for a 320x180 canvas
      expect(mockOffscreenContext.createRadialGradient).toHaveBeenCalledWith(
        160, // centerX
        90, // centerY
        0, // inner radius
        160, // centerX again
        90, // centerY again
        expect.any(Number) // outer radius
      );
    });

    it('should add two color stops to the gradient', async () => {
      const mockGradient = {
        addColorStop: vi.fn(),
      };
      mockOffscreenContext.createRadialGradient = vi.fn().mockReturnValue(mockGradient);

      await captureThumbnail(mockCanvas);

      expect(mockGradient.addColorStop).toHaveBeenCalledTimes(2);
      expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, '#f8fafc'); // slate-50
      expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, '#cbd5e1'); // slate-300
    });
  });

  describe('error handling', () => {
    it('should return null if getContext returns null', async () => {
      mockOffscreenCanvas.getContext = vi.fn().mockReturnValue(null);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await captureThumbnail(mockCanvas);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get 2D context for thumbnail capture');
    });

    it('should return null and log error if toDataURL throws', async () => {
      mockOffscreenCanvas.toDataURL = vi.fn().mockImplementation(() => {
        throw new Error('Security error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await captureThumbnail(mockCanvas);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to capture thumbnail:', expect.any(Error));
    });

    it('should return null and log error if drawImage throws', async () => {
      mockOffscreenContext.drawImage = vi.fn().mockImplementation(() => {
        throw new Error('Canvas tainted');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await captureThumbnail(mockCanvas);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to capture thumbnail:', expect.any(Error));
    });
  });

  describe('thumbnail dimensions', () => {
    it('should maintain 16:9 aspect ratio (320:180)', async () => {
      await captureThumbnail(mockCanvas);

      const aspectRatio = mockOffscreenCanvas.width / mockOffscreenCanvas.height;
      expect(aspectRatio).toBeCloseTo(16 / 9, 2);
    });

    it('should scale down large source canvases', async () => {
      mockCanvas.width = 1920;
      mockCanvas.height = 1080;

      await captureThumbnail(mockCanvas);

      expect(mockOffscreenContext.drawImage).toHaveBeenCalledWith(
        mockCanvas,
        0,
        0,
        320, // scaled down width
        180 // scaled down height
      );
    });

    it('should scale up small source canvases', async () => {
      mockCanvas.width = 100;
      mockCanvas.height = 75;

      await captureThumbnail(mockCanvas);

      expect(mockOffscreenContext.drawImage).toHaveBeenCalledWith(
        mockCanvas,
        0,
        0,
        320, // scaled up width
        180 // scaled up height
      );
    });
  });
});
