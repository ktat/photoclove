/**
 * Custom hook for photo deletion operations in PhotosListMini
 * Handles remove from album, move to trash, and permanent delete
 */
import { useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";
import { Photo } from "../../../domain/Photo.js";

/**
 * Hook for managing photo deletion operations
 * @param {Object} options
 * @param {Array} options.photos - Array of Photo entities
 * @param {number} options.currentIndex - Current photo index
 * @param {string} options.albumId - Album ID (if in album mode)
 * @param {string} options.albumName - Album name
 * @param {boolean} options.isAlbumMode - Whether in album mode
 * @param {boolean} options.isTrashMode - Whether in trash mode
 * @param {Function} options.removePhotoFromList - Callback to remove photo from list
 * @param {Function} options.deletePhotos - Callback to delete photos
 * @param {Function} options.updatePhotosAfterTrashOperation - Callback after trash operation
 * @param {Function} options.setCurrentIndex - Set current photo index
 * @param {Function} options.setCurrentPhoto - Set current photo entity
 * @param {Function} options.setCurrentPhotoIndex - Set current photo index (alternative)
 * @param {Function} options.closePhotoDisplay - Close photo display
 * @param {Function} options.addFooterMessage - Show footer message
 * @param {Function} options.handleTauriError - Handle Tauri errors
 * @param {Function} options.setAllPhotos - Set all photos in context
 * @param {Array} options.allPhotos - All photos from context
 * @returns {Object} Deletion operation state and handlers
 */
export function useDeletionOperations({
    photos,
    currentIndex,
    albumId,
    albumName,
    isAlbumMode,
    isTrashMode,
    removePhotoFromList,
    deletePhotos,
    updatePhotosAfterTrashOperation,
    setCurrentIndex,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    closePhotoDisplay,
    addFooterMessage,
    handleTauriError,
    setAllPhotos,
    allPhotos
}) {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteOperation, setDeleteOperation] = useState(null);

    const showRemoveFromAlbumModal = useCallback(() => {
        logger.info('useDeletionOperations', 'show_remove_from_album_modal', 'Opening Remove from Album modal', {
            albumId,
            albumName,
            isAlbumMode,
            currentPhotoIndex: currentIndex,
            currentPhotoPath: photos[currentIndex]?.originalPath
        });
        setDeleteOperation('removeFromAlbum');
        setShowDeleteModal(true);
    }, [albumId, albumName, isAlbumMode, currentIndex, photos]);

    const showDeleteFileModal = useCallback(() => {
        setDeleteOperation('deleteFile');
        setShowDeleteModal(true);
    }, []);

    const showPermanentDeleteModal = useCallback(() => {
        setDeleteOperation('permanentDelete');
        setShowDeleteModal(true);
    }, []);

    const closeModal = useCallback(() => {
        setShowDeleteModal(false);
        setDeleteOperation(null);
    }, []);

    const handleConfirmAction = useCallback(async () => {
        const currentPhoto = photos[currentIndex];
        if (!currentPhoto) {
            return;
        }

        // Close modal immediately for better UX
        setShowDeleteModal(false);
        setDeleteOperation(null);

        try {
            if (deleteOperation === 'removeFromAlbum') {
                logger.info('useDeletionOperations', 'remove_from_album_execute', 'Executing remove from album', {
                    albumId,
                    photoPath: currentPhoto.originalPath,
                    isAlbumIdValid: albumId !== null && albumId !== undefined
                });
                await invoke('remove_photo_from_album', {
                    albumId: albumId,
                    photoPath: currentPhoto.originalPath
                });

                logger.info('useDeletionOperations', 'photo_removed_from_album', 'Photo removed from album', {
                    albumId: albumId,
                    photoPath: currentPhoto.originalPath
                });

                removePhotoFromList?.(currentIndex);
                addFooterMessage?.('Photo removed from album');

            } else if (deleteOperation === 'permanentDelete') {
                // Permanently delete from trash
                const newAllPhotos = [...allPhotos];
                newAllPhotos.splice(currentIndex, 1);
                setAllPhotos(newAllPhotos);

                // Handle navigation to next/previous photo
                if (newAllPhotos.length > 0) {
                    let newIndex;
                    if (currentIndex >= newAllPhotos.length) {
                        newIndex = newAllPhotos.length - 1;
                    } else {
                        newIndex = currentIndex;
                    }

                    const nextPhoto = newAllPhotos[newIndex];

                    if (nextPhoto) {
                        const nextPhotoEntity = nextPhoto instanceof Photo ? nextPhoto : Photo.fromJSON(nextPhoto);
                        setCurrentIndex?.(newIndex);
                        setCurrentPhoto?.(nextPhotoEntity);
                        setCurrentPhotoIndex?.(newIndex);
                    }
                } else {
                    closePhotoDisplay?.();
                }

                if (updatePhotosAfterTrashOperation) {
                    await updatePhotosAfterTrashOperation([currentPhoto.originalPath], 'permanentDelete');
                }

                await invoke('delete_permanently_batch', {
                    paths: [currentPhoto.originalPath]
                });

                logger.info('useDeletionOperations', 'photo_permanently_deleted', 'Photo permanently deleted from trash', {
                    photoPath: currentPhoto.originalPath
                });

                addFooterMessage?.('Photo permanently deleted');

            } else {
                // deleteFile operation - move to trash
                await deletePhotos([currentPhoto.originalPath], {
                    skipConfirmation: true,
                    clearSelection: false
                });

                logger.info('useDeletionOperations', 'photo_deleted', 'Photo moved to trash', {
                    photoPath: currentPhoto.originalPath
                });

                addFooterMessage?.('Photo deleted');
            }
        } catch (error) {
            logger.error('useDeletionOperations', 'action_failed', 'Failed to perform action', {
                operation: deleteOperation,
                error: error.message
            });

            const errorContext = deleteOperation === 'removeFromAlbum' ? 'Remove from album' :
                                 deleteOperation === 'permanentDelete' ? 'Permanently delete photo' : 'Delete photo';
            handleTauriError?.(error, errorContext);
        }
    }, [
        photos,
        currentIndex,
        deleteOperation,
        albumId,
        allPhotos,
        removePhotoFromList,
        deletePhotos,
        updatePhotosAfterTrashOperation,
        setCurrentIndex,
        setCurrentPhoto,
        setCurrentPhotoIndex,
        closePhotoDisplay,
        addFooterMessage,
        handleTauriError,
        setAllPhotos
    ]);

    /**
     * Get the appropriate delete action based on mode and modifier keys
     * @param {KeyboardEvent} e - Keyboard event
     * @returns {Function|null} The appropriate modal show function
     */
    const getDeleteAction = useCallback((e) => {
        if (isTrashMode) {
            return showPermanentDeleteModal;
        } else if (isAlbumMode) {
            return e.ctrlKey ? showDeleteFileModal : showRemoveFromAlbumModal;
        } else {
            return showDeleteFileModal;
        }
    }, [isTrashMode, isAlbumMode, showPermanentDeleteModal, showDeleteFileModal, showRemoveFromAlbumModal]);

    return {
        showDeleteModal,
        deleteOperation,
        showRemoveFromAlbumModal,
        showDeleteFileModal,
        showPermanentDeleteModal,
        handleConfirmAction,
        closeModal,
        getDeleteAction,
        currentPhotoPath: photos[currentIndex]?.originalPath
    };
}

export default useDeletionOperations;
