import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';

/**
 * Custom hook for managing photo operations (albums, tags, deletion)
 * Extracted from PhotosList.jsx to reduce component complexity
 */
export function usePhotoOperations({
    selectedAlbums,
    setSelectedAlbums,
    selectedTags,
    setSelectedTags,
    handleError,
    addFooterMessage,
    loadAlbums,
    loadTags,
    currentAlbumId,
    toggleAlbumListMode,
    isTrashMode,
    // Photo list state (for removePhotoFromList)
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    closePhotoDisplay
}) {
    
    // Album selection handlers
    const handleAlbumSelection = useCallback((albumId, isSelected) => {
        logger.debug('PhotosList', 'album_selection_changed', 'Album selection changed', {
            albumId,
            isSelected,
            currentSelection: selectedAlbums.length
        });

        if (isSelected) {
            setSelectedAlbums(prev => [...prev, albumId]);
        } else {
            setSelectedAlbums(prev => prev.filter(id => id !== albumId));
        }
    }, [selectedAlbums.length, setSelectedAlbums]);

    const clearAlbumSelection = useCallback(() => {
        logger.debug('PhotosList', 'album_selection_cleared', 'Cleared album selection', {
            previousCount: selectedAlbums.length
        });
        setSelectedAlbums([]);
    }, [selectedAlbums.length, setSelectedAlbums]);

    // Tag selection handlers
    const handleTagSelection = useCallback((tagId, isSelected) => {
        logger.debug('PhotosList', 'tag_selection_changed', 'Tag selection changed', {
            tagId,
            isSelected,
            currentSelection: selectedTags.length
        });

        if (isSelected) {
            setSelectedTags(prev => [...prev, tagId]);
        } else {
            setSelectedTags(prev => prev.filter(id => id !== tagId));
        }
    }, [selectedTags.length, setSelectedTags]);

    const clearTagSelection = useCallback(() => {
        logger.debug('PhotosList', 'tag_selection_cleared', 'Cleared tag selection', {
            previousCount: selectedTags.length
        });
        setSelectedTags([]);
    }, [selectedTags.length, setSelectedTags]);

    // Delete selected albums
    const deleteSelectedAlbums = useCallback(async () => {
        if (selectedAlbums.length === 0) return;

        try {
            // Show async confirmation dialog before proceeding
            const confirmMessage = `Are you sure you want to delete ${selectedAlbums.length} album${selectedAlbums.length > 1 ? 's' : ''}?\n\nThis will remove ${selectedAlbums.length > 1 ? 'them' : 'it'} but keep all photos in your library.`;
            const confirmed = await confirm(confirmMessage, 'Delete Albums');
            
            if (!confirmed) {
                logger.info('PhotosList', 'delete_albums_cancelled', 'Album deletion cancelled by user', {
                    albumIds: selectedAlbums,
                    count: selectedAlbums.length
                });
                return;
            }

            logger.info('PhotosList', 'delete_albums_start', 'Deleting selected albums', {
                albumIds: selectedAlbums,
                count: selectedAlbums.length
            });

            for (const albumId of selectedAlbums) {
                await invoke("delete_album", { id: albumId });
            }

            // Clear the unified collection service cache to ensure other components refresh
            unifiedCollectionService.clearCache();
            
            // Refresh albums list and clear selection
            loadAlbums();
            clearAlbumSelection();

            addFooterMessage(`${selectedAlbums.length} album${selectedAlbums.length > 1 ? 's' : ''} deleted`);

            logger.info('PhotosList', 'albums_deleted', 'Albums deleted successfully', {
                count: selectedAlbums.length
            });
        } catch (error) {
            handleError(error, 'Delete albums', { albumIds: selectedAlbums });
        }
    }, [selectedAlbums, loadAlbums, clearAlbumSelection, addFooterMessage, handleError]);

    // Delete selected tags
    const deleteSelectedTags = useCallback(async () => {
        if (selectedTags.length === 0) return;

        try {
            // Show async confirmation dialog before proceeding
            const confirmMessage = `Are you sure you want to delete ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}?\n\nThis will remove ${selectedTags.length > 1 ? 'them' : 'it'} from all photos.`;
            const confirmed = await confirm(confirmMessage, 'Delete Tags');
            
            if (!confirmed) {
                logger.info('PhotosList', 'delete_tags_cancelled', 'Tag deletion cancelled by user', {
                    tagIds: selectedTags,
                    count: selectedTags.length
                });
                return;
            }

            logger.info('PhotosList', 'delete_tags_start', 'Deleting selected tags', {
                tagIds: selectedTags,
                count: selectedTags.length
            });

            for (const tagId of selectedTags) {
                await invoke("delete_tag", { tagId });
            }

            // Clear the unified collection service cache to ensure other components refresh
            unifiedCollectionService.clearCache();
            
            // Refresh tags list and clear selection
            loadTags();
            clearTagSelection();

            addFooterMessage(`${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} deleted`);

            logger.info('PhotosList', 'tags_deleted', 'Tags deleted successfully', {
                count: selectedTags.length
            });
        } catch (error) {
            handleError(error, 'Delete tags', { tagIds: selectedTags });
        }
    }, [selectedTags, loadTags, clearTagSelection, addFooterMessage, handleError]);

    // Handle album deletion (navigation logic)
    const handleAlbumDelete = useCallback((deletedAlbumId) => {
        // Handle album deletion - navigate back to album list
        if (deletedAlbumId === currentAlbumId) {
            // Navigate back to album list
            toggleAlbumListMode();
        }
        // Refresh albums list
        loadAlbums();

        logger.info('PhotosList', 'album_deleted_navigation', 'Navigated after album deletion', {
            deletedAlbumId,
            currentAlbumId
        });
    }, [currentAlbumId, toggleAlbumListMode, loadAlbums]);

    // Album-photo relationship operations
    const handleAddToAlbum = useCallback(async (photoPath, albumId) => {
        try {
            logger.info('usePhotoOperations', 'add_photo_to_album_start', 'Adding photo to album', {
                photoPath,
                albumId
            });

            await invoke("add_photo_to_album", { albumId, photoPath });

            logger.info('usePhotoOperations', 'add_photo_to_album_success', 'Photo added to album successfully', {
                photoPath,
                albumId
            });

            addFooterMessage('Photo added to album');
            return true;
        } catch (error) {
            handleError(error, 'Add photo to album', { photoPath, albumId });
            return false;
        }
    }, [handleError, addFooterMessage]);

    const removePhotoFromAlbum = useCallback(async (photoPath, albumId) => {
        try {
            logger.info('usePhotoOperations', 'remove_photo_from_album_start', 'Removing photo from album', {
                photoPath,
                albumId
            });

            const result = await invoke("remove_photo_from_album", { albumId, photoPath });

            logger.info('usePhotoOperations', 'remove_photo_from_album_success', 'Photo removed from album successfully', {
                photoPath,
                albumId,
                result
            });

            addFooterMessage('Photo removed from album');
            return true;
        } catch (error) {
            handleError(error, 'Remove photo from album', { photoPath, albumId });
            return false;
        }
    }, [handleError, addFooterMessage]);

    // Photo list management
    const removePhotoFromList = useCallback((indexToRemove) => {
        if (!photosListMiniAllPhotos || !setPhotosListMiniAllPhotos) {
            logger.warn('usePhotoOperations', 'remove_photo_from_list_missing_deps', 'Missing photo list dependencies');
            return;
        }

        logger.info('usePhotoOperations', 'remove_photo_from_list', 'Removing photo from current view', {
            index: indexToRemove,
            totalPhotos: photosListMiniAllPhotos.length
        });

        // Remove from photosListMiniAllPhotos
        const newAllPhotos = [...photosListMiniAllPhotos];
        newAllPhotos.splice(indexToRemove, 1);
        setPhotosListMiniAllPhotos(newAllPhotos);

        // Also remove from allPhotosForCurrentFetch if available
        const removedPath = photosListMiniAllPhotos[indexToRemove]?.file?.path;
        if (removedPath && allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
            const newAllPhotosForFetch = allPhotosForCurrentFetch.filter(photo => photo.originalPath !== removedPath);
            setAllPhotosForCurrentFetch(newAllPhotosForFetch);
        }

        // Adjust current index if needed
        if (indexToRemove >= newAllPhotos.length && newAllPhotos.length > 0) {
            // Last photo was removed, go to previous
            const newIndex = newAllPhotos.length - 1;
            if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(newIndex);
            if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
            if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
        } else if (newAllPhotos.length > 0) {
            // Stay at same index (now showing next photo)
            const newIndex = Math.min(indexToRemove, newAllPhotos.length - 1);
            if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(newIndex);
            if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
            if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
        } else {
            // No photos left
            if (closePhotoDisplay) closePhotoDisplay();
        }
    }, [
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        setPhotosListMiniCurrentIndex,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        closePhotoDisplay
    ]);

    // Photo deletion operations
    const permanentlyDeletePhoto = useCallback((photoPath) => {
        invoke("delete_permanently", { pathStr: photoPath }).then((result) => {
            logger.info('PhotosList', 'permanent_delete_success', 'Photo permanently deleted', { 
                path: photoPath, 
                result 
            });
            // Note: Caller should handle UI updates (remove from list, etc.)
        }).catch((error) => {
            handleError(error, 'Permanently delete photo', { path: photoPath });
        });
    }, [handleError]);

    const deletePhoto = useCallback((photoPath) => {
        // If in trash mode, permanently delete instead of moving to trash
        if (isTrashMode) {
            permanentlyDeletePhoto(photoPath);
            return;
        }

        // Otherwise move to trash (implementation would be here)
        logger.info('PhotosList', 'move_to_trash', 'Moving photo to trash', { path: photoPath });
        // Note: This would need the actual trash implementation
    }, [isTrashMode, permanentlyDeletePhoto]);

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

        // Photo list management
        removePhotoFromList,

        // Photo operations
        permanentlyDeletePhoto,
        deletePhoto,

        // Selection state (for convenience)
        selectedAlbumsCount: selectedAlbums.length,
        selectedTagsCount: selectedTags.length,
        hasSelectedAlbums: selectedAlbums.length > 0,
        hasSelectedTags: selectedTags.length > 0
    };
}

export default usePhotoOperations;