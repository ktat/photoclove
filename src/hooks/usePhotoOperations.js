import { useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';
import { deleteFacesBatch, assignFacesToPersonBatch, createPerson } from '../services/FaceDetectionService.js';
import { Photo } from '../domain/Photo.js';

const STORAGE_KEY_ALBUMS = 'selectedAlbums';
const STORAGE_KEY_TAGS = 'selectedTags';
const STORAGE_KEY_PERSONS = 'selectedPersons';
const STORAGE_KEY_UNKNOWN_FACES = 'selectedUnknownFaces';

/**
 * Save selection to SessionStorage
 */
function saveSelectionToStorage(key, selection) {
    try {
        sessionStorage.setItem(key, JSON.stringify(selection));
    } catch (error) {
        logger.error('usePhotoOperations', 'storage_save_error', 'Failed to save selection to storage', { key, error });
    }
}

/**
 * Helper to get photo path from different photo object formats
 */
const getPhotoPath = (photo) => {
    return photo?.originalPath || photo?.file?.path || photo?.path;
};

/**
 * Custom hook for managing photo operations (albums, tags, deletion)
 * Extracted from PhotosList.jsx to reduce component complexity
 */
export function usePhotoOperations({
    selectedAlbums,
    setSelectedAlbums,
    selectedTags,
    setSelectedTags,
    selectedPersons,
    setSelectedPersons,
    selectedUnknownFaces,
    setSelectedUnknownFaces,
    handleError,
    addFooterMessage,
    loadAlbums,
    loadTags,
    loadFaces,
    currentAlbumId,
    toggleAlbumListMode,
    viewModeObj,
    // Photo list state
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    currentPhotoIndex,
    closePhotoDisplay,
    // Trash operations state
    setPhotosListMiniReread,
    photosListMiniReread,
    // Date state (for moveToTrash)
    dateNum,
    setDateNum,
    dateList,
    setDateList,
    sortOfPhotos,
    triggerUnknownFacesRefresh,
    dialog
}) {
    /**
     * Shared helper: Handle photo removal from list and navigation adjustment
     * Used by permanentlyDeletePhoto, moveToTrash, removePhotoFromList
     */
    const handlePhotoRemovalNavigation = useCallback((removedIndex, photoPath) => {
        if (!photosListMiniAllPhotos || photosListMiniAllPhotos.length === 0) {
            return;
        }

        // Create new array without the removed photo
        const newAllPhotos = [...photosListMiniAllPhotos];
        newAllPhotos.splice(removedIndex, 1);
        setPhotosListMiniAllPhotos(newAllPhotos);

        // Also update allPhotosForCurrentFetch if available
        if (photoPath && allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
            const updatedAllPhotos = allPhotosForCurrentFetch.filter(
                photo => getPhotoPath(photo) !== photoPath
            );
            setAllPhotosForCurrentFetch(updatedAllPhotos);
        }

        // Handle navigation after removal
        if (newAllPhotos.length === 0) {
            // No photos left - close display
            if (closePhotoDisplay) closePhotoDisplay();
            return;
        }

        // Determine new index and navigate
        const newIndex = removedIndex >= newAllPhotos.length
            ? newAllPhotos.length - 1  // Was last photo, go to previous
            : removedIndex;            // Stay at same index (now shows next photo)

        const newPhoto = newAllPhotos[newIndex];

        if (newPhoto) {
            const newPhotoEntity = newPhoto instanceof Photo ? newPhoto : Photo.fromJSON(newPhoto);
            if (setPhotosListMiniCurrentIndex) {
                setPhotosListMiniCurrentIndex(removedIndex >= newAllPhotos.length
                    ? photosListMiniCurrentIndex - 1
                    : photosListMiniCurrentIndex);
            }
            if (setCurrentPhoto) setCurrentPhoto(newPhotoEntity);
            if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
        }
    }, [
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        setCurrentPhoto,
        setCurrentPhotoIndex,
        closePhotoDisplay
    ]);

    // Album selection handlers
    const handleAlbumSelection = useCallback((albumId, isSelected) => {
        const newSelection = isSelected
            ? [...selectedAlbums, albumId]
            : selectedAlbums.filter(id => id !== albumId);
        setSelectedAlbums(newSelection);
        saveSelectionToStorage(STORAGE_KEY_ALBUMS, newSelection);
    }, [selectedAlbums, setSelectedAlbums]);

    const clearAlbumSelection = useCallback(() => {
        setSelectedAlbums([]);
        saveSelectionToStorage(STORAGE_KEY_ALBUMS, []);
    }, [setSelectedAlbums]);

    // Tag selection handlers
    const handleTagSelection = useCallback((tagId, isSelected) => {
        const newSelection = isSelected
            ? [...selectedTags, tagId]
            : selectedTags.filter(id => id !== tagId);
        setSelectedTags(newSelection);
        saveSelectionToStorage(STORAGE_KEY_TAGS, newSelection);
    }, [selectedTags, setSelectedTags]);

    const clearTagSelection = useCallback(() => {
        setSelectedTags([]);
        saveSelectionToStorage(STORAGE_KEY_TAGS, []);
    }, [setSelectedTags]);

    // Person selection handlers
    const handlePersonSelection = useCallback((personId, isSelected) => {
        const newSelection = isSelected
            ? [...selectedPersons, personId]
            : selectedPersons.filter(id => id !== personId);
        setSelectedPersons(newSelection);
        saveSelectionToStorage(STORAGE_KEY_PERSONS, newSelection);
    }, [selectedPersons, setSelectedPersons]);

    const clearPersonSelection = useCallback(() => {
        setSelectedPersons([]);
        saveSelectionToStorage(STORAGE_KEY_PERSONS, []);
    }, [setSelectedPersons]);

    // Unknown face selection handlers
    const handleUnknownFaceSelection = useCallback((faceId, isSelected) => {
        const newSelection = isSelected
            ? [...selectedUnknownFaces, faceId]
            : selectedUnknownFaces.filter(id => id !== faceId);
        setSelectedUnknownFaces(newSelection);
        saveSelectionToStorage(STORAGE_KEY_UNKNOWN_FACES, newSelection);
    }, [selectedUnknownFaces, setSelectedUnknownFaces]);

    const clearUnknownFaceSelection = useCallback(() => {
        setSelectedUnknownFaces([]);
        saveSelectionToStorage(STORAGE_KEY_UNKNOWN_FACES, []);
    }, [setSelectedUnknownFaces]);

    // Delete unknown faces batch
    const deleteUnknownFacesBatch = useCallback(async (faceIds) => {
        if (!faceIds || faceIds.length === 0) return;

        try {
            const count = await deleteFacesBatch(faceIds);
            clearUnknownFaceSelection();
            loadFaces();
            triggerUnknownFacesRefresh?.();
            addFooterMessage('face_op', `${count} face${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete faces batch', { faceIds });
        }
    }, [clearUnknownFaceSelection, loadFaces, triggerUnknownFacesRefresh, addFooterMessage, handleError]);

    // Assign unknown faces to person (new or existing)
    const assignUnknownFacesToPerson = useCallback(async (faceIds, existingPersonId, newPersonName) => {
        if (!faceIds || faceIds.length === 0) return;

        try {
            let personId = existingPersonId;

            // Create new person if name is provided
            if (newPersonName && !existingPersonId) {
                personId = await createPerson(newPersonName);
            }

            if (!personId) {
                throw new Error('No person ID available');
            }

            const count = await assignFacesToPersonBatch(faceIds, personId);
            clearUnknownFaceSelection();
            loadFaces();
            triggerUnknownFacesRefresh?.();
            addFooterMessage('face_op', `${count} face${count > 1 ? 's' : ''} assigned to person`);
        } catch (error) {
            handleError(error, 'Assign faces to person', { faceIds, existingPersonId, newPersonName });
        }
    }, [clearUnknownFaceSelection, loadFaces, triggerUnknownFacesRefresh, addFooterMessage, handleError]);

    // Delete selected albums
    const deleteSelectedAlbums = useCallback(async () => {
        if (selectedAlbums.length === 0) return;

        try {
            const count = selectedAlbums.length;
            const confirmed = await dialog.confirm({
                title: 'Delete Albums',
                message: `Are you sure you want to delete ${count} album${count > 1 ? 's' : ''}?\n\nThis will remove ${count > 1 ? 'them' : 'it'} but keep all photos in your library.`,
                kind: 'warning',
            });
            if (!confirmed) return;

            for (const albumId of selectedAlbums) {
                await unifiedCollectionService.deleteCollection(albumId);
            }

            loadAlbums();
            clearAlbumSelection();
            addFooterMessage('album_op', `${count} album${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete albums', { albumIds: selectedAlbums });
        }
    }, [selectedAlbums, loadAlbums, clearAlbumSelection, addFooterMessage, handleError, dialog]);

    // Delete selected tags
    const deleteSelectedTags = useCallback(async () => {
        if (selectedTags.length === 0) return;

        try {
            const count = selectedTags.length;
            const confirmed = await dialog.confirm({
                title: 'Delete Tags',
                message: `Are you sure you want to delete ${count} tag${count > 1 ? 's' : ''}?\n\nThis will remove ${count > 1 ? 'them' : 'it'} from all photos.`,
                kind: 'warning',
            });
            if (!confirmed) return;

            for (const tagId of selectedTags) {
                await unifiedCollectionService.deleteCollection(tagId);
            }

            loadTags();
            clearTagSelection();
            addFooterMessage('tag_op', `${count} tag${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete tags', { tagIds: selectedTags });
        }
    }, [selectedTags, loadTags, clearTagSelection, addFooterMessage, handleError, dialog]);

    // Delete selected persons (clear person names)
    const deleteSelectedPersons = useCallback(async () => {
        if (selectedPersons.length === 0) return;

        try {
            const count = selectedPersons.length;
            const confirmed = await dialog.confirm({
                title: 'Delete Persons',
                message: `Are you sure you want to delete ${count} person${count > 1 ? 's' : ''}?\n\nThis will remove the name${count > 1 ? 's' : ''} but keep all face detections.`,
                kind: 'warning',
            });
            if (!confirmed) return;

            for (const personId of selectedPersons) {
                await invoke('delete_person', { personId });
            }

            loadFaces();
            clearPersonSelection();
            addFooterMessage('person_op', `${count} person${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete persons', { personIds: selectedPersons });
        }
    }, [selectedPersons, loadFaces, clearPersonSelection, addFooterMessage, handleError, dialog]);

    // Handle album deletion (navigation logic)
    const handleAlbumDelete = useCallback((deletedAlbumId) => {
        if (deletedAlbumId === currentAlbumId) {
            toggleAlbumListMode();
        }
        loadAlbums();
    }, [currentAlbumId, toggleAlbumListMode, loadAlbums]);

    // Album-photo relationship operations
    const handleAddToAlbum = useCallback(async (photoPath, albumId) => {
        try {
            await invoke("add_photo_to_album", { albumId, photoPath });
            addFooterMessage('album_op', 'Photo added to album');
            return true;
        } catch (error) {
            handleError(error, 'Add photo to album', { photoPath, albumId });
            return false;
        }
    }, [handleError, addFooterMessage]);

    const removePhotoFromAlbum = useCallback(async (photoPath, albumId) => {
        try {
            await invoke("remove_photo_from_album", { albumId, photoPath });
            addFooterMessage('album_op', 'Photo removed from album');
            return true;
        } catch (error) {
            handleError(error, 'Remove photo from album', { photoPath, albumId });
            return false;
        }
    }, [handleError, addFooterMessage]);

    // Photo list management - removes photo from lists without triggering navigation
    // Accepts either an index (number) or a photo path (string)
    // Used by Selection tab operations (Remove from Album/Tag)
    const removePhotoFromList = useCallback((indexOrPath) => {
        if (!photosListMiniAllPhotos) return;

        let indexToRemove;
        let photoPath;

        if (typeof indexOrPath === 'number') {
            // Called with an index
            indexToRemove = indexOrPath;
            photoPath = getPhotoPath(photosListMiniAllPhotos[indexToRemove]);
        } else if (typeof indexOrPath === 'string') {
            // Called with a photo path - find the index
            indexToRemove = photosListMiniAllPhotos.findIndex(
                photo => getPhotoPath(photo) === indexOrPath
            );
            if (indexToRemove === -1) return; // Photo not found
            photoPath = indexOrPath;
        } else {
            return; // Invalid argument
        }

        // Only update lists, don't trigger navigation (for Selection tab operations)
        const newAllPhotos = [...photosListMiniAllPhotos];
        newAllPhotos.splice(indexToRemove, 1);
        setPhotosListMiniAllPhotos(newAllPhotos);

        // Also update allPhotosForCurrentFetch if available
        if (photoPath && allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
            const updatedAllPhotos = allPhotosForCurrentFetch.filter(
                photo => getPhotoPath(photo) !== photoPath
            );
            setAllPhotosForCurrentFetch(updatedAllPhotos);
        }
    }, [photosListMiniAllPhotos, setPhotosListMiniAllPhotos, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch]);

    // Photo deletion and trash operations
    const permanentlyDeletePhoto = useCallback((photoPath) => {
        invoke("delete_permanently_batch", { paths: [photoPath] }).then(() => {
            // Update navigation using shared helper
            handlePhotoRemovalNavigation(currentPhotoIndex, photoPath);
        }).catch((error) => {
            handleError(error, 'Permanently delete photo', { path: photoPath });
        });
    }, [handleError, currentPhotoIndex, handlePhotoRemovalNavigation]);

    // Helper to update date counts after photo removal
    const updateDateCounts = useCallback((resultDate) => {
        if (dateNum && dateNum[resultDate] > 0 && setDateNum && setDateList) {
            const newDateNum = { ...dateNum, [resultDate]: dateNum[resultDate] - 1 };
            setDateNum(newDateNum);
            setDateList(dateList.concat());
        }
    }, [dateNum, setDateNum, dateList, setDateList]);

    const moveToTrash = useCallback(async (photoPath, sortValue) => {
        // If in trash mode, permanently delete instead
        if (viewModeObj.isTrashMode()) {
            permanentlyDeletePhoto(photoPath);
            return;
        }

        try {
            const resultDate = await invoke("move_to_trash", { pathStr: photoPath, sortValue: parseInt(sortValue) });

            if (resultDate) {
                updateDateCounts(resultDate);
                handlePhotoRemovalNavigation(currentPhotoIndex, photoPath);
            }
        } catch (error) {
            handleError(error, 'Move photo to trash', { path: photoPath });
        }
    }, [
        viewModeObj,
        permanentlyDeletePhoto,
        handleError,
        updateDateCounts,
        currentPhotoIndex,
        handlePhotoRemovalNavigation
    ]);

    const restorePhoto = useCallback(async (photoPath) => {
        try {
            const resultDate = await invoke("restore_from_trash", { pathStr: photoPath });

            if (resultDate) {
                updateDateCounts(resultDate);
            }

            addFooterMessage('trash', 'Photo restored from trash');
            return true;
        } catch (error) {
            handleError(error, 'Restore photo from trash', { path: photoPath });
            return false;
        }
    }, [handleError, addFooterMessage, updateDateCounts]);

    const deletePhoto = useCallback((photoPath) => {
        // If in trash mode, permanently delete instead of moving to trash
        if (viewModeObj.isTrashMode()) {
            permanentlyDeletePhoto(photoPath);
            return;
        }

        // Otherwise move to trash
        moveToTrash(photoPath, parseInt(sortOfPhotos || 0));
    }, [viewModeObj.isTrashMode(), permanentlyDeletePhoto, moveToTrash, sortOfPhotos]);

    return {
        // Album operations
        handleAlbumSelection,
        clearAlbumSelection,
        deleteSelectedAlbums,
        handleAlbumDelete,

        // Album-photo operations
        handleAddToAlbum,
        removePhotoFromAlbum,

        // Tag operations
        handleTagSelection,
        clearTagSelection,
        deleteSelectedTags,

        // Person operations
        handlePersonSelection,
        clearPersonSelection,
        deleteSelectedPersons,

        // Unknown face operations
        handleUnknownFaceSelection,
        clearUnknownFaceSelection,
        deleteUnknownFacesBatch,
        assignUnknownFacesToPerson,

        // Photo list management
        removePhotoFromList,

        // Photo operations
        permanentlyDeletePhoto,
        deletePhoto,
        moveToTrash,
        restorePhoto,

        // Selection state (for convenience)
        selectedAlbumsCount: selectedAlbums.length,
        selectedTagsCount: selectedTags.length,
        hasSelectedAlbums: selectedAlbums.length > 0,
        hasSelectedTags: selectedTags.length > 0
    };
}

export default usePhotoOperations;