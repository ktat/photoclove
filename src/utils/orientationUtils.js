/**
 * Orientation Utils
 * Utilities for handling EXIF orientation correction in thumbnail display
 */

import { parseCssToEditorValues } from '../App/PhotosList/PhotoOption/PhotoEditor/cssUtils.js';

/**
 * EXIF Orientation value to CSS transform mapping
 *
 * | Orientation | Description           | CSS Transform                    |
 * |-------------|-----------------------|----------------------------------|
 * | 1           | Normal                | none                             |
 * | 2           | Horizontal flip       | scaleX(-1)                       |
 * | 3           | 180° rotation         | rotate(180deg)                   |
 * | 4           | Vertical flip         | scaleY(-1)                       |
 * | 5           | 90° CW + H flip       | rotate(90deg) scaleX(-1)         |
 * | 6           | 90° CW rotation       | rotate(90deg)                    |
 * | 7           | 90° CCW + H flip      | rotate(-90deg) scaleX(-1)        |
 * | 8           | 90° CCW rotation      | rotate(-90deg)                   |
 */
const ORIENTATION_TRANSFORMS = {
    '1': { rotate: 0, scaleX: 1, scaleY: 1 },
    '2': { rotate: 0, scaleX: -1, scaleY: 1 },
    '3': { rotate: 180, scaleX: 1, scaleY: 1 },
    '4': { rotate: 0, scaleX: 1, scaleY: -1 },
    '5': { rotate: 90, scaleX: -1, scaleY: 1 },
    '6': { rotate: 90, scaleX: 1, scaleY: 1 },
    '7': { rotate: -90, scaleX: -1, scaleY: 1 },
    '8': { rotate: -90, scaleX: 1, scaleY: 1 },
    // Text-based orientation values (from EXIF)
    'Horizontal (normal)': { rotate: 0, scaleX: 1, scaleY: 1 },
    'Straight': { rotate: 0, scaleX: 1, scaleY: 1 }, // Alternative text for orientation 1
    'Mirror horizontal': { rotate: 0, scaleX: -1, scaleY: 1 },
    'Rotate 180': { rotate: 180, scaleX: 1, scaleY: 1 },
    'Upside-down': { rotate: 180, scaleX: 1, scaleY: 1 }, // Alternative text for orientation 3
    'Mirror vertical': { rotate: 0, scaleX: 1, scaleY: -1 },
    'Mirror horizontal and rotate 270 CW': { rotate: 90, scaleX: -1, scaleY: 1 },
    'Rotate 90 CW': { rotate: 90, scaleX: 1, scaleY: 1 },
    'Rotated 90 CW': { rotate: 90, scaleX: 1, scaleY: 1 }, // Alternative text for orientation 6
    // "Rotated to left" means camera was rotated left → need to rotate image RIGHT (CW) to fix
    'Rotated to left': { rotate: 90, scaleX: 1, scaleY: 1 }, // rexif text for orientation 6
    'Mirror horizontal and rotate 90 CW': { rotate: -90, scaleX: -1, scaleY: 1 },
    'Rotate 270 CW': { rotate: -90, scaleX: 1, scaleY: 1 },
    'Rotated 90 CCW': { rotate: -90, scaleX: 1, scaleY: 1 }, // Alternative text for orientation 8
    // "Rotated to right" means camera was rotated right → need to rotate image LEFT (CCW) to fix
    'Rotated to right': { rotate: -90, scaleX: 1, scaleY: 1 }, // rexif text for orientation 8
};

/**
 * Parse EXIF orientation value and return transform parameters
 * @param {string|number} orientation - EXIF orientation value (1-8 or text description)
 * @returns {{ rotate: number, scaleX: number, scaleY: number }} Transform parameters
 */
export function parseOrientationValue(orientation) {
    if (!orientation) {
        return { rotate: 0, scaleX: 1, scaleY: 1 };
    }

    const orientationStr = String(orientation).trim();

    // Check if it's a known orientation value
    if (ORIENTATION_TRANSFORMS[orientationStr]) {
        return ORIENTATION_TRANSFORMS[orientationStr];
    }

    // Try to extract numeric value from string like "6" or "Orientation: 6"
    const numMatch = orientationStr.match(/\b([1-8])\b/);
    if (numMatch) {
        return ORIENTATION_TRANSFORMS[numMatch[1]] || { rotate: 0, scaleX: 1, scaleY: 1 };
    }

    return { rotate: 0, scaleX: 1, scaleY: 1 };
}

/**
 * Combine orientation correction with PhotoEditor CSS styles
 * @param {string|number} orientation - EXIF orientation value
 * @param {string} cssStyle - PhotoEditor CSS style string
 * @returns {Object} Combined React style object with transform
 */
export function getCombinedTransformStyle(orientation, cssStyle) {
    const orientationTransform = parseOrientationValue(orientation);
    const editorValues = parseCssToEditorValues(cssStyle || '');

    // Combine rotations
    const totalRotation = (orientationTransform.rotate + editorValues.rotate) % 360;

    // Build transform array
    const transforms = [];

    if (totalRotation !== 0) {
        transforms.push(`rotate(${totalRotation}deg)`);
    }

    // Handle scale from editor
    if (editorValues.scale !== 100) {
        transforms.push(`scale(${editorValues.scale / 100})`);
    }

    // Handle flip from orientation (applied after rotation)
    if (orientationTransform.scaleX === -1) {
        transforms.push('scaleX(-1)');
    }
    if (orientationTransform.scaleY === -1) {
        transforms.push('scaleY(-1)');
    }

    // Build filter string for editor filters
    const filters = [];
    if (editorValues.brightness !== 100) {
        filters.push(`brightness(${editorValues.brightness}%)`);
    }
    if (editorValues.contrast !== 100) {
        filters.push(`contrast(${editorValues.contrast}%)`);
    }
    if (editorValues.saturation !== 100) {
        filters.push(`saturate(${editorValues.saturation}%)`);
    }
    if (editorValues.hue !== 0) {
        filters.push(`hue-rotate(${editorValues.hue}deg)`);
    }

    const style = {};

    if (transforms.length > 0) {
        style.transform = transforms.join(' ');
    }

    if (filters.length > 0) {
        style.filter = filters.join(' ');
    }

    // Handle crop from editor
    if (editorValues.crop &&
        (editorValues.crop.x !== 0 || editorValues.crop.y !== 0 ||
         editorValues.crop.width !== 100 || editorValues.crop.height !== 100)) {
        const top = editorValues.crop.y;
        const right = 100 - editorValues.crop.x - editorValues.crop.width;
        const bottom = 100 - editorValues.crop.y - editorValues.crop.height;
        const left = editorValues.crop.x;
        style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}%)`;
    }

    return style;
}

/**
 * Get simple orientation-only transform style (without editor CSS)
 * @param {string|number} orientation - EXIF orientation value
 * @returns {Object} React style object with transform
 */
export function getOrientationTransformStyle(orientation) {
    const transform = parseOrientationValue(orientation);

    if (transform.rotate === 0 && transform.scaleX === 1 && transform.scaleY === 1) {
        return {};
    }

    const transforms = [];

    if (transform.rotate !== 0) {
        transforms.push(`rotate(${transform.rotate}deg)`);
    }
    if (transform.scaleX === -1) {
        transforms.push('scaleX(-1)');
    }
    if (transform.scaleY === -1) {
        transforms.push('scaleY(-1)');
    }

    return transforms.length > 0 ? { transform: transforms.join(' ') } : {};
}
