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
 * - Separate selection state for import mode vs library mode
 * - Per-ViewMode selection persistence using SessionStorage
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { selectionStore } from '../stores/selectionStore.js';

const STORAGE_KEY_PREFIX = 'photoSelection:';

/**
 * Save selection to SessionStorage
 */
function saveSelectionToStorage(key, selection) {
    try {
        sessionStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(selection));
    } catch (error) {
        logger.error('usePhotoSelection', 'storage_save_error', 'Failed to save selection to storage', { error });
    }
}

/**
 * Load selection from SessionStorage
 */
function loadSelectionFromStorage(key) {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY_PREFIX + key);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        logger.error('usePhotoSelection', 'storage_load_error', 'Failed to load selection from storage', { error });
        return [];
    }
}

export function usePhotoSelection(viewMode, viewModeObj) {
    // Separate selection state for different mode types
    // Import mode: photos from external sources (not yet in library)
    // Trash mode: photos in trash (different operations available)
    // Library mode: photos in the library (date, album, tag, recent, search)
    const [importSelection, setImportSelection] = useState([]);
    const [importSelectionDict, setImportSelectionDict] = useState({});
    const [trashSelection, setTrashSelection] = useState([]);
    const [trashSelectionDict, setTrashSelectionDict] = useState({});
    const [librarySelection, setLibrarySelection] = useState([]);
    const [librarySelectionDict, setLibrarySelectionDict] = useState({});

    // Determine current mode category
    const isImportMode = viewMode === VIEW_MODES.IMPORT;
    const isTrashMode = viewMode === VIEW_MODES.TRASH;

    // Library mode: ViewMode 変更時に選択状態をStorageから復元
    useEffect(() => {
        if (isImportMode || isTrashMode || !viewModeObj) return;

        const currentKey = viewModeObj.getSelectionKey();
        const restoredSelection = loadSelectionFromStorage(currentKey);

        if (restoredSelection.length > 0) {
            setLibrarySelection(restoredSelection);
            const dict = {};
            restoredSelection.forEach(path => dict[path] = true);
            setLibrarySelectionDict(dict);
            logger.info('usePhotoSelection', 'restore_selection', 'Restored library photo selection for ViewMode', {
                viewModeKey: currentKey,
                count: restoredSelection.length
            });
        } else {
            setLibrarySelection([]);
            setLibrarySelectionDict({});
            logger.debug('usePhotoSelection', 'clear_selection', 'No stored selection for ViewMode', {
                viewModeKey: currentKey
            });
        }
    }, [viewModeObj, isImportMode, isTrashMode]);

    // Get current selection based on mode
    let photoSelection, photoSelectionDict, setPhotoSelection, setPhotoSelectionDict;

    if (isImportMode) {
        photoSelection = importSelection;
        photoSelectionDict = importSelectionDict;
        setPhotoSelection = setImportSelection;
        setPhotoSelectionDict = setImportSelectionDict;
    } else if (isTrashMode) {
        photoSelection = trashSelection;
        photoSelectionDict = trashSelectionDict;
        setPhotoSelection = setTrashSelection;
        setPhotoSelectionDict = setTrashSelectionDict;
    } else {
        photoSelection = librarySelection;
        photoSelectionDict = librarySelectionDict;
        setPhotoSelection = setLibrarySelection;
        setPhotoSelectionDict = setLibrarySelectionDict;
    }

    // Mirror the active selection dict into the per-path selectionStore so the
    // grid can subscribe per card (useIsSelected). replace() only notifies the
    // paths whose membership changed, so a single toggle re-renders one card
    // instead of every mounted PhotoCard.
    useEffect(() => {
        selectionStore.replace(photoSelectionDict);
    }, [photoSelectionDict]);

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

        // Save to storage for library mode
        if (!isImportMode && !isTrashMode && viewModeObj) {
            saveSelectionToStorage(viewModeObj.getSelectionKey(), selection);
        }
    }, [photoSelection, photoSelectionDict, isImportMode, isTrashMode, viewModeObj]);

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
     * @param {string} mode - Optional: 'import', 'trash', 'library', or 'all'. Defaults to current mode.
     */
    const clearSelection = useCallback((mode = 'current') => {
        if (mode === 'all' || mode === 'import') {
            logger.debug('usePhotoSelection', 'clear_import_selection', 'Clearing import mode selections', {
                previousCount: importSelection.length
            });
            setImportSelectionDict({});
            setImportSelection([]);
        }

        if (mode === 'all' || mode === 'trash') {
            logger.debug('usePhotoSelection', 'clear_trash_selection', 'Clearing trash mode selections', {
                previousCount: trashSelection.length
            });
            setTrashSelectionDict({});
            setTrashSelection([]);
        }

        if (mode === 'all' || mode === 'library') {
            logger.debug('usePhotoSelection', 'clear_library_selection', 'Clearing library mode selections', {
                previousCount: librarySelection.length
            });
            setLibrarySelectionDict({});
            setLibrarySelection([]);
            // Clear from storage as well
            if (viewModeObj) {
                saveSelectionToStorage(viewModeObj.getSelectionKey(), []);
            }
        }

        if (mode === 'current') {
            const modeType = isImportMode ? 'import' : (isTrashMode ? 'trash' : 'library');
            logger.debug('usePhotoSelection', 'clear_current_selection', 'Clearing current mode selections', {
                mode: modeType,
                previousCount: photoSelection.length
            });
            setPhotoSelectionDict({});
            setPhotoSelection([]);
            // Clear from storage for library mode
            if (!isImportMode && !isTrashMode && viewModeObj) {
                saveSelectionToStorage(viewModeObj.getSelectionKey(), []);
            }
        }
    }, [photoSelection.length, importSelection.length, trashSelection.length, librarySelection.length, isImportMode, isTrashMode, viewModeObj]);

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

        // Save to storage for library mode
        if (!isImportMode && !isTrashMode && viewModeObj) {
            saveSelectionToStorage(viewModeObj.getSelectionKey(), selection);
        }
    }, [photoSelection, photoSelectionDict, isImportMode, isTrashMode, viewModeObj]);

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

        // Save to storage for library mode
        if (!isImportMode && !isTrashMode && viewModeObj) {
            saveSelectionToStorage(viewModeObj.getSelectionKey(), photoPaths);
        }
    }, [isImportMode, isTrashMode, viewModeObj]);

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
