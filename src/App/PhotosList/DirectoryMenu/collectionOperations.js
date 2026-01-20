/**
 * Collection operations for DirectoryMenu
 * Handles album and tag operations
 */
import { useState, useCallback } from 'react';
import { confirm } from "@tauri-apps/plugin-dialog";
import { logger } from "../../../services/LoggerService.js";
import { invokeWithErrorHandling } from "../../../services/TauriService.js";
import { UnifiedPhotoCollection } from "../../../domain/UnifiedPhotoCollection.js";

/**
 * Shared helper function to remove photos from a collection (album or tag)
 * @param {Object} options - Options object
 * @param {number} collectionId - The collection ID (album or tag)
 * @param {string} collectionType - 'album' or 'tag'
 * @param {Array<string>} photoSelection - Selected photo paths
 * @param {Function} clearPhotoSelection - Function to clear selection
 * @param {Function} addFooterMessage - Function to show footer message
 * @param {Function} handleTauriError - Function to handle errors
 * @param {Function} removePhotoFromList - Function to remove photo from UI list
 */
async function removePhotosFromCollection({
    collectionId,
    collectionType,
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    handleTauriError,
    removePhotoFromList
}) {
    if (!collectionId || photoSelection.length === 0) return;

    const count = photoSelection.length;
    const typeName = collectionType === 'album' ? 'album' : 'tag';
    const confirmed = await confirm(
        `Remove ${count} photo${count > 1 ? 's' : ''} from this ${typeName}?\n\nPhotos will remain in your library.`,
        `Remove from ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`
    );

    if (confirmed) {
        try {
            for (const photoPath of photoSelection) {
                await invokeWithErrorHandling(
                    "remove_photo_from_collection",
                    { collectionId: collectionId, photoPath: photoPath },
                    'collectionOperations',
                    { silent: true }
                );
                removePhotoFromList?.(photoPath);
            }

            clearPhotoSelection();
            addFooterMessage(`${count} photo${count > 1 ? 's' : ''} removed from ${typeName}`);

            logger.info('collectionOperations', `photos_removed_from_${typeName}`, `Photos removed from ${typeName} successfully`, {
                collectionId,
                collectionType,
                photoCount: count
            });
        } catch (error) {
            handleTauriError(error, `Remove from ${typeName}`);
        }
    }
}

/**
 * Hook for album operations
 */
export function useAlbumOperations({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    handleTauriError,
    viewModeObj,
    removePhotoFromList
}) {
    const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
    const [showAlbumSelectorModal, setShowAlbumSelectorModal] = useState(false);

    const showCreateAlbumModal = useCallback(() => {
        if (photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return;
        }

        logger.debug('collectionOperations', 'show_create_album_modal', 'Opening album creation modal', {
            selectedPhotosCount: photoSelection.length
        });
        setShowAlbumCreationModal(true);
    }, [photoSelection, addFooterMessage]);

    const showAddToAlbumModal = useCallback(() => {
        if (photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return;
        }

        logger.debug('collectionOperations', 'show_add_to_album_modal', 'Opening album selector modal', {
            selectedPhotosCount: photoSelection.length
        });
        setShowAlbumSelectorModal(true);
    }, [photoSelection, addFooterMessage]);

    const createAlbumFromSelection = useCallback(async (albumData) => {
        try {
            logger.info('collectionOperations', 'create_album_start', 'Creating album from selection using unified collections', {
                albumName: albumData.name,
                photoCount: photoSelection.length
            });

            const album = await UnifiedPhotoCollection.create('album', {
                name: albumData.name,
                description: albumData.description
            });

            for (const photoPath of photoSelection) {
                await album.addPhoto(photoPath);
            }

            if (photoSelection.length > 0) {
                const firstPhotoPath = photoSelection[0];
                logger.info('collectionOperations', 'set_cover_photo', 'Setting first photo as album cover using unified collection', {
                    albumId: album.id,
                    coverPhotoPath: firstPhotoPath
                });

                await album.update({
                    coverPhotoPath: firstPhotoPath
                });
            }

            const photoCount = photoSelection.length;
            clearPhotoSelection();
            addFooterMessage(`Album "${albumData.name}" created with ${photoCount} photos`);

            logger.info('collectionOperations', 'album_created_from_selection', 'Album created from selected photos', {
                albumName: albumData.name,
                albumId: album.id,
                photoCount,
                coverPhotoSet: photoSelection.length > 0
            });

            setShowAlbumCreationModal(false);
        } catch (error) {
            logger.error('collectionOperations', 'create_album_failed', 'Failed to create album from selection', {
                albumName: albumData.name,
                photoCount: photoSelection.length,
                error: error.message
            });
            handleTauriError(error, 'Create album');
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError]);

    const addPhotosToAlbum = useCallback(async (albumId) => {
        try {
            const photoCount = photoSelection.length;

            const addedCount = await invokeWithErrorHandling(
                "add_photos_to_collection_bulk",
                { collectionId: albumId, photoPaths: photoSelection },
                'collectionOperations'
            );

            clearPhotoSelection();

            if (addedCount === photoCount) {
                addFooterMessage(`${addedCount} photo${addedCount !== 1 ? 's' : ''} added to album`);
            } else {
                const skipped = photoCount - addedCount;
                addFooterMessage(`${addedCount} photo${addedCount !== 1 ? 's' : ''} added to album (${skipped} already existed)`);
            }

            setShowAlbumSelectorModal(false);
        } catch (error) {
            handleTauriError(error, 'Add to album');
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError]);

    const removeFromCurrentAlbum = useCallback(async () => {
        const currentAlbumId = viewModeObj?.getCurrentAlbumId();
        await removePhotosFromCollection({
            collectionId: currentAlbumId,
            collectionType: 'album',
            photoSelection,
            clearPhotoSelection,
            addFooterMessage,
            handleTauriError,
            removePhotoFromList
        });
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, viewModeObj, removePhotoFromList]);

    return {
        showAlbumCreationModal,
        setShowAlbumCreationModal,
        showAlbumSelectorModal,
        setShowAlbumSelectorModal,
        showCreateAlbumModal,
        showAddToAlbumModal,
        createAlbumFromSelection,
        addPhotosToAlbum,
        removeFromCurrentAlbum
    };
}

/**
 * Hook for tag operations
 */
export function useTagOperations({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    handleTauriError,
    onPhotosRefresh,
    viewModeObj,
    removePhotoFromList
}) {
    const [showBulkTagModal, setShowBulkTagModal] = useState(false);

    const showAddTagsModal = useCallback(() => {
        if (photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return;
        }

        logger.debug('collectionOperations', 'show_add_tags_modal', 'Opening bulk tag selector modal', {
            selectedPhotosCount: photoSelection.length
        });
        setShowBulkTagModal(true);
    }, [photoSelection, addFooterMessage]);

    const addTagsToPhotos = useCallback(async (selectedTagIds) => {
        try {
            const photoCount = photoSelection.length;
            const tagCount = selectedTagIds.length;

            let totalAdded = 0;
            for (const tagId of selectedTagIds) {
                const addedCount = await invokeWithErrorHandling(
                    "add_photos_to_collection_bulk",
                    { collectionId: tagId, photoPaths: photoSelection },
                    'collectionOperations',
                    { silent: true }
                );
                totalAdded += addedCount;
            }

            clearPhotoSelection();
            addFooterMessage(`${tagCount} tag${tagCount > 1 ? 's' : ''} added to ${photoCount} photo${photoCount > 1 ? 's' : ''}`);

            logger.info('collectionOperations', 'tags_added_to_photos', 'Tags added to photos successfully (bulk)', {
                tagIds: selectedTagIds,
                photoCount,
                tagCount,
                totalAdded
            });

            setShowBulkTagModal(false);

            if (onPhotosRefresh) {
                await onPhotosRefresh();
            }
        } catch (error) {
            handleTauriError(error, 'Add tags');
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, onPhotosRefresh]);

    const removeFromCurrentTag = useCallback(async () => {
        const currentTagId = viewModeObj?.getCurrentTagId();
        await removePhotosFromCollection({
            collectionId: currentTagId,
            collectionType: 'tag',
            photoSelection,
            clearPhotoSelection,
            addFooterMessage,
            handleTauriError,
            removePhotoFromList
        });
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, viewModeObj, removePhotoFromList]);

    return {
        showBulkTagModal,
        setShowBulkTagModal,
        showAddTagsModal,
        addTagsToPhotos,
        removeFromCurrentTag
    };
}
