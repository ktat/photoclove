import { logger } from '../../../../services/LoggerService.js';

/**
 * Default values for all editor controls
 */
export const DEFAULT_EDITOR_VALUES = {
    rotate: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    scale: 100,
    crop: { x: 0, y: 0, width: 100, height: 100 }
};

/**
 * Parse CSS string and extract editor values
 *
 * @param {string} cssString - CSS string to parse (e.g., "transform: rotate(90deg); filter: brightness(150%);")
 * @returns {Object} Editor values object with rotate, brightness, contrast, saturation, hue, scale, crop
 */
export function parseCssToEditorValues(cssString) {
    logger.debug('cssUtils', 'parse_css_start', 'Parsing CSS string', { cssString });

    if (!cssString || cssString.trim() === '') {
        logger.debug('cssUtils', 'parse_css_empty', 'CSS string is empty, returning defaults');
        return { ...DEFAULT_EDITOR_VALUES };
    }

    const values = { ...DEFAULT_EDITOR_VALUES };

    // Parse transform property
    const transformMatch = cssString.match(/transform:\s*([^;]+)/);
    if (transformMatch) {
        const transformValue = transformMatch[1];

        // Parse rotation: rotate(90deg) - preserve decimal precision
        const rotateMatch = transformValue.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
        if (rotateMatch) {
            values.rotate = parseFloat(rotateMatch[1]);
        }

        // Parse scale: scale(1.5) - preserve decimal precision
        const scaleMatch = transformValue.match(/scale\((\d+(?:\.\d+)?)\)/);
        if (scaleMatch) {
            values.scale = parseFloat(scaleMatch[1]) * 100;
        }
    }

    // Parse filter property
    const filterMatch = cssString.match(/filter:\s*([^;]+)/);
    if (filterMatch) {
        const filterValue = filterMatch[1];

        // Parse brightness: brightness(150%)
        const brightnessMatch = filterValue.match(/brightness\((\d+(?:\.\d+)?)%\)/);
        if (brightnessMatch) {
            values.brightness = parseInt(brightnessMatch[1]);
        }

        // Parse contrast: contrast(120%)
        const contrastMatch = filterValue.match(/contrast\((\d+(?:\.\d+)?)%\)/);
        if (contrastMatch) {
            values.contrast = parseInt(contrastMatch[1]);
        }

        // Parse saturation: saturate(80%)
        const saturationMatch = filterValue.match(/saturate\((\d+(?:\.\d+)?)%\)/);
        if (saturationMatch) {
            values.saturation = parseInt(saturationMatch[1]);
        }

        // Parse hue rotation: hue-rotate(45deg)
        const hueMatch = filterValue.match(/hue-rotate\((-?\d+(?:\.\d+)?)deg\)/);
        if (hueMatch) {
            values.hue = parseInt(hueMatch[1]);
        }
    }

    // Parse clip-path property for crop
    const clipPathMatch = cssString.match(/clip-path:\s*inset\((\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
    if (clipPathMatch) {
        const top = parseFloat(clipPathMatch[1]);
        const right = parseFloat(clipPathMatch[2]);
        const bottom = parseFloat(clipPathMatch[3]);
        const left = parseFloat(clipPathMatch[4]);

        values.crop = {
            x: left,
            y: top,
            width: 100 - left - right,
            height: 100 - top - bottom
        };
    }

    logger.debug('cssUtils', 'parse_css_complete', 'CSS parsing complete', { values });
    return values;
}

/**
 * Generate CSS string from editor values
 *
 * @param {Object} styles - Editor values object
 * @param {number} styles.rotate - Rotation in degrees (0-360)
 * @param {number} styles.brightness - Brightness percentage (0-200)
 * @param {number} styles.contrast - Contrast percentage (0-200)
 * @param {number} styles.saturation - Saturation percentage (0-200)
 * @param {number} styles.hue - Hue rotation in degrees (0-360)
 * @param {number} styles.scale - Scale percentage (1-200)
 * @param {Object} styles.crop - Crop coordinates and dimensions
 * @returns {string} CSS string (e.g., "transform: rotate(90deg); filter: brightness(150%);")
 */
export function generateCSSFromValues(styles) {
    const { rotate, brightness, contrast, saturation, hue, scale, crop } = styles;

    let transform = [];
    let filter = [];

    if (rotate !== 0) transform.push(`rotate(${rotate}deg)`);
    if (scale !== 100) transform.push(`scale(${scale / 100})`);

    if (brightness !== 100) filter.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filter.push(`contrast(${contrast}%)`);
    if (saturation !== 100) filter.push(`saturate(${saturation}%)`);
    if (hue !== 0) filter.push(`hue-rotate(${hue}deg)`);

    let css = '';
    if (transform.length > 0) {
        css += `transform: ${transform.join(' ')}; `;
    }
    if (filter.length > 0) {
        css += `filter: ${filter.join(' ')}; `;
    }

    // Add crop as clip-path if it's not the default (full image)
    if (crop && (crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100)) {
        const top = crop.y;
        const right = 100 - crop.x - crop.width;
        const bottom = 100 - crop.y - crop.height;
        const left = crop.x;
        css += `clip-path: inset(${top}% ${right}% ${bottom}% ${left}%); `;
    }

    return css.trim();
}

/**
 * Build transform CSS array from original and editor values
 *
 * @param {string} originalTransform - Original transform CSS value
 * @param {number} rotate - Rotation in degrees
 * @param {number} scale - Scale percentage
 * @returns {Array<string>} Array of transform CSS values
 */
export function buildTransformArray(originalTransform, rotate, scale) {
    const transforms = [];

    // Add original transform if it exists
    if (originalTransform && originalTransform !== 'none') {
        transforms.push(originalTransform);
    }

    // Add editor transforms
    if (rotate !== 0) transforms.push(`rotate(${rotate}deg)`);
    if (scale !== 100) transforms.push(`scale(${scale / 100})`);

    return transforms;
}

/**
 * Build filter CSS array from original and editor values
 *
 * @param {string} originalFilter - Original filter CSS value
 * @param {number} brightness - Brightness percentage
 * @param {number} contrast - Contrast percentage
 * @param {number} saturation - Saturation percentage
 * @param {number} hue - Hue rotation in degrees
 * @returns {Array<string>} Array of filter CSS values
 */
export function buildFilterArray(originalFilter, brightness, contrast, saturation, hue) {
    const filters = [];

    // Add original filter if it exists
    if (originalFilter && originalFilter !== 'none') {
        filters.push(originalFilter);
    }

    // Add editor filters
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);

    return filters;
}

/**
 * Build clip-path CSS from crop values
 *
 * @param {Object} crop - Crop coordinates and dimensions
 * @param {number} crop.x - X offset percentage
 * @param {number} crop.y - Y offset percentage
 * @param {number} crop.width - Width percentage
 * @param {number} crop.height - Height percentage
 * @returns {string} Clip-path CSS value or empty string if default crop
 */
export function buildClipPath(crop) {
    if (!crop || (crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100)) {
        return '';
    }

    const top = crop.y;
    const right = 100 - crop.x - crop.width;
    const bottom = 100 - crop.y - crop.height;
    const left = crop.x;

    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}
