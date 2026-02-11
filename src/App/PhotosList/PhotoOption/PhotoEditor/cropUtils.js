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

/**
 * Determine the interaction zone based on mouse position relative to crop selection
 *
 * @param {{x: number, y: number}} mousePos - Mouse position in percentage
 * @param {{x: number, y: number, width: number, height: number}} cropSelection - Current crop selection
 * @param {number} threshold - Hit-test threshold in percentage units (e.g., 3)
 * @returns {string} Interaction zone: 'corner-tl', 'corner-tr', 'corner-bl', 'corner-br',
 *   'edge-top', 'edge-bottom', 'edge-left', 'edge-right', 'move', or 'create'
 */
export function getInteractionZone(mousePos, cropSelection, threshold = 3) {
    const { x, y, width, height } = cropSelection;
    if (width <= 0 || height <= 0) return 'create';

    const right = x + width;
    const bottom = y + height;
    const mx = mousePos.x;
    const my = mousePos.y;

    const nearLeft = Math.abs(mx - x) <= threshold;
    const nearRight = Math.abs(mx - right) <= threshold;
    const nearTop = Math.abs(my - y) <= threshold;
    const nearBottom = Math.abs(my - bottom) <= threshold;

    // Corner detection (priority over edges)
    if (nearLeft && nearTop) return 'corner-tl';
    if (nearRight && nearTop) return 'corner-tr';
    if (nearLeft && nearBottom) return 'corner-bl';
    if (nearRight && nearBottom) return 'corner-br';

    // Edge detection (mouse must be within the selection's range on the other axis)
    const withinX = mx >= x - threshold && mx <= right + threshold;
    const withinY = my >= y - threshold && my <= bottom + threshold;

    if (nearTop && withinX) return 'edge-top';
    if (nearBottom && withinX) return 'edge-bottom';
    if (nearLeft && withinY) return 'edge-left';
    if (nearRight && withinY) return 'edge-right';

    // Inside detection
    if (mx >= x && mx <= right && my >= y && my <= bottom) return 'move';

    return 'create';
}

/**
 * Move crop selection by delta, clamped to 0-100 bounds
 *
 * @param {{x: number, y: number, width: number, height: number}} cropSelection - Current crop selection
 * @param {{x: number, y: number}} delta - Movement delta in percentage
 * @returns {{x: number, y: number, width: number, height: number}} New crop selection
 */
export function calculateCropMove(cropSelection, delta) {
    let newX = cropSelection.x + delta.x;
    let newY = cropSelection.y + delta.y;

    // Clamp to bounds
    newX = Math.max(0, Math.min(newX, 100 - cropSelection.width));
    newY = Math.max(0, Math.min(newY, 100 - cropSelection.height));

    return {
        x: newX,
        y: newY,
        width: cropSelection.width,
        height: cropSelection.height
    };
}

const MIN_SIZE = 5;

/**
 * Resize crop selection from a corner, optionally maintaining aspect ratio
 *
 * @param {{x: number, y: number, width: number, height: number}} cropSelection - Current crop selection
 * @param {string} corner - Which corner is being dragged: 'corner-tl', 'corner-tr', 'corner-bl', 'corner-br'
 * @param {{x: number, y: number}} mousePos - Current mouse position in percentage
 * @param {number|null} lockedRatio - Aspect ratio (width/height) to maintain, or null for free resize
 * @returns {{x: number, y: number, width: number, height: number}} New crop selection
 */
export function calculateCropCornerResize(cropSelection, corner, mousePos, lockedRatio) {
    const { x, y, width, height } = cropSelection;
    const right = x + width;
    const bottom = y + height;

    let fixedX, fixedY, newX, newY;

    // The fixed point is the opposite corner
    switch (corner) {
        case 'corner-tl': fixedX = right; fixedY = bottom; newX = mousePos.x; newY = mousePos.y; break;
        case 'corner-tr': fixedX = x; fixedY = bottom; newX = mousePos.x; newY = mousePos.y; break;
        case 'corner-bl': fixedX = right; fixedY = y; newX = mousePos.x; newY = mousePos.y; break;
        case 'corner-br': fixedX = x; fixedY = y; newX = mousePos.x; newY = mousePos.y; break;
        default: return cropSelection;
    }

    // Clamp mouse position to image bounds
    newX = Math.max(0, Math.min(newX, 100));
    newY = Math.max(0, Math.min(newY, 100));

    let newWidth = Math.abs(newX - fixedX);
    let newHeight = Math.abs(newY - fixedY);

    if (lockedRatio != null) {
        // Maintain aspect ratio: adjust height based on width
        const ratioHeight = newWidth / lockedRatio;
        if (ratioHeight <= 100) {
            newHeight = ratioHeight;
        } else {
            newHeight = 100;
            newWidth = newHeight * lockedRatio;
        }
    }

    // Enforce minimum size
    newWidth = Math.max(MIN_SIZE, newWidth);
    newHeight = Math.max(MIN_SIZE, newHeight);

    // Calculate top-left based on drag direction relative to fixed point
    let resultX = newX < fixedX ? fixedX - newWidth : fixedX;
    let resultY = newY < fixedY ? fixedY - newHeight : fixedY;

    // Clamp to bounds
    if (resultX < 0) { resultX = 0; newWidth = fixedX; }
    if (resultY < 0) { resultY = 0; newHeight = fixedY; }
    if (resultX + newWidth > 100) { newWidth = 100 - resultX; }
    if (resultY + newHeight > 100) { newHeight = 100 - resultY; }

    return { x: resultX, y: resultY, width: newWidth, height: newHeight };
}

/**
 * Resize crop selection from an edge (one direction only)
 *
 * @param {{x: number, y: number, width: number, height: number}} cropSelection - Current crop selection
 * @param {string} edge - Which edge is being dragged: 'edge-top', 'edge-bottom', 'edge-left', 'edge-right'
 * @param {{x: number, y: number}} mousePos - Current mouse position in percentage
 * @returns {{x: number, y: number, width: number, height: number}} New crop selection
 */
export function calculateCropEdgeResize(cropSelection, edge, mousePos) {
    const { x, y, width, height } = cropSelection;
    let newX = x, newY = y, newWidth = width, newHeight = height;

    switch (edge) {
        case 'edge-top': {
            const clampedY = Math.max(0, Math.min(mousePos.y, y + height - MIN_SIZE));
            newY = clampedY;
            newHeight = (y + height) - clampedY;
            break;
        }
        case 'edge-bottom': {
            const clampedBottom = Math.max(y + MIN_SIZE, Math.min(mousePos.y, 100));
            newHeight = clampedBottom - y;
            break;
        }
        case 'edge-left': {
            const clampedX = Math.max(0, Math.min(mousePos.x, x + width - MIN_SIZE));
            newX = clampedX;
            newWidth = (x + width) - clampedX;
            break;
        }
        case 'edge-right': {
            const clampedRight = Math.max(x + MIN_SIZE, Math.min(mousePos.x, 100));
            newWidth = clampedRight - x;
            break;
        }
        default:
            return cropSelection;
    }

    return { x: newX, y: newY, width: newWidth, height: newHeight };
}
