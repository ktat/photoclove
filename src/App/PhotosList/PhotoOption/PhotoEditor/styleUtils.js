import { logger } from '../../../../services/LoggerService.js';
import { buildTransformArray, buildFilterArray, buildClipPath } from './cssUtils.js';

/**
 * Store original styles for an image element
 *
 * @param {HTMLElement} element - Image element
 * @returns {Object} Original style properties
 */
export function storeOriginalStyles(element) {
    return {
        transform: element.style.transform || '',
        filter: element.style.filter || '',
        clipPath: element.style.clipPath || '',
        cssText: element.style.cssText || ''
    };
}

/**
 * Apply editor styles to an image element
 *
 * @param {HTMLElement} element - Image element to apply styles to
 * @param {Object} editorStyles - Editor style values
 * @param {number} editorStyles.rotate - Rotation in degrees
 * @param {number} editorStyles.brightness - Brightness percentage
 * @param {number} editorStyles.contrast - Contrast percentage
 * @param {number} editorStyles.saturation - Saturation percentage
 * @param {number} editorStyles.hue - Hue rotation in degrees
 * @param {number} editorStyles.scale - Scale percentage
 * @param {Object} editorStyles.crop - Crop selection
 * @param {Object} originalStyle - Original style properties to preserve
 * @param {string} originalStyle.transform - Original transform value
 * @param {string} originalStyle.filter - Original filter value
 */
export function applyStylesToElement(element, editorStyles, originalStyle = {}) {
    const { rotate, brightness, contrast, saturation, hue, scale, crop } = editorStyles;

    // Build transform array (original + editor)
    const transforms = buildTransformArray(originalStyle.transform, rotate, scale);

    // Build filter array (original + editor)
    const filters = buildFilterArray(originalStyle.filter, brightness, contrast, saturation, hue);

    // Apply styles
    element.style.transform = transforms.length > 0 ? transforms.join(' ') : '';
    element.style.filter = filters.length > 0 ? filters.join(' ') : '';

    // Apply crop as clip-path
    const clipPath = buildClipPath(crop);
    element.style.clipPath = clipPath;
}

/**
 * Apply temporary styles to main image and thumbnails
 *
 * @param {Object} editorStyles - Editor style values
 * @param {Map} originalStylesMap - Map of original styles by element key
 * @param {function} setOriginalStyles - State setter for originalStylesMap
 * @param {string} currentPhotoPath - Current photo path for matching thumbnails
 */
export function applyTempStyles(editorStyles, originalStylesMap, setOriginalStyles, currentPhotoPath) {
    logger.debug('styleUtils', 'apply_temp_styles', 'Applying temporary styles', { editorStyles });

    // Apply to main image
    const mainImage = document.querySelector('#photoImgTag');
    if (mainImage) {
        // Store original styles if not already stored
        if (!originalStylesMap.has('main-image')) {
            const originalStyle = storeOriginalStyles(mainImage);
            setOriginalStyles(prev => new Map(prev.set('main-image', originalStyle)));
            originalStylesMap.set('main-image', originalStyle);
        }

        const original = originalStylesMap.get('main-image') || {};
        applyStylesToElement(mainImage, editorStyles, original);
    }

    // Apply to thumbnails
    applyToThumbnailSet(
        '.photos .row img',
        'grid-thumb',
        editorStyles,
        originalStylesMap,
        setOriginalStyles,
        currentPhotoPath
    );

    applyToThumbnailSet(
        '#photos-list-mini img',
        'mini-thumb',
        editorStyles,
        originalStylesMap,
        setOriginalStyles,
        currentPhotoPath
    );
}

/**
 * Apply styles to a set of thumbnail images
 *
 * @param {string} selector - CSS selector for thumbnails
 * @param {string} keyPrefix - Prefix for storing original styles
 * @param {Object} editorStyles - Editor style values
 * @param {Map} originalStylesMap - Map of original styles by element key
 * @param {function} setOriginalStyles - State setter for originalStylesMap
 * @param {string} currentPhotoPath - Current photo path for matching thumbnails
 */
function applyToThumbnailSet(
    selector,
    keyPrefix,
    editorStyles,
    originalStylesMap,
    setOriginalStyles,
    currentPhotoPath
) {
    const thumbnails = document.querySelectorAll(selector);
    const photoFilename = currentPhotoPath ? currentPhotoPath.split('/').pop() : null;

    thumbnails.forEach((img, index) => {
        // Only apply to thumbnails matching current photo
        if (!img.src || !photoFilename || !img.src.includes(photoFilename)) {
            return;
        }

        const key = `${keyPrefix}-${index}`;

        // Store original styles if not already stored
        if (!originalStylesMap.has(key)) {
            const originalStyle = storeOriginalStyles(img);
            setOriginalStyles(prev => new Map(prev.set(key, originalStyle)));
            originalStylesMap.set(key, originalStyle);
        }

        const original = originalStylesMap.get(key) || {};
        applyStylesToElement(img, editorStyles, original);
    });
}

/**
 * Reset styles on an image element to original
 *
 * @param {HTMLElement} element - Image element
 * @param {Object} originalStyle - Original style properties
 */
export function resetElementStyles(element, originalStyle) {
    if (!originalStyle) return;

    element.style.transform = originalStyle.transform || '';
    element.style.filter = originalStyle.filter || '';
    element.style.clipPath = originalStyle.clipPath || '';
}

/**
 * Clear all temporary styles and restore originals
 *
 * @param {Map} originalStylesMap - Map of original styles by element key
 */
export function clearAllTempStyles(originalStylesMap) {
    logger.debug('styleUtils', 'clear_temp_styles', 'Clearing all temporary styles');

    // Reset main image
    const mainImage = document.querySelector('#photoImgTag');
    if (mainImage && originalStylesMap.has('main-image')) {
        resetElementStyles(mainImage, originalStylesMap.get('main-image'));
    }

    // Reset thumbnails
    const allImages = document.querySelectorAll('.photos .row img, #photos-list-mini img');
    allImages.forEach((img, index) => {
        ['grid-thumb', 'mini-thumb'].forEach(prefix => {
            const key = `${prefix}-${index}`;
            if (originalStylesMap.has(key)) {
                resetElementStyles(img, originalStylesMap.get(key));
            }
        });
    });
}

/**
 * Rotate value by degrees and normalize to 0-360 range
 *
 * @param {number} currentValue - Current rotation value
 * @param {number} deltaRotation - Degrees to rotate by (positive or negative)
 * @returns {number} New rotation value (0-360)
 */
export function rotateValue(currentValue, deltaRotation) {
    const newRotation = (currentValue + deltaRotation) % 360;
    return newRotation < 0 ? newRotation + 360 : newRotation;
}

/**
 * Normalize rotation/hue value (360 = 0)
 *
 * @param {number} value - Value to normalize
 * @returns {number} Normalized value (360 becomes 0)
 */
export function normalizeRotationValue(value) {
    return parseInt(value) === 360 ? 0 : value;
}
