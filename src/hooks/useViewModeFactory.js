/**
 * useViewModeFactory - Hook for creating ViewMode objects
 */
import { useMemo } from 'react';
import { ViewMode } from '../domain/ViewMode.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';

/**
 * Hook for creating and memoizing ViewMode objects
 *
 * @param {Object} options
 * @param {string} options.viewMode - Current view mode string
 * @param {string} options.currentAlbumId - Current album ID
 * @param {string} options.currentAlbumName - Current album name
 * @param {string} options.currentTagId - Current tag ID
 * @param {string} options.currentTagName - Current tag name
 * @param {string} options.currentBurstGroupId - Current burst group ID
 * @param {string} options.searchInitialQuery - Initial search query
 * @param {string} options.currentDate - Current date
 * @returns {Object} ViewMode object and mode flags
 */
export function useViewModeFactory({
    viewMode,
    currentAlbumId,
    currentAlbumName,
    currentTagId,
    currentTagName,
    currentBurstGroupId,
    searchInitialQuery,
    currentDate
}) {
    const viewModeObj = useMemo(() => {
        // Defensive programming: ensure viewMode is valid
        const safeViewMode = viewMode || VIEW_MODES.HOME;

        logger.debug('useViewModeFactory', 'creating', 'Creating ViewMode object', {
            viewMode: safeViewMode,
            albumId: currentAlbumId,
            tagId: currentTagId,
            burstGroupId: currentBurstGroupId,
            date: currentDate
        });

        try {
            return new ViewMode(safeViewMode, {
                albumId: currentAlbumId,
                albumName: currentAlbumName,
                tagId: currentTagId,
                tagName: currentTagName,
                burstGroupId: currentBurstGroupId,
                searchQuery: searchInitialQuery,
                date: currentDate
            });
        } catch (error) {
            logger.error('useViewModeFactory', 'creation_error', 'Failed to create ViewMode', {
                viewMode: safeViewMode,
                error: error.message
            });
            // Fallback to HOME mode
            return new ViewMode(VIEW_MODES.HOME, {});
        }
    }, [viewMode, currentAlbumId, currentAlbumName, currentTagId, currentTagName, currentBurstGroupId, searchInitialQuery, currentDate]);

    // Compute mode flags
    const modeFlags = useMemo(() => ({
        isSearchMode: viewModeObj.isSearchMode(),
        isAlbumMode: viewModeObj.isAlbumMode(),
        isAlbumListMode: viewModeObj.isAlbumListMode(),
        isTagMode: viewModeObj.isTagMode(),
        isTagListMode: viewModeObj.isTagListMode(),
        isTrashMode: viewModeObj.isTrashMode(),
        isImportMode: viewModeObj.isImportMode(),
        isDateMode: viewModeObj.isDateMode(),
        isRecentMode: viewModeObj.isRecentMode()
    }), [viewModeObj]);

    return {
        viewModeObj,
        ...modeFlags
    };
}

export default useViewModeFactory;
