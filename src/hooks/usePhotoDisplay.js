import { useCallback } from 'react';
import { logger } from '../services/LoggerService.js';
import { checkFirstActionAchievement } from '../services/AchievementService.js';

/**
 * Custom hook for photo display management
 *
 * Handles photo display operations including:
 * - Opening photos in full-screen view
 * - Closing photo display
 * - Managing right column visibility
 *
 * @param {Object} params
 * @param {Array} params.photosListMiniAllPhotos - All photos for mini display
 * @param {Object} params.viewModeObj - ViewMode object for mode detection
 * @param {Function} params.setCurrentPhotoPath - Setter for current photo path
 * @param {Function} params.setCurrentPhotoIndex - Setter for current photo index
 * @param {Function} params.setPhotosListMiniCurrentIndex - Setter for mini list index
 * @param {Function} params.setPhotosListMiniReread - Setter to trigger thumbnail re-read
 * @param {Function} params.setShowSideMenu - Setter for side menu visibility
 * @param {Object} params.currentPhotoLoadingController - AbortController for photo loading
 * @param {Function} params.setCurrentPhotoLoadingController - Setter for loading controller
 * @param {Function} params.handleError - Error handler function
 * @param {Function} params.refreshPhotos - Function to refresh photos from backend
 * @param {boolean} params.photosListMiniReread - Current reread state
 * @returns {Object} Photo display management functions
 */
export function usePhotoDisplay({
    photosListMiniAllPhotos,
    viewModeObj,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    setPhotosListMiniCurrentIndex,
    setPhotosListMiniReread,
    setShowSideMenu,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    handleError,
    refreshPhotos,
    photosListMiniReread
}) {
    /**
     * Display a photo in full-screen view
     *
     * @param {string} f - Photo file path
     * @param {number} i - Photo index in current list
     */
    const displayPhoto = useCallback((f, i) => {
        logger.info('usePhotoDisplay', 'display_photo', 'Displaying photo in full-screen view', {
            path: f,
            index: i,
            viewMode: viewModeObj?.currentMode
        });

        const photoToFind = photosListMiniAllPhotos[i];
        const displayPath = photoToFind ? (photoToFind.file?.path || photoToFind.path || f) : f;

        setCurrentPhotoPath(displayPath);
        setCurrentPhotoIndex(i);

        // Find the global index in the all photos array
        const globalIndex = photosListMiniAllPhotos.findIndex(photo => photo.originalPath === f);
        if (globalIndex !== -1) {
            setPhotosListMiniCurrentIndex(globalIndex);
        } else {
            // Fallback: use the provided index if photo not found in all photos
            setPhotosListMiniCurrentIndex(i);
        }

        // Force a re-read to ensure thumbnails are properly initialized
        setPhotosListMiniReread(!photosListMiniReread);

        logger.debug('usePhotoDisplay', 'display_photo_complete', 'Photo display initialized', {
            displayPath,
            globalIndex
        });

        // Check first_view achievement
        checkFirstActionAchievement('first_view');
    }, [
        photosListMiniAllPhotos,
        viewModeObj,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setPhotosListMiniCurrentIndex,
        setPhotosListMiniReread,
        photosListMiniReread
    ]);

    /**
     * Close the photo display and return to grid view
     */
    const closePhotoDisplay = useCallback(() => {
        logger.info('usePhotoDisplay', 'close_photo_display', 'Closing full-screen photo display', {
            viewMode: viewModeObj?.currentMode
        });

        setShowSideMenu(false);
        setCurrentPhotoPath("");

        // Cancel any existing photo loading before starting new request
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }

        // Refresh photos from backend when closing PhotoViewer
        // This ensures tag/metadata changes made in viewer are reflected in grid
        const fetchPhotos = async () => refreshPhotos();
        fetchPhotos().catch(error => handleError(error, 'Refresh photos after closing display'));
    }, [
        setShowSideMenu,
        viewModeObj,
        setCurrentPhotoPath,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,
        refreshPhotos,
        handleError
    ]);

    /**
     * Close the right column (side menu) without closing photo display
     */
    const closeRightColumn = useCallback(() => {
        logger.debug('usePhotoDisplay', 'close_right_column', 'Closing right column', {
            viewMode: viewModeObj?.currentMode
        });

        setShowSideMenu(false);
    }, [
        setShowSideMenu,
        viewModeObj
    ]);

    return {
        displayPhoto,
        closePhotoDisplay,
        closeRightColumn
    };
}
