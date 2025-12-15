/**
 * Thumbnail capture utility for 3D scene screenshots.
 *
 * Captures the WebGL canvas and resizes it to a thumbnail-sized image
 * suitable for project cards in the home screen.
 */

/** Thumbnail dimensions - 16:9 aspect ratio matching card's aspect-video */
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

/** JPEG quality for compression (0-1) */
const JPEG_QUALITY = 0.7;

/**
 * Background gradient colors matching the editor's CSS gradient.
 * CSS: radial-gradient(circle at center, #f8fafc 0%, #cbd5e1 100%)
 */
const GRADIENT_CENTER_COLOR = '#f8fafc'; // slate-50
const GRADIENT_EDGE_COLOR = '#cbd5e1'; // slate-300

/**
 * Draws the editor background gradient onto a canvas context.
 * Matches the CSS: radial-gradient(circle at center, #f8fafc 0%, #cbd5e1 100%)
 */
function drawBackgroundGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  // Radius should reach the corners for full coverage
  const radius = Math.sqrt(centerX * centerX + centerY * centerY);

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, GRADIENT_CENTER_COLOR);
  gradient.addColorStop(1, GRADIENT_EDGE_COLOR);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Captures a WebGL canvas and returns a resized thumbnail as a base64 data URL.
 * Composites the 3D scene onto the editor's background gradient for visual consistency.
 *
 * @param canvas - The WebGL canvas element to capture
 * @returns Promise resolving to a base64 JPEG data URL, or null if capture fails
 */
export async function captureThumbnail(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    // Create an offscreen canvas for compositing
    const offscreen = document.createElement('canvas');
    offscreen.width = THUMBNAIL_WIDTH;
    offscreen.height = THUMBNAIL_HEIGHT;

    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context for thumbnail capture');
      return null;
    }

    // Step 1: Draw the background gradient (matches editor CSS)
    drawBackgroundGradient(ctx, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    // Step 2: Composite the 3D scene on top
    ctx.drawImage(canvas, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    // Export as JPEG with compression
    const dataUrl = offscreen.toDataURL('image/jpeg', JPEG_QUALITY);

    return dataUrl;
  } catch (error) {
    console.error('Failed to capture thumbnail:', error);
    return null;
  }
}
