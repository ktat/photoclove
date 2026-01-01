/**
 * Pages Constants
 *
 * Defines page identifiers and configuration for state persistence
 * Used by usePageState hook for localStorage key management
 */

/**
 * Page state schema version
 * Increment when making breaking changes to state structure
 * Old versions will be invalidated and reinitialized
 */
export const PAGE_STATE_VERSION = 1;

/**
 * Time-to-live for stored page states (in milliseconds)
 * States older than this will be invalidated
 * Default: 7 days
 */
export const PAGE_STATE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Page identifiers for state storage
 * Maps to viewMode values for consistent key generation
 */
export const PAGES = {
    HOME: 'home',
    DATE: 'date',
    RECENT: 'recent',
    ALBUM_LIST: 'album_list',
    ALBUM: 'album',
    TAG_LIST: 'tag_list',
    TAG: 'tag',
    SEARCH: 'search',
    IMPORT: 'import',
    TRASH: 'trash'
};

/**
 * Storage key prefix for page states
 */
export const STORAGE_PREFIX = 'photoclove_page_';

/**
 * Get storage key for a specific page
 * @param {string} pageId - Page identifier from PAGES
 * @param {string} [subId] - Optional sub-identifier (e.g., albumId, date)
 * @returns {string} Storage key
 */
export function getStorageKey(pageId, subId = null) {
    const baseKey = `${STORAGE_PREFIX}${pageId}`;
    return subId ? `${baseKey}_${subId}` : baseKey;
}

/**
 * Pages that should have persistent state
 * Other pages will use session-only state
 */
export const PERSISTENT_PAGES = [
    PAGES.DATE,
    PAGES.RECENT,
    PAGES.ALBUM_LIST,
    PAGES.ALBUM,
    PAGES.TAG_LIST,
    PAGES.TAG,
    PAGES.IMPORT
];

/**
 * Check if a page should persist state
 * @param {string} pageId - Page identifier
 * @returns {boolean}
 */
export function shouldPersistPage(pageId) {
    return PERSISTENT_PAGES.includes(pageId);
}
