import { logger } from "../../../services/LoggerService.js";

/**
 * Parse CSS style string and convert to React style object
 *
 * @param {string} cssString - CSS string (e.g., "transform: rotate(90deg); filter: brightness(150%);")
 * @returns {Object} React style object with camelCase properties
 */
export function parseCssStyle(cssString) {
    if (!cssString) return {};

    const styles = {};
    const declarations = cssString.split(';').filter(decl => decl.trim());

    declarations.forEach(declaration => {
        const [property, value] = declaration.split(':').map(s => s.trim());
        if (property && value) {
            // Convert CSS property names to camelCase for React
            const camelCaseProperty = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
            styles[camelCaseProperty] = value;
        }
    });

    return styles;
}

/**
 * Calculate simple thumbnail display configuration
 *
 * @param {Array} allPhotos - Array of all photos
 * @param {number} selectedIndex - Currently selected photo index
 * @returns {Object} Display configuration with startIndex, endIndex, borderPosition, showPrev, showNext
 */
export function calculateSimpleThumbnailDisplay(allPhotos, selectedIndex) {
    const NUM_OF_PHOTO_LIST = 9;
    const totalPhotos = allPhotos.length;
    const t = selectedIndex; // 0-indexed position

    // Handle edge case: no photos or invalid index
    if (totalPhotos === 0 || t < 0 || t >= totalPhotos) {
        logger.warn('photoUtils', 'thumbnail_calc_invalid', 'Invalid input for thumbnail calculation', {
            totalPhotos: totalPhotos,
            selectedIndex: t
        });
        return {
            startIndex: 0,
            endIndex: 0,
            borderPosition: 0,
            showPrev: false,
            showNext: false
        };
    }

    // Handle case where total photos <= 9
    if (totalPhotos <= NUM_OF_PHOTO_LIST) {
        return {
            startIndex: 0,
            endIndex: totalPhotos - 1,
            borderPosition: t,
            showPrev: false,
            showNext: false
        };
    }

    let result;

    if (t < 5) {
        // First 5 photos: show photos 1-9
        result = {
            startIndex: 0,
            endIndex: 8,
            borderPosition: t,
            showPrev: false,
            showNext: true
        };
    } else if (t > totalPhotos - 5) {
        // Last 5 photos: show last 9 photos
        result = {
            startIndex: totalPhotos - 9,
            endIndex: totalPhotos - 1,
            borderPosition: t - (totalPhotos - 9),
            showPrev: true,
            showNext: false
        };
    } else {
        // Middle: center selected photo at position 5 (index 4)
        result = {
            startIndex: t - 4,
            endIndex: t + 4,
            borderPosition: 4,
            showPrev: true,
            showNext: true
        };
    }

    return result;
}

/**
 * Get date key for pagination
 *
 * @param {boolean} recentPhotosMode - Recent photos mode flag
 * @param {boolean} isSearchMode - Search mode flag
 * @param {string} currentDate - Current date string
 * @returns {string} Date key for pagination
 */
export function getDateKey(recentPhotosMode, isSearchMode, currentDate) {
    return recentPhotosMode ? "recent" : (isSearchMode ? "search_results" : currentDate);
}

/**
 * Create border styles array for thumbnail strip
 *
 * @param {number} length - Number of thumbnails
 * @param {number} activeIndex - Index of active thumbnail
 * @returns {Array<string>} Array of CSS border style strings
 */
export function createBorderStyles(length, activeIndex) {
    const borderStyles = [];
    for (let i = 0; i < length; i++) {
        if (i === activeIndex) {
            borderStyles[i] = '3px solid #4a9eff';
        } else {
            borderStyles[i] = '1px solid #444';
        }
    }
    return borderStyles;
}
