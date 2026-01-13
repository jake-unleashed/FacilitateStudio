/**
 * TransformGizmo Constants
 *
 * Configuration values for the TransformGizmo component.
 */

/**
 * Target screen-space pixel gap between object bounding box edge and handles.
 * This ensures consistent visual spacing regardless of camera zoom level.
 * ~30-40px provides comfortable separation from the object.
 */
export const HANDLE_GAP_PIXELS = 35;

/**
 * Target screen-space pixel distance between height and XZ handles.
 * This ensures consistent visual spacing regardless of camera zoom level.
 * ~60-70px provides comfortable separation at typical viewing distances.
 */
export const HANDLE_SPACING_PIXELS = 65;

/** Delay before showing hover tooltip (ms) */
export const TOOLTIP_HOVER_DELAY = 400;

/** Duration to show click tooltip (ms) */
export const TOOLTIP_CLICK_DURATION = 2000;

/** Minimum drag threshold in pixels to register movement */
export const DRAG_THRESHOLD_PX = 3;

/** Minimum XZ world movement to register as drag */
export const XZ_DRAG_THRESHOLD = 0.001;

/**
 * Lerp factor for smooth handle positioning (0-1).
 * Lower = smoother/slower, Higher = snappier/faster.
 * 0.08 provides a premium, smooth feel without feeling laggy.
 */
export const POSITION_LERP_FACTOR = 0.08;

/**
 * Lerp factor for smoothing source data (object center, offset distance).
 * This eliminates jitter from bounding box fluctuations on complex models.
 * Higher than position lerp to stay responsive while smoothing input noise.
 */
export const SOURCE_SMOOTHING_FACTOR = 0.15;

/**
 * Height value constraints (in internal units, where 100 = 1 world unit/meter).
 *
 * HEIGHT_MIN: Minimum Y value for ROOT objects only. Child objects can have
 * negative localTransform.y values to move below their default position within
 * the model (while still respecting ground constraint).
 *
 * HEIGHT_MAX: Maximum Y value (500 internal units = 5 meters above ground).
 */
export const HEIGHT_MIN = 0;
export const HEIGHT_MAX = 500;

/**
 * Pitch angle thresholds for view mode detection (in degrees).
 * - Side view: pitch < SIDE_VIEW_THRESHOLD (looking horizontally)
 * - Top-down view: pitch > TOPDOWN_VIEW_THRESHOLD (looking straight down/up)
 * - Isometric: everything in between
 *
 * SIDE_VIEW_THRESHOLD is narrow (~12) so the side-to-side handle only appears
 * when viewing approximately horizontally (e.g. from the side of an object).
 */
export const SIDE_VIEW_THRESHOLD = 12;
export const TOPDOWN_VIEW_THRESHOLD = 55;

/**
 * Hysteresis values to prevent mode flickering at boundaries.
 * Enter a mode at the threshold, but don't exit until past threshold + hysteresis.
 */
export const VIEW_MODE_HYSTERESIS = 2;
