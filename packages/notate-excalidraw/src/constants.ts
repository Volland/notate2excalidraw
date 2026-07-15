/**
 * Calibration constants for mapping notate strokes to Excalidraw freedraw,
 * derived from real device files (see samples/*.notate).
 */

/**
 * Excalidraw renders a freedraw element with perfect-freehand `size =
 * strokeWidth * 4.25`. notate stores the stroke's actual pixel width, so we
 * divide by this factor to get an Excalidraw `strokeWidth` that renders at the
 * same visual thickness (otherwise every stroke is ~4× too fat).
 */
export const FREEDRAW_SIZE_FACTOR = 4.25;

/**
 * notate/Onyx pen pressure is a raw device value in roughly [0, 4096].
 * Excalidraw expects per-point pressures in [0, 1].
 */
export const DEVICE_MAX_PRESSURE = 4096;
