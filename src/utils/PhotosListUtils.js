import { VIEW_MODES } from '../constants/viewModes.js';
import { PAGES } from '../constants/pages.js';

/**
 * Map viewMode to PAGES constant for localStorage operations
 * @param {string} mode - View mode constant
 * @returns {string|null} - Corresponding PAGES constant or null
 */
export function getPageIdFromViewMode(mode) {
    const mapping = {
        [VIEW_MODES.HOME]: PAGES.HOME,
        [VIEW_MODES.DATE]: PAGES.DATE,
        [VIEW_MODES.ALBUM_LIST]: PAGES.ALBUM_LIST,
        [VIEW_MODES.ALBUM]: PAGES.ALBUM,
        [VIEW_MODES.TAG_LIST]: PAGES.TAG_LIST,
        [VIEW_MODES.TAG]: PAGES.TAG,
        [VIEW_MODES.SEARCH]: PAGES.SEARCH,
        [VIEW_MODES.IMPORT]: PAGES.IMPORT,
        [VIEW_MODES.TRASH]: PAGES.TRASH
    };
    return mapping[mode] || null;
}

/**
 * Generate subId for current page context
 * Used for localStorage state persistence
 * @param {string} mode - View mode constant
 * @param {Object} context - Context object with currentDate, currentAlbumId, currentTagId
 * @returns {string|null} - Sub-identifier for the page or null
 */
export function getCurrentPageSubId(mode, context) {
    switch (mode) {
        case VIEW_MODES.DATE:
            return context.currentDate || null;
        case VIEW_MODES.ALBUM:
            return context.currentAlbumId || null;
        case VIEW_MODES.TAG:
            return context.currentTagId || null;
        default:
            return null;
    }
}
