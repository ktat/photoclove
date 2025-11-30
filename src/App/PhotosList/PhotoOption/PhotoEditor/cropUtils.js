import { logger } from '../../../../services/LoggerService.js';

/**
 * Crop presets with aspect ratios
 */
export const CROP_PRESETS = [
    { name: 'Original', ratio: null },
    { name: 'Square', ratio: 1 },
    { name: 'Portrait 4:3', ratio: 4 / 3 },
    { name: 'Landscape 3:4', ratio: 3 / 4 },
    { name: 'Portrait 3:2', ratio: 3 / 2 },
    { name: 'Landscape 2:3', ratio: 2 / 3 },
    { name: 'Wide 16:9', ratio: 16 / 9 },
    { name: 'Tall 9:16', ratio: 9 / 16 }
];

/**
 * Calculate crop selection based on preset aspect ratio
 *
 * @param {Object} preset - Crop preset object with name and ratio
 * @param {string} preset.name - Preset name (e.g., "Square", "Portrait 4:3")
 * @param {number|null} preset.ratio - Aspect ratio (width/height) or null for original
 * @returns {Object} Crop selection with x, y, width, height (in percentage)
 */
export function calculateCropFromPreset(preset) {
    if (!preset.ratio) {
        // Original size - full image
        return { x: 0, y: 0, width: 100, height: 100 };
    }

    // Calculate crop area to maintain aspect ratio
    const ratio = preset.ratio;
    let x = 0, y = 0, width = 100, height = 100;

    if (ratio > 1) {
        // Landscape orientation (wider than tall)
        // Limit by width
        height = 100 / ratio;
        y = (100 - height) / 2;
    } else {
        // Portrait orientation (taller than wide)
        // Limit by width
        width = 100 * ratio;
        x = (100 - width) / 2;
    }

    logger.debug('cropUtils', 'calculate_preset_crop', 'Calculated crop from preset', {
        preset: preset.name,
        ratio,
        crop: { x, y, width, height }
    });

    return { x, y, width, height };
}

/**
 * Calculate crop position from mouse event relative to image bounds
 *
 * @param {MouseEvent} e - Mouse event
 * @param {DOMRect} imageBounds - Image element bounds (from getBoundingClientRect)
 * @returns {Object} Crop position with x, y (in percentage)
 */
export function calculateCropPosition(e, imageBounds) {
    const relativeX = e.clientX - imageBounds.left;
    const relativeY = e.clientY - imageBounds.top;

    const x = (relativeX / imageBounds.width) * 100;
    const y = (relativeY / imageBounds.height) * 100;

    logger.debug('cropUtils', 'calculate_position', 'Calculated crop position', {
        clientX: e.clientX,
        clientY: e.clientY,
        boundsLeft: imageBounds.left,
        boundsTop: imageBounds.top,
        boundsWidth: imageBounds.width,
        boundsHeight: imageBounds.height,
        x,
        y
    });

    return { x, y };
}

/**
 * Calculate crop selection during drag operation
 *
 * @param {Object} currentPosition - Current mouse position (x, y in percentage)
 * @param {Object} dragStart - Drag start position (x, y in percentage)
 * @returns {Object} Crop selection with x, y, width, height (in percentage, clamped to 0-100)
 */
export function calculateCropDrag(currentPosition, dragStart) {
    const width = Math.abs(currentPosition.x - dragStart.x);
    const height = Math.abs(currentPosition.y - dragStart.y);
    const startX = Math.min(currentPosition.x, dragStart.x);
    const startY = Math.min(currentPosition.y, dragStart.y);

    return {
        x: Math.max(0, Math.min(startX, 100)),
        y: Math.max(0, Math.min(startY, 100)),
        width: Math.max(0, Math.min(width, 100 - Math.max(0, startX))),
        height: Math.max(0, Math.min(height, 100 - Math.max(0, startY)))
    };
}

/**
 * Check if crop selection is valid (has area)
 *
 * @param {Object} crop - Crop selection
 * @param {number} crop.width - Width percentage
 * @param {number} crop.height - Height percentage
 * @returns {boolean} True if crop has area (width > 0 and height > 0)
 */
export function isCropValid(crop) {
    return crop.width > 0 && crop.height > 0;
}

/**
 * Check if crop is at default (full image)
 *
 * @param {Object} crop - Crop selection
 * @param {number} crop.x - X offset percentage
 * @param {number} crop.y - Y offset percentage
 * @param {number} crop.width - Width percentage
 * @param {number} crop.height - Height percentage
 * @returns {boolean} True if crop covers full image
 */
export function isCropDefault(crop) {
    return crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
}

/**
 * Clamp crop values to valid range (0-100)
 *
 * @param {Object} crop - Crop selection
 * @returns {Object} Clamped crop selection
 */
export function clampCrop(crop) {
    return {
        x: Math.max(0, Math.min(crop.x, 100)),
        y: Math.max(0, Math.min(crop.y, 100)),
        width: Math.max(0, Math.min(crop.width, 100)),
        height: Math.max(0, Math.min(crop.height, 100))
    };
}
