/**
 * Burst group operations for DirectoryMenu
 * Handles creating, dissolving, and removing from burst groups
 */
import { useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";

/**
 * Hook for burst group operations
 *
 * @param {Object} params - Hook parameters
 * @param {Array} params.photoSelection - Currently selected photo paths
 * @param {Function} params.clearPhotoSelection - Clears the photo selection
 * @param {Function} params.addFooterMessage - Displays a message in the footer
 * @param {Function} params.handleTauriError - Error handler for Tauri errors
 * @param {Function} params.reloadPhotos - Reloads the photo list
 */
export function useGroupOperations({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    handleTauriError,
    reloadPhotos,
    dialog
}) {
    /**
     * Creates a burst group from selected photos
     */
    const createBurstGroup = useCallback(async () => {
        if (photoSelection.length < 2) {
            addFooterMessage('burst_group', 'Please select at least 2 photos to create a group');
            return;
        }

        const count = photoSelection.length;
        const confirmed = await dialog.confirm({
            title: 'Create Burst Group',
            message: `Create a burst group with ${count} photos?\nGrouped photos will display as a single item in Burst mode.`,
            kind: 'info',
        });

        if (!confirmed) return;

        try {
            logger.info('groupOperations', 'create_burst_group_start', 'Creating burst group', {
                photoCount: count
            });

            const groupId = await invoke("create_burst_group", {
                photoPaths: photoSelection
            });

            clearPhotoSelection();
            addFooterMessage('burst_group', `Created burst group with ${count} photos`);

            logger.info('groupOperations', 'create_burst_group_success', 'Burst group created', {
                groupId,
                photoCount: count
            });

            // Reload photos to reflect the grouping
            if (reloadPhotos) {
                await reloadPhotos();
            }
        } catch (error) {
            logger.error('groupOperations', 'create_burst_group_failed', 'Failed to create burst group', {
                photoCount: count,
                error: error.toString()
            });
            handleTauriError(error, 'Create burst group');
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, reloadPhotos, dialog]);

    /**
     * Removes selected photos from their burst groups
     * If a group has fewer than 2 photos remaining, it is automatically dissolved
     */
    const removeFromBurstGroup = useCallback(async () => {
        if (photoSelection.length === 0) {
            addFooterMessage('burst_group', 'Please select photos to remove from groups');
            return;
        }

        const count = photoSelection.length;
        const confirmed = await dialog.confirm({
            title: 'Remove from Burst Group',
            message: `Remove ${count} photo${count > 1 ? 's' : ''} from burst group${count > 1 ? 's' : ''}?\nGroups with fewer than 2 photos will be automatically dissolved.`,
            kind: 'warning',
        });

        if (!confirmed) return;

        try {
            logger.info('groupOperations', 'remove_from_burst_group_start', 'Removing photos from burst groups', {
                photoCount: count
            });

            await invoke("remove_from_burst_group", {
                photoPaths: photoSelection
            });

            clearPhotoSelection();
            addFooterMessage('burst_group', `Removed ${count} photo${count > 1 ? 's' : ''} from burst group${count > 1 ? 's' : ''}`);

            logger.info('groupOperations', 'remove_from_burst_group_success', 'Photos removed from burst groups', {
                photoCount: count
            });

            // Reload photos to reflect the change
            if (reloadPhotos) {
                await reloadPhotos();
            }
        } catch (error) {
            logger.error('groupOperations', 'remove_from_burst_group_failed', 'Failed to remove photos from burst groups', {
                photoCount: count,
                error: error.toString()
            });
            handleTauriError(error, 'Remove from burst group');
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, reloadPhotos, dialog]);

    return {
        createBurstGroup,
        removeFromBurstGroup
    };
}
