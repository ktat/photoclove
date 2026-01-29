import { useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';

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
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    currentPhotoIndex,
    closePhotoDisplay,
    // Trash operations state
    setTrashPhotos,
    setPhotosListMiniReread,
    photosListMiniReread,
    // Date state (for moveToTrash)
    dateNum,
    setDateNum,
    dateList,
    setDateList,
    sortOfPhotos
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
        const newPath = getPhotoPath(newPhoto);

        if (newPath) {
            if (setPhotosListMiniCurrentIndex) {
                setPhotosListMiniCurrentIndex(removedIndex >= newAllPhotos.length
                    ? photosListMiniCurrentIndex - 1
                    : photosListMiniCurrentIndex);
            }
            if (setCurrentPhotoPath) setCurrentPhotoPath(newPath);
            if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
        }
    }, [
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        closePhotoDisplay
    ]);

    // Album selection handlers
    const handleAlbumSelection = useCallback((albumId, isSelected) => {
        if (isSelected) {
            setSelectedAlbums(prev => [...prev, albumId]);
        } else {
            setSelectedAlbums(prev => prev.filter(id => id !== albumId));
        }
    }, [setSelectedAlbums]);

    const clearAlbumSelection = useCallback(() => {
        setSelectedAlbums([]);
    }, [setSelectedAlbums]);

    // Tag selection handlers
    const handleTagSelection = useCallback((tagId, isSelected) => {
        if (isSelected) {
            setSelectedTags(prev => [...prev, tagId]);
        } else {
            setSelectedTags(prev => prev.filter(id => id !== tagId));
        }
    }, [setSelectedTags]);

    const clearTagSelection = useCallback(() => {
        setSelectedTags([]);
    }, [setSelectedTags]);

    // Person selection handlers
    const handlePersonSelection = useCallback((personId, isSelected) => {
        if (isSelected) {
            setSelectedPersons(prev => [...prev, personId]);
        } else {
            setSelectedPersons(prev => prev.filter(id => id !== personId));
        }
    }, [setSelectedPersons]);

    const clearPersonSelection = useCallback(() => {
        setSelectedPersons([]);
    }, [setSelectedPersons]);

    // Delete selected albums
    const deleteSelectedAlbums = useCallback(async () => {
        if (selectedAlbums.length === 0) return;

        try {
            const count = selectedAlbums.length;
            const confirmMessage = `Are you sure you want to delete ${count} album${count > 1 ? 's' : ''}?\n\nThis will remove ${count > 1 ? 'them' : 'it'} but keep all photos in your library.`;
            const confirmed = await confirm(confirmMessage, 'Delete Albums');
            if (!confirmed) return;

            for (const albumId of selectedAlbums) {
                await unifiedCollectionService.deleteCollection(albumId);
            }

            loadAlbums();
            clearAlbumSelection();
            addFooterMessage(`${count} album${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete albums', { albumIds: selectedAlbums });
        }
    }, [selectedAlbums, loadAlbums, clearAlbumSelection, addFooterMessage, handleError]);

    // Delete selected tags
    const deleteSelectedTags = useCallback(async () => {
        if (selectedTags.length === 0) return;

        try {
            const count = selectedTags.length;
            const confirmMessage = `Are you sure you want to delete ${count} tag${count > 1 ? 's' : ''}?\n\nThis will remove ${count > 1 ? 'them' : 'it'} from all photos.`;
            const confirmed = await confirm(confirmMessage, 'Delete Tags');
            if (!confirmed) return;

            for (const tagId of selectedTags) {
                await unifiedCollectionService.deleteCollection(tagId);
            }

            loadTags();
            clearTagSelection();
            addFooterMessage(`${count} tag${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete tags', { tagIds: selectedTags });
        }
    }, [selectedTags, loadTags, clearTagSelection, addFooterMessage, handleError]);

    // Delete selected persons (clear person names)
    const deleteSelectedPersons = useCallback(async () => {
        if (selectedPersons.length === 0) return;

        try {
            const count = selectedPersons.length;
            const confirmMessage = `Are you sure you want to delete ${count} person${count > 1 ? 's' : ''}?\n\nThis will remove the name${count > 1 ? 's' : ''} but keep all face detections.`;
            const confirmed = await confirm(confirmMessage, 'Delete Persons');
            if (!confirmed) return;

            for (const personId of selectedPersons) {
                await invoke('delete_person', { personId });
            }

            loadFaces();
            clearPersonSelection();
            addFooterMessage(`${count} person${count > 1 ? 's' : ''} deleted`);
        } catch (error) {
            handleError(error, 'Delete persons', { personIds: selectedPersons });
        }
    }, [selectedPersons, loadFaces, clearPersonSelection, addFooterMessage, handleError]);

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
            addFooterMessage('Photo added to album');
            return true;
        } catch (error) {
            handleError(error, 'Add photo to album', { photoPath, albumId });
            return false;
        }
    }, [handleError, addFooterMessage]);

    const removePhotoFromAlbum = useCallback(async (photoPath, albumId) => {
        try {
            await invoke("remove_photo_from_album", { albumId, photoPath });
            addFooterMessage('Photo removed from album');
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
            // Remove from trash photos list
            if (setTrashPhotos) {
                setTrashPhotos(prevPhotos => prevPhotos.filter(photo => photo.path !== photoPath));
            }

            // Update navigation using shared helper
            handlePhotoRemovalNavigation(currentPhotoIndex, photoPath);
        }).catch((error) => {
            handleError(error, 'Permanently delete photo', { path: photoPath });
        });
    }, [handleError, setTrashPhotos, currentPhotoIndex, handlePhotoRemovalNavigation]);

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

            // Remove from trash photos list
            if (setTrashPhotos) {
                setTrashPhotos(prevPhotos => prevPhotos.filter(photo => photo.path !== photoPath));
            }

            addFooterMessage('Photo restored from trash');
            return true;
        } catch (error) {
            handleError(error, 'Restore photo from trash', { path: photoPath });
            return false;
        }
    }, [handleError, addFooterMessage, setTrashPhotos, updateDateCounts]);

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