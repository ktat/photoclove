import { useCallback } from 'react';
import { logger } from '../services/LoggerService.js';
import { checkFirstActionAchievement } from '../services/AchievementService.js';
import { Photo } from '../domain/Photo.js';
import { getPhotoSortComparator } from '../utils/PhotoSort.js';

/**
 * Custom hook for photo display management
 *
 * Handles photo display operations including:
 * - Opening photos in full-screen view
 * - Closing photo display
 * - Managing right column visibility
 *
 * Phase 2: closePhotoDisplay no longer calls refreshPhotos. Edits made
 * during PhotoDisplay are propagated in-memory via Phase 2 helpers
 * (setStarWithUpdate, updatePhotoTags, updatePhotoComment,
 * updatePhotoCssStyle, addPhotoToList, handlePhotoRemovalNavigationBulk).
 * useFilteredPhotosSync reconciles photosListMiniAllPhotos with the
 * filter result when currentPhoto becomes null. If sortDirty is true,
 * we apply a local re-sort here so the grid lands in the correct
 * order without a backend roundtrip.
 *
 * @param {Object} params
 * @param {Array} params.photosListMiniAllPhotos
 * @param {Function} params.setPhotosListMiniAllPhotos
 * @param {Function} params.setAllPhotosForCurrentFetch
 * @param {Object} params.viewModeObj
 * @param {Function} params.setCurrentPhoto
 * @param {Function} params.setCurrentPhotoIndex
 * @param {Function} params.setPhotosListMiniCurrentIndex
 * @param {Function} params.setPhotosListMiniReread
 * @param {Function} params.setShowSideMenu
 * @param {Object} params.currentPhotoLoadingController
 * @param {Function} params.setCurrentPhotoLoadingController
 * @param {boolean} params.photosListMiniReread
 * @param {boolean} params.sortDirty
 * @param {Function} params.setSortDirty
 * @param {number} params.sortOfPhotos
 * @param {Function} params.patchCacheCurrentView - (updater) => void; updates the cached array for the current viewKey
 * @returns {Object} Photo display management functions
 */
export function usePhotoDisplay({
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    setAllPhotosForCurrentFetch,
    viewModeObj,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    setPhotosListMiniCurrentIndex,
    setPhotosListMiniReread,
    setShowSideMenu,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    photosListMiniReread,
    sortDirty,
    setSortDirty,
    sortOfPhotos,
    patchCacheCurrentView
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
        const photoEntity = photoToFind ? Photo.fromJSON(photoToFind) : null;

        setCurrentPhoto(photoEntity);
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
            displayPath: photoEntity?.displayPath(),
            globalIndex
        });

        // Check first_view achievement
        checkFirstActionAchievement('first_view');
    }, [
        photosListMiniAllPhotos,
        viewModeObj,
        setCurrentPhoto,
        setCurrentPhotoIndex,
        setPhotosListMiniCurrentIndex,
        setPhotosListMiniReread,
        photosListMiniReread
    ]);

    /**
     * Close the photo display and return to grid view.
     *
     * Phase 2: no backend refetch. The freeze on useFilteredPhotosSync
     * lifts as currentPhoto becomes null and the effect reconciles the
     * mini list. If sortDirty is true (star edits made order stale),
     * apply a local re-sort to all three state slots first.
     */
    const closePhotoDisplay = useCallback(() => {
        logger.info('usePhotoDisplay', 'close_photo_display', 'Closing full-screen photo display', {
            viewMode: viewModeObj?.currentMode,
            sortDirty
        });

        setShowSideMenu(false);
        setCurrentPhoto(null);

        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }

        if (sortDirty) {
            const comparator = getPhotoSortComparator(sortOfPhotos);
            if (comparator) {
                setAllPhotosForCurrentFetch(prev => [...prev].sort(comparator));
                setPhotosListMiniAllPhotos(prev => [...prev].sort(comparator));
                if (patchCacheCurrentView) {
                    patchCacheCurrentView(prev => [...prev].sort(comparator));
                }
            }
            if (setSortDirty) setSortDirty(false);
        }
    }, [
        setShowSideMenu,
        viewModeObj,
        setCurrentPhoto,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,
        sortDirty,
        setSortDirty,
        sortOfPhotos,
        setAllPhotosForCurrentFetch,
        setPhotosListMiniAllPhotos,
        patchCacheCurrentView
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
