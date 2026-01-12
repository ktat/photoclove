/**
 * UI State Utilities
 * Extracted from PhotosList.jsx to reduce component complexity and improve reusability
 * Contains helper functions for UI state derivation and display logic
 */

/**
 * Check if any filters are currently active
 * @param {Object} filterState - Filter state object
 * @returns {boolean} Whether any filters are active
 */
export function hasActiveFilters(filterState) {
    const { starFilter, hasCommentFilter, hasTagFilter, extensionFilter } = filterState;
    return starFilter > 0 || hasCommentFilter || hasTagFilter || extensionFilter !== 'all';
}

/**
 * Generate a summary string of active filters
 * @param {Object} filterState - Filter state object
 * @returns {string} Filter summary text
 */
export function getFilterSummary(filterState) {
    const { starFilter, hasCommentFilter, hasTagFilter, extensionFilter } = filterState;
    const active = [];

    if (starFilter > 0) active.push(`★${starFilter}+`);
    if (hasCommentFilter) active.push('Has comment');
    if (hasTagFilter) active.push('Has tag');
    if (extensionFilter !== 'all') active.push(`${extensionFilter}`);

    return active.length > 0 ? `Active filters: ${active.join(', ')}` : '';
}

/**
 * Get sort configuration mapping
 * @returns {Object} Sort configuration object
 */
function getSortConfig() {
    return {
        0: { field: 'exif_date_time_original', order: 'desc' },  // Shot Time (desc)
        1: { field: 'exif_date_time_original', order: 'asc' },   // Shot Time (asc)
        2: { field: 'photo_date', order: 'desc' },               // Added Time (desc)
        3: { field: 'photo_date', order: 'asc' },                // Added Time (asc)
        4: { field: 'star', order: 'desc' },                     // Star Rating (desc)
        5: { field: 'star', order: 'asc' },                      // Star Rating (asc)
        6: { field: 'path', order: 'desc' },                     // File Name (desc)
        7: { field: 'path', order: 'asc' }                       // File Name (asc)
    };
}

/**
 * Get current sort configuration
 * @param {number} sortOfPhotos - Current sort value
 * @returns {Object} Current sort configuration
 */
export function getCurrentSortConfig(sortOfPhotos) {
    const sortConfig = getSortConfig();
    return sortConfig[sortOfPhotos] || sortConfig[0];
}
