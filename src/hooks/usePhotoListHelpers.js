/**
 * usePhotoListHelpers Hook
 *
 * Provides helper functions for photo list operations including:
 * - Star rating updates
 * - Comment updates
 * - Photo selection
 * - Album management
 *
 * Extracted from PhotosList.jsx to reduce file size and improve maintainability.
 */

import { useCallback } from 'react';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';

/**
 * Custom hook for photo list helper functions
 *
 * @param {Object} params
 * @param {Function} params.setStar - Set star rating state
 * @param {Array} params.photosListMiniAllPhotos - All photos for mini display
 * @param {Function} params.setPhotosListMiniAllPhotos - Update mini photos
 * @param {Photo|null} params.currentPhoto - Current photo entity
 * @param {Array} params.allPhotosForCurrentFetch - All current photos
 * @param {Function} params.setAllPhotosForCurrentFetch - Update all photos
 * @param {string} params.viewMode - Current view mode
 * @param {Function} params.loadAlbums - Load albums function
 * @param {string} params.currentAlbumId - Current album ID
 * @param {Function} params.loadAlbumPhotos - Load album photos function
 * @param {Object} params.photoSelectionDict - Photo selection dictionary
 * @param {Function} params.togglePhotoSelection - Toggle photo selection
 * @param {Function} params.changeTab - Change tab function
 * @param {boolean} params.infiniteScrollEnabled - Infinite scroll enabled
 * @param {Array} params.displayedPhotos - Displayed photos
 * @param {Array} params.filteredPhotos - Filtered photos
 * @param {Function} params.selectAllPhotos - Select all photos function
 * @returns {Object} Helper functions
 */
export function usePhotoListHelpers({
    setStar,
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    currentPhoto,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    viewMode,
    loadAlbums,
    currentAlbumId,
    loadAlbumPhotos,
    photoSelectionDict,
    togglePhotoSelection,
    changeTab,
    infiniteScrollEnabled,
    displayedPhotos,
    filteredPhotos,
    selectAllPhotos,
    tabClass
}) {
    /**
     * Enhanced setStar function that updates photosListMiniAllPhotos
     * @param {Array} newStar - New star rating array
     */
    const setStarWithUpdate = useCallback((newStar) => {
        setStar(newStar);

        // Calculate star value from array
        let starValue = 0;
        for (let i = 0; i < 5; i++) {
            if (newStar[i]) {
                starValue = i + 1;
            } else {
                break;
            }
        }

        // Update the star value in photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === currentPhoto?.originalPath) {
                return { ...photoJSON, star: starValue };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === currentPhoto?.originalPath) {
                return { ...photo, star: starValue };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    }, [setStar, photosListMiniAllPhotos, setPhotosListMiniAllPhotos, currentPhoto, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch]);

    /**
     * Update comment in photo lists
     * @param {string} photoPath - Photo path
     * @param {boolean} hasComment - Whether photo has comment
     */
    const updatePhotoComment = useCallback((photoPath, hasComment) => {
        // Update photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === photoPath) {
                return { ...photoJSON, comment: hasComment ? "has comment" : null };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === photoPath) {
                return { ...photo, comment: hasComment ? "has comment" : null };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    }, [photosListMiniAllPhotos, setPhotosListMiniAllPhotos, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch]);

    /**
     * Refresh album list and current album after update
     */
    const handleAlbumUpdate = useCallback(() => {
        // Refresh album list and current album after update
        if (viewMode === VIEW_MODES.ALBUM_LIST) {
            loadAlbums();
        }
        if (currentAlbumId) {
            loadAlbumPhotos(currentAlbumId);
        }
        logger.info('usePhotoListHelpers', 'album_updated', 'Album refreshed after update', { currentAlbumId });
    }, [viewMode, loadAlbums, currentAlbumId, loadAlbumPhotos]);

    /**
     * Add or remove photo from selection and switch to selection tab
     * @param {boolean} t - True to add, false to remove
     * @param {string} f - Photo path
     */
    const addSelection = useCallback((t, f) => {
        if (t) {
            if (!photoSelectionDict[f]) {
                togglePhotoSelection(f);
            }
            // Don't switch to Selection tab if Share tab is active
            if (!tabClass?.share) {
                changeTab(undefined, "#tab-selection");
            }
        } else {
            if (photoSelectionDict[f]) {
                togglePhotoSelection(f);
            }
        }
    }, [photoSelectionDict, togglePhotoSelection, changeTab, tabClass]);

    /**
     * Toggle photo selection and return new state
     * @param {string} f - Photo path
     * @returns {boolean} New selection state
     */
    const toggleSelection = useCallback((f) => {
        const wasSelected = photoSelectionDict[f];
        togglePhotoSelection(f);
        return !wasSelected;
    }, [photoSelectionDict, togglePhotoSelection]);

    /**
     * Select all photos currently shown in the grid
     * PhotoGrid displays all filteredPhotos via react-window virtualization,
     * so we select filteredPhotos (not displayedPhotos which is only a 50-item slice).
     * Re-clicking after filteredPhotos grows (e.g. new imports) adds the new ones.
     */
    const selectAllPhotoToSelection = useCallback(() => {
        selectAllPhotos(filteredPhotos);
    }, [filteredPhotos, selectAllPhotos]);

    return {
        setStarWithUpdate,
        updatePhotoComment,
        handleAlbumUpdate,
        addSelection,
        toggleSelection,
        selectAllPhotoToSelection
    };
}
