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
            if (newAllPhotos[newIndex]?.file?.path) {
                if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(newIndex);
                if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
                if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
            } else {
                logger.warn('usePhotoOperations', 'remove_photo_from_list_invalid_previous', 'Previous photo missing file.path', {
                    newIndex,
                    photo: newAllPhotos[newIndex]
                });
            }
        } else if (newAllPhotos.length > 0) {
            // Stay at same index (now showing next photo)
            const newIndex = Math.min(indexToRemove, newAllPhotos.length - 1);
            if (newAllPhotos[newIndex]?.file?.path) {
                if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(newIndex);
                if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
                if (setCurrentPhotoIndex) setCurrentPhotoIndex(newIndex);
            } else {
                logger.warn('usePhotoOperations', 'remove_photo_from_list_invalid_next', 'Next photo missing file.path', {
                    newIndex,
                    photo: newAllPhotos[newIndex]
                });
            }
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

    // Photo deletion and trash operations
    const permanentlyDeletePhoto = useCallback((photoPath) => {
        invoke("delete_permanently_batch", { paths: [photoPath] }).then((resultStr) => {
            const result = JSON.parse(resultStr);
            logger.info('usePhotoOperations', 'permanent_delete_success', 'Photo permanently deleted', {
                path: photoPath,
                result
            });

            // Remove from trash photos list
            if (setTrashPhotos) {
                setTrashPhotos(prevPhotos => prevPhotos.filter(photo => photo.path !== photoPath));
            }

            // Update thumbnail list when photo is deleted from current view
            if (photosListMiniAllPhotos && photosListMiniAllPhotos.length > 0 && setPhotosListMiniAllPhotos) {
                const allPhotos = photosListMiniAllPhotos;
                // Create a new array instead of mutating the existing one to trigger React state update
                const newAllPhotos = [...allPhotos];

                logger.debug('usePhotoOperations', 'permanent_delete_before_splice', 'Before removing photo', {
                    currentPhotoIndex,
                    totalPhotos: newAllPhotos.length
                });

                newAllPhotos.splice(currentPhotoIndex, 1);
                setPhotosListMiniAllPhotos(newAllPhotos);

                logger.debug('usePhotoOperations', 'permanent_delete_after_splice', 'After removing photo', {
                    currentPhotoIndex,
                    remainingPhotos: newAllPhotos.length,
                    isLastPhoto: currentPhotoIndex >= newAllPhotos.length
                });

                // Adjust navigation
                if (currentPhotoIndex >= newAllPhotos.length) {
                    // Last photo was removed, go to previous
                    const ci = currentPhotoIndex - 1;
                    logger.debug('usePhotoOperations', 'permanent_delete_last_photo', 'Handling last photo case', {
                        ci,
                        hasPhoto: !!newAllPhotos[ci],
                        hasFile: !!(newAllPhotos[ci]?.file),
                        hasPath: !!(newAllPhotos[ci]?.file?.path)
                    });

                    if (newAllPhotos[ci]?.file?.path) {
                        if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                        if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[ci].file.path);
                        if (setCurrentPhotoIndex) setCurrentPhotoIndex(ci);
                    } else {
                        logger.warn('usePhotoOperations', 'permanent_delete_no_previous_photo', 'No valid previous photo available', {
                            ci,
                            photo: newAllPhotos[ci]
                        });
                    }
                } else {
                    // Not last photo - stay at same index (shows next photo)
                    const ci = currentPhotoIndex;
                    logger.debug('usePhotoOperations', 'permanent_delete_not_last_photo', 'Handling not-last photo case', {
                        ci,
                        hasPhoto: !!newAllPhotos[ci],
                        hasFile: !!(newAllPhotos[ci]?.file),
                        hasPath: !!(newAllPhotos[ci]?.file?.path)
                    });

                    if (newAllPhotos[ci]?.file?.path) {
                        if (setPhotosListMiniReread) setPhotosListMiniReread(!photosListMiniReread);
                        if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[ci].file.path);
                    } else {
                        logger.warn('usePhotoOperations', 'permanent_delete_no_next_photo', 'No valid next photo available', {
                            ci,
                            photo: newAllPhotos[ci]
                        });
                    }
                }

                // Close display if no photos left
                if (newAllPhotos.length === 0 && closePhotoDisplay) {
                    logger.info('usePhotoOperations', 'permanent_delete_closing_display', 'No photos left, closing display');
                    closePhotoDisplay();
                }
            }
        }).catch((error) => {
            logger.error('usePhotoOperations', 'permanent_delete_error', 'Failed to permanently delete photo', {
                path: photoPath,
                error: error.message
            });
            handleError(error, 'Permanently delete photo', { path: photoPath });
        });
    }, [
        handleError,
        setTrashPhotos,
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        currentPhotoIndex,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setPhotosListMiniReread,
        photosListMiniReread,
        closePhotoDisplay
    ]);

    const updateDateList = (title, photoPath, dateNum, resultDate, setDateNum, setDateList) => {
        logger.info('usePhotoOperations', title, "List of Date update", {
            path: photoPath,
            date: resultDate
        });
        // Update date counts
        if (dateNum && dateNum[resultDate] > 0 && setDateNum && setDateList) {
            const newDateNum = { ...dateNum, [resultDate]: dateNum[resultDate] - 1 };
            setDateNum(newDateNum);
            setDateList(dateList.concat());
        }
    };

    const moveToTrash = useCallback(async (photoPath, sortValue) => {
        // If in trash mode, permanently delete instead
        if (isTrashMode) {
            permanentlyDeletePhoto(photoPath);
            return;
        }

        try {
            logger.info('usePhotoOperations', 'move_to_trash_start', 'Moving photo to trash', {
                path: photoPath,
                sortValue
            });
            const resultDate = await invoke("move_to_trash", { pathStr: photoPath, sortValue: parseInt(sortValue) });

            logger.info('usePhotoOperations', 'move_to_trash_result', 'Moving photo to trash', {
                path: photoPath,
                resultDate
            });

            if (resultDate) {
                updateDateList("move_to_trash", photoPath, dateNum, resultDate, setDateNum, setDateList);

                // Update thumbnail list
                if (photosListMiniAllPhotos && photosListMiniAllPhotos.length > 0 && setPhotosListMiniAllPhotos) {
                    const allPhotos = photosListMiniAllPhotos;
                    const newAllPhotos = [...allPhotos];

                    logger.debug('usePhotoOperations', 'move_to_trash_before_splice', 'Before removing photo', {
                        currentPhotoIndex,
                        totalPhotos: newAllPhotos.length
                    });

                    newAllPhotos.splice(currentPhotoIndex, 1);
                    setPhotosListMiniAllPhotos(newAllPhotos);

                    // Also update allPhotosForCurrentFetch (used for grid view)
                    if (allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
                        const updatedAllPhotos = allPhotosForCurrentFetch.filter(
                            photo => photo.originalPath !== photoPath
                        );
                        setAllPhotosForCurrentFetch(updatedAllPhotos);
                        logger.info('usePhotoOperations', 'move_to_trash_grid_updated', 'Updated grid view photos', {
                            beforeCount: allPhotosForCurrentFetch.length,
                            afterCount: updatedAllPhotos.length,
                            removedPath: photoPath
                        });
                    }

                    logger.debug('usePhotoOperations', 'move_to_trash_after_splice', 'After removing photo', {
                        currentPhotoIndex,
                        remainingPhotos: newAllPhotos.length,
                        isLastPhoto: currentPhotoIndex >= newAllPhotos.length
                    });

                    // Adjust navigation
                    if (currentPhotoIndex >= newAllPhotos.length) {
                        // Last photo - move to previous
                        const ci = currentPhotoIndex - 1;
                        logger.debug('usePhotoOperations', 'move_to_trash_last_photo', 'Handling last photo case', {
                            ci,
                            hasPhoto: !!newAllPhotos[ci],
                            hasOriginalPath: !!(newAllPhotos[ci]?.originalPath)
                        });

                        if (newAllPhotos[ci]?.originalPath) {
                            if (setPhotosListMiniCurrentIndex) setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                            if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[ci].originalPath);
                            if (setCurrentPhotoIndex) setCurrentPhotoIndex(ci);
                        } else {
                            logger.warn('usePhotoOperations', 'move_to_trash_no_previous_photo', 'No valid previous photo available', {
                                ci,
                                photo: newAllPhotos[ci]
                            });
                        }
                    } else {
                        // Not last photo - stay at current index (which now points to next photo)
                        const ci = currentPhotoIndex;
                        logger.debug('usePhotoOperations', 'move_to_trash_not_last_photo', 'Handling not-last photo case', {
                            ci,
                            hasPhoto: !!newAllPhotos[ci],
                            hasOriginalPath: !!(newAllPhotos[ci]?.originalPath)
                        });

                        if (newAllPhotos[ci]?.originalPath) {
                            // Update all state consistently (same as last photo case)
                            if (setCurrentPhotoPath) setCurrentPhotoPath(newAllPhotos[ci].originalPath);
                            if (setCurrentPhotoIndex) setCurrentPhotoIndex(ci);
                            // Note: photosListMiniCurrentIndex stays the same since we're at the same position in the list
                        } else {
                            logger.warn('usePhotoOperations', 'move_to_trash_no_next_photo', 'No valid next photo available', {
                                ci,
                                photo: newAllPhotos[ci]
                            });
                        }
                    }

                    // Close display if no photos left
                    if (newAllPhotos.length === 0 && closePhotoDisplay) {
                        logger.info('usePhotoOperations', 'move_to_trash_closing_display', 'No photos left, closing display');
                        closePhotoDisplay();
                    }
                }
            }
        } catch (error) {
            logger.error('usePhotoOperations', 'move_to_trash_error', 'Failed to move photo to trash', {
                path: photoPath,
                error: error.message
            });
            handleError(error, 'Move photo to trash', { path: photoPath });
        }
    }, [
        isTrashMode,
        permanentlyDeletePhoto,
        handleError,
        dateNum,
        setDateNum,
        dateList,
        setDateList,
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        currentPhotoIndex,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setPhotosListMiniReread,
        photosListMiniReread,
        closePhotoDisplay
    ]);

    const restorePhoto = useCallback(async (photoPath) => {
        try {
            logger.info('usePhotoOperations', 'restore_photo_start', 'Restoring photo from trash', {
                path: photoPath
            });

            const resultDate = await invoke("restore_from_trash", { pathStr: photoPath });

            logger.info('usePhotoOperations', 'restore_photo_result', 'Restoring photo from trash', {
                path: photoPath,
                resultDate
            });

            updateDateList("restore photo from trash", photoPath, dateNum, resultDate, setDateNum, setDateList);

            // Remove from trash photos list
            if (setTrashPhotos) {
                setTrashPhotos(prevPhotos => prevPhotos.filter(photo => photo.path !== photoPath));
            }

            addFooterMessage('Photo restored from trash');
            return true;
        } catch (error) {
            logger.error('usePhotoOperations', 'restore_photo_error', 'Failed to restore photo from trash', {
                path: photoPath,
                error: error.message
            });
            handleError(error, 'Restore photo from trash', { path: photoPath });
            return false;
        }
    }, [handleError, addFooterMessage, setTrashPhotos, dateNum, setDateNum, dateList, setDateList]);

    const deletePhoto = useCallback((photoPath) => {
        // If in trash mode, permanently delete instead of moving to trash
        if (isTrashMode) {
            permanentlyDeletePhoto(photoPath);
            return;
        }

        // Otherwise move to trash
        moveToTrash(photoPath, parseInt(sortOfPhotos || 0));
    }, [isTrashMode, permanentlyDeletePhoto, moveToTrash, sortOfPhotos]);

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