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
 * Calculate the number of active filters
 * @param {Object} filterState - Filter state object
 * @returns {number} Number of active filters
 */
export function getActiveFilterCount(filterState) {
    const { starFilter, hasCommentFilter, hasTagFilter, extensionFilter } = filterState;
    return [
        starFilter > 0,
        hasCommentFilter,
        hasTagFilter,
        extensionFilter !== 'all'
    ].filter(Boolean).length;
}

/**
 * Get sort configuration mapping
 * @returns {Object} Sort configuration object
 */
export function getSortConfig() {
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

/**
 * Determine if infinite scroll should show "load more" indicator
 * @param {boolean} infiniteScrollEnabled - Whether infinite scroll is enabled
 * @param {number} displayedCount - Number of photos currently displayed
 * @param {number} totalCount - Total number of photos available
 * @returns {boolean} Whether to show load more indicator
 */
export function shouldShowLoadMore(infiniteScrollEnabled, displayedCount, totalCount) {
    return infiniteScrollEnabled && displayedCount < totalCount;
}

/**
 * Generate photo count display text
 * @param {number} totalCount - Total number of photos
 * @param {number} displayedCount - Number of photos displayed
 * @param {boolean} infiniteScrollEnabled - Whether infinite scroll is enabled
 * @returns {string} Photo count display text
 */
export function getPhotoCountText(totalCount, displayedCount, infiniteScrollEnabled) {
    if (!infiniteScrollEnabled || displayedCount >= totalCount) {
        return `${totalCount} photos`;
    }
    return `${totalCount} photos (showing ${displayedCount})`;
}

/**
 * Determine if a mode shows photo operations
 * @param {string} viewMode - Current view mode
 * @returns {boolean} Whether mode shows photo operations
 */
export function showsPhotoOperations(viewMode) {
    const MODES_WITH_OPERATIONS = [
        'date', 'recent', 'album', 'tag', 'search', 'advanced_search', 'trash'
    ];
    return MODES_WITH_OPERATIONS.includes(viewMode);
}

/**
 * Get back navigation text for current mode
 * @param {string} viewMode - Current view mode
 * @returns {string} Navigation text
 */
export function getBackNavigationText(viewMode) {
    switch (viewMode) {
        case 'album': return 'Back to Album List';
        case 'tag': return 'Back to Tag List';
        case 'search':
        case 'advanced_search':
        case 'trash':
        default:
            return 'Back to HOME';
    }
}

/**
 * Determine if mode should show create button
 * @param {string} viewMode - Current view mode
 * @returns {boolean} Whether to show create button
 */
export function shouldShowCreateButton(viewMode) {
    return viewMode === 'album_list' || viewMode === 'tag_list';
}

/**
 * Get empty state message for current mode
 * @param {string} viewMode - Current view mode
 * @param {Object} context - Additional context (albumName, tagName, etc.)
 * @returns {string} Empty state message
 */
export function getEmptyStateMessage(viewMode, context = {}) {
    switch (viewMode) {
        case 'search':
        case 'advanced_search':
            return 'No Search Result';
        case 'album':
            return `No photos in album: ${context.albumName || 'Unknown Album'}`;
        case 'tag':
            return `No photos with tag: ${context.tagName || 'Unknown Tag'}`;
        case 'trash':
            return 'Trash is empty';
        default:
            return 'No Photo Found!';
    }
}

/**
 * Check if current mode is in search state
 * @param {string} viewMode - Current view mode
 * @returns {boolean} Whether mode is search-related
 */
export function isSearchMode(viewMode) {
    return viewMode === 'search' || viewMode === 'advanced_search';
}

/**
 * Check if current mode should show side menu
 * @param {string} viewMode - Current view mode
 * @param {boolean} searchActive - Whether search is active
 * @returns {boolean} Whether to show side menu
 */
export function shouldShowSideMenu(viewMode, searchActive) {
    return searchActive || viewMode === 'import';
}