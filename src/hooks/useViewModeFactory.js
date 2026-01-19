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
 * @param {string} options.burstReturnMode - Return mode for burst group navigation
 * @param {Object} options.burstReturnModeData - Return mode data for burst group navigation
 * @returns {Object} Object containing viewModeObj (use viewModeObj.isXxxMode() for mode checks)
 */
export function useViewModeFactory({
    viewMode,
    currentAlbumId,
    currentAlbumName,
    currentTagId,
    currentTagName,
    currentBurstGroupId,
    searchInitialQuery,
    currentDate,
    burstReturnMode,
    burstReturnModeData
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
            // Build data object - include return mode data for burst group mode
            const data = {
                albumId: currentAlbumId,
                albumName: currentAlbumName,
                tagId: currentTagId,
                tagName: currentTagName,
                burstGroupId: currentBurstGroupId,
                searchQuery: searchInitialQuery,
                date: currentDate
            };

            // Add burst group return mode data when in burst group mode
            if (safeViewMode === VIEW_MODES.IN_BURST_GROUP && burstReturnMode) {
                data.returnMode = burstReturnMode;
                data.returnModeData = burstReturnModeData;
            }

            return new ViewMode(safeViewMode, data);
        } catch (error) {
            logger.error('useViewModeFactory', 'creation_error', 'Failed to create ViewMode', {
                viewMode: safeViewMode,
                error: error.message
            });
            // Fallback to HOME mode
            return new ViewMode(VIEW_MODES.HOME, {});
        }
    }, [viewMode, currentAlbumId, currentAlbumName, currentTagId, currentTagName, currentBurstGroupId, searchInitialQuery, currentDate, burstReturnMode, burstReturnModeData]);

    return { viewModeObj };
}

export default useViewModeFactory;
