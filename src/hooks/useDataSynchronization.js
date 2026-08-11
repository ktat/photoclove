import { useCallback, useEffect, useRef } from 'react';
import { logger } from '../services/LoggerService.js';
import { usePhoto } from '../context/PhotoContext.jsx';

/**
 * Custom hook for data synchronization operations
 *
 * Handles data reload and synchronization after operations:
 * - Reload current mode data (albums, tags, dates, etc.)
 * - Update UI after trash operations (restore/delete)
 * - Synchronize state after bulk operations
 *
 * @param {Object} params
 * @param {Object} params.modeLoaders - Object mapping view modes to loader functions
 * @param {string} params.viewMode - Current view mode
 * @param {Function} params.getDatesNum - Function to refresh date list
 * @param {Object} params.photoCollection - Current photo collection
 * @param {Function} params.setPhotoCollection - Setter for photo collection
 * @returns {Object} Data synchronization functions
 */
export function useDataSynchronization({
    modeLoaders,
    viewMode,
    getDatesNum,
    photoCollection,
    setPhotoCollection
}) {
    /**
     * Reload data for the current view mode
     * Calls the appropriate loader based on current mode and refreshes date list
     */
    const reloadCurrentModeData = useCallback(async () => {
        logger.info('useDataSynchronization', 'reload_mode_data', 'Reloading current mode data', {
            viewMode
        });

        const loader = modeLoaders[viewMode];
        if (loader) {
            await loader();
        }
        // Also refresh date list if needed
        if (getDatesNum) {
            await getDatesNum();
        }

        logger.debug('useDataSynchronization', 'reload_complete', 'Mode data reload complete', {
            viewMode
        });
    }, [modeLoaders, viewMode, getDatesNum]);

    /**
     * Reload when a background job changed the files behind the list.
     *
     * Moving photos to their EXIF date and building thumbnails both happen
     * outside this view, so nothing here would otherwise notice: the list
     * keeps showing photos under the date they just left, and new thumbnails
     * never appear until the view is navigated away from and back.
     *
     * The token's initial value is recorded rather than compared against zero,
     * so a list mounted after a job already ran does not reload redundantly.
     */
    const { photoRefreshToken } = usePhoto();
    const seenRefreshToken = useRef(photoRefreshToken);
    useEffect(() => {
        if (photoRefreshToken === seenRefreshToken.current) return;
        seenRefreshToken.current = photoRefreshToken;
        logger.info('useDataSynchronization', 'refresh_requested', 'Reloading: a background job changed the files');
        reloadCurrentModeData();
    }, [photoRefreshToken, reloadCurrentModeData]);

    /**
     * Update photos after trash operations (restore/permanently delete)
     * Efficiently removes affected photos from the trash collection view
     *
     * @param {Array<string>} affectedPaths - Array of photo paths affected by operation
     * @param {string} operation - Operation type: 'restore' or 'permanentDelete'
     */
    const updatePhotosAfterTrashOperation = useCallback(async (affectedPaths, operation) => {
        logger.info('useDataSynchronization', 'update_after_trash_op', 'Updating photos after trash operation', {
            operation,
            pathCount: affectedPaths.length
        });

        if (operation === 'restore' || operation === 'permanentDelete') {
            // Remove from trash collection using functional update for safety
            setPhotoCollection(prev => {
                if (!prev || !prev.photos) return prev;

                const updatedPhotos = prev.photos.filter(
                    p => !affectedPaths.includes(p.originalPath)
                );

                logger.debug('useDataSynchronization', 'trash_collection_updated', 'Removed photos from trash view', {
                    beforeCount: prev.photos.length,
                    afterCount: updatedPhotos.length
                });

                return { ...prev, photos: updatedPhotos };
            });
        }

        // Note: Date counts are now updated locally in DirectoryMenu via applyDateChanges()
        // No need to refetch from backend
        logger.debug('useDataSynchronization', 'trash_operation_complete', 'Trash operation UI update complete', {
            operation,
            pathCount: affectedPaths.length
        });
    }, [setPhotoCollection]);

    return {
        reloadCurrentModeData,
        updatePhotosAfterTrashOperation
    };
}
