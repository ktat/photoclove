/**
 * usePhotoSelection Hook
 *
 * Manages photo selection state and operations for PhotosList component.
 * Extracted from PhotosList.jsx to improve modularity and reduce file size.
 *
 * Features:
 * - Individual photo selection toggle
 * - Select all photos in current view
 * - Clear all selections
 * - Check if photo is selected
 * - Track selection state with both array and dictionary for performance
 */

import { useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';

export function usePhotoSelection() {
    // Selection state - use both array and dict for different access patterns
    const [photoSelection, setPhotoSelection] = useState([]);
    const [photoSelectionDict, setPhotoSelectionDict] = useState({});

    /**
     * Toggle photo selection
     * @param {string} photoPath - Path of the photo to toggle
     */
    const togglePhotoSelection = useCallback((photoPath) => {
        const selection = photoSelection.concat();
        const selectionDict = { ...photoSelectionDict };

        if (!selectionDict[photoPath]) {
            // Add to selection
            selection.push(photoPath);
            selectionDict[photoPath] = true;
            logger.debug('usePhotoSelection', 'photo_selected', 'Photo added to selection', {
                photoPath,
                totalSelected: selection.length
            });
        } else {
            // Remove from selection
            const index = selection.indexOf(photoPath);
            if (index > -1) {
                selection.splice(index, 1);
            }
            delete selectionDict[photoPath];
            logger.debug('usePhotoSelection', 'photo_deselected', 'Photo removed from selection', {
                photoPath,
                totalSelected: selection.length
            });
        }

        setPhotoSelectionDict(selectionDict);
        setPhotoSelection(selection);
    }, [photoSelection, photoSelectionDict]);

    /**
     * Check if a photo is selected
     * @param {string} photoPath - Path of the photo to check
     * @returns {boolean} True if photo is selected
     */
    const isPhotoSelected = useCallback((photoPath) => {
        return !!photoSelectionDict[photoPath];
    }, [photoSelectionDict]);

    /**
     * Clear all selections
     */
    const clearSelection = useCallback(() => {
        logger.debug('usePhotoSelection', 'clear_selection', 'Clearing all photo selections', {
            previousCount: photoSelection.length
        });
        setPhotoSelectionDict({});
        setPhotoSelection([]);
    }, [photoSelection.length]);

    /**
     * Select all photos from a given list
     * @param {Array} photos - Array of photo objects or paths to select
     */
    const selectAllPhotos = useCallback((photos) => {
        const selection = photoSelection.concat();
        const newSelectionDict = { ...photoSelectionDict };
        let addedCount = 0;

        photos.forEach(photo => {
            const photoPath = photo.originalPath || photo.file?.path || photo.path || photo;
            if (!newSelectionDict[photoPath]) {
                selection.push(photoPath);
                newSelectionDict[photoPath] = true;
                addedCount++;
            }
        });

        logger.info('usePhotoSelection', 'select_all', 'Selected all photos', {
            totalPhotos: photos.length,
            newlyAdded: addedCount,
            totalSelected: selection.length
        });

        setPhotoSelectionDict(newSelectionDict);
        setPhotoSelection(selection);
    }, [photoSelection, photoSelectionDict]);

    /**
     * Set selection to specific photos (replaces current selection)
     * @param {Array} photoPaths - Array of photo paths to select
     */
    const setSelection = useCallback((photoPaths) => {
        const newSelectionDict = {};
        photoPaths.forEach(path => {
            newSelectionDict[path] = true;
        });

        logger.debug('usePhotoSelection', 'set_selection', 'Set specific photo selection', {
            count: photoPaths.length
        });

        setPhotoSelection(photoPaths);
        setPhotoSelectionDict(newSelectionDict);
    }, []);

    /**
     * Get selection statistics
     */
    const getSelectionStats = useCallback(() => {
        return {
            count: photoSelection.length,
            isEmpty: photoSelection.length === 0,
            hasSelection: photoSelection.length > 0
        };
    }, [photoSelection.length]);

    return {
        // State
        photoSelection,
        photoSelectionDict,

        // Actions
        togglePhotoSelection,
        isPhotoSelected,
        clearSelection,
        selectAllPhotos,
        setSelection,

        // Utils
        getSelectionStats
    };
}

export default usePhotoSelection;
