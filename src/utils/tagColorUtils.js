/**
 * Tag Color Utilities
 * Hash-based color generation for tags
 * - Hue: determined by tag name hash (16 colors)
 * - Intensity: determined by photo count
 */

/**
 * Simple hash function to get consistent 0-15 value from tag name
 * @param {string} tagName - The tag name to hash
 * @returns {number} - Index 0-15
 */
export function getColorIndex(tagName) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        const char = tagName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 16;
}

// 16 hues spread across the color spectrum (0-360 degrees)
const COLOR_HUES = Array.from({ length: 16 }, (_, i) => (i * 360 / 16) % 360);

/**
 * Calculate tag color based on tag name (hue) and photo count (intensity)
 * @param {string} tagName - The tag name
 * @param {number} photoCount - Number of photos with this tag
 * @param {number} maxCount - Maximum photo count among all tags
 * @param {number} minCount - Minimum photo count among all tags
 * @returns {{ color: string, fontWeight: string }}
 */
export function calculateTagColor(tagName, photoCount, maxCount, minCount) {
    // Get hue from tag name hash
    const hue = COLOR_HUES[getColorIndex(tagName)];

    // Calculate intensity ratio based on photo count
    let ratio = 0;
    if (maxCount !== minCount) {
        ratio = (photoCount - minCount) / (maxCount - minCount);
    }

    // Check if we're in light theme
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';

    if (isLightTheme) {
        // Light theme: more photos = darker/more saturated
        const saturation = 60 + ratio * 20; // 60-80%
        const lightness = 55 - ratio * 25;  // 55-30%
        return {
            color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            fontWeight: ratio > 0.7 ? 'bold' : 'normal'
        };
    } else {
        // Dark theme: more photos = brighter/more saturated
        const saturation = 50 + ratio * 30; // 50-80%
        const lightness = 40 + ratio * 25;  // 40-65%
        return {
            color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            fontWeight: ratio > 0.7 ? 'bold' : 'normal'
        };
    }
}

/**
 * Get tag color for a single tag (convenience wrapper)
 * @param {string} tagName - The tag name
 * @param {number} photoCount - Number of photos with this tag
 * @param {Array} allItems - All tag items to calculate min/max
 * @returns {{ color: string, fontWeight: string }}
 */
export function getTagColor(tagName, photoCount, allItems = []) {
    const counts = allItems.map(t => t.photoCount || 0);
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts, 0);
    return calculateTagColor(tagName, photoCount, maxCount, minCount);
}
