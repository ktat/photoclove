/**
 * useTrashOperations Hook
 *
 * Handles trash operations including moving photos to trash and restoring them.
 * Manages date count updates and optimistic UI updates.
 *
 * Extracted from PhotosList.jsx to reduce file size and improve maintainability.
 */

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

/**
 * Custom hook for trash operations (delete and restore)
 *
 * @param {Object} params
 * @param {Array} params.allPhotosForCurrentFetch - Current photos list
 * @param {Function} params.setAllPhotosForCurrentFetch - Update photos list
 * @param {Array} params.photoSelection - Selected photos
 * @param {Function} params.clearPhotoSelection - Clear selection
 * @param {Object} params.dateNum - Date counts
 * @param {Function} params.updateDateNum - Update date counts
 * @param {Array} params.dateList - Date list
 * @param {Function} params.updateDateList - Update date list
 * @param {Function} params.reloadCurrentModeData - Reload current view
 * @param {Function} params.updatePhotosAfterTrashOperation - Update photos after trash op
 * @param {Function} params.handleError - Error handler
 * @param {Function} params.addFooterMessage - Show footer message
 * @returns {Object} Trash operation handlers
 */
export function useTrashOperations({
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    photoSelection,
    clearPhotoSelection,
    dateNum,
    updateDateNum,
    dateList,
    updateDateList,
    reloadCurrentModeData,
    updatePhotosAfterTrashOperation,
    handleError,
    addFooterMessage,
    // Phase 2: extra state for PhotoDisplay-aware rollback
    currentPhoto,
    setCurrentPhoto,
    currentPhotoIndex,
    setCurrentPhotoIndex,
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    handlePhotoRemovalNavigationBulk
}) {
    /**
     * Generic handler to delete photos with date count updates
     * @param {string[]} paths - Array of photo paths to delete
     * @param {Object} options - Options for deletion behavior
     * @param {boolean} options.skipConfirmation - Skip confirmation dialog
     * @param {boolean} options.clearSelection - Clear photo selection after delete
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const deletePhotos = useCallback(async (paths, { skipConfirmation = false, clearSelection = true } = {}) => {
        logger.debug('useTrashOperations', 'delete_photos_called', 'deletePhotos called', {
            pathsLength: paths?.length,
            skipConfirmation,
            clearSelection,
            hasDateNum: !!dateNum,
            hasUpdateDateNum: !!updateDateNum,
            hasDateList: !!dateList,
            hasUpdateDateList: !!updateDateList
        });

        if (!paths || paths.length === 0) {
            addFooterMessage('trash', 'No photos to delete');
            return false;
        }

        const count = paths.length;

        try {
            logger.info('useTrashOperations', 'delete_photos_start', 'Deleting photos', {
                photoCount: count,
                skipConfirmation,
                clearSelection
            });

            // Backup current state for rollback on failure
            const deletedPaths = [...paths];
            const photosBackup = allPhotosForCurrentFetch ? [...allPhotosForCurrentFetch] : null;

            // Phase 2: full rollback context for PhotoDisplay-aware bulk delete
            const miniPhotosBackup = photosListMiniAllPhotos ? [...photosListMiniAllPhotos] : null;
            const miniIndexBackup = photosListMiniCurrentIndex;
            const currentIndexBackup = currentPhotoIndex;
            const currentPhotoBackup = currentPhoto;

            // If PhotoDisplay is open, use the bulk navigation helper so the mini
            // list + currentPhotoIndex are also adjusted. Otherwise fall back to
            // the existing optimistic filter on allPhotosForCurrentFetch only.
            if (currentPhoto && handlePhotoRemovalNavigationBulk) {
                handlePhotoRemovalNavigationBulk(deletedPaths);
            } else if (allPhotosForCurrentFetch && setAllPhotosForCurrentFetch) {
                const updatedPhotos = allPhotosForCurrentFetch.filter(
                    photo => !deletedPaths.includes(photo.originalPath)
                );
                setAllPhotosForCurrentFetch(updatedPhotos);
            }

            // Clear selection if requested
            if (clearSelection && photoSelection && clearPhotoSelection) {
                clearPhotoSelection();
            }

            try {
                // Use batch command for efficient date_summary update
                logger.debug('useTrashOperations', 'move_to_trash_batch_call', 'Calling move_to_trash_batch');
                const resultStr = await invoke("move_to_trash_batch", { paths: deletedPaths });
                const result = JSON.parse(resultStr);
                logger.debug('useTrashOperations', 'move_to_trash_batch_result', 'Batch result received', { result });

                // Update date counts locally
                if (result.date_changes && dateNum && updateDateNum && dateList && updateDateList) {
                    logger.debug('useTrashOperations', 'updating_date_counts', 'Updating date counts', {
                        dateChanges: result.date_changes,
                        currentDateNumKeys: Object.keys(dateNum).length,
                        currentDateListLength: dateList.length
                    });

                    const updatedDateNum = { ...dateNum };

                    for (const [date, delta] of Object.entries(result.date_changes)) {
                        updatedDateNum[date] = (updatedDateNum[date] || 0) + delta;

                        if (updatedDateNum[date] <= 0) {
                            delete updatedDateNum[date];
                        }
                    }

                    logger.debug('useTrashOperations', 'new_date_num', 'New dateNum calculated', { updatedDateNumKeys: Object.keys(updatedDateNum).length });
                    updateDateNum(updatedDateNum);
                    updateDateList([...dateList]); // Trigger re-render with new reference
                    logger.debug('useTrashOperations', 'date_update_completed', 'Date update calls completed');

                    logger.info('useTrashOperations', 'delete_photos_date_updated', 'Updated date counts after delete', {
                        changedDates: Object.keys(result.date_changes).length,
                        dateChanges: result.date_changes
                    });
                } else {
                    logger.debug('useTrashOperations', 'skipping_date_update', 'Skipping date update', {
                        hasDateChanges: !!result.date_changes,
                        hasDateNum: !!dateNum,
                        hasUpdateDateNum: !!updateDateNum,
                        hasDateList: !!dateList,
                        hasUpdateDateList: !!updateDateList
                    });
                }

                // Show result message
                if (result.failed > 0) {
                    addFooterMessage('trash', `${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} moved to trash, ${result.failed} failed`);
                } else {
                    addFooterMessage('trash', `${count} photo${count > 1 ? 's' : ''} moved to trash`);
                }

                logger.info('useTrashOperations', 'delete_photos_success', 'Photos deleted successfully', {
                    photoCount: count,
                    result
                });

                return true;
            } catch (backendError) {
                // Rollback UI changes on backend failure
                logger.error('useTrashOperations', 'delete_photos_backend_failed', 'Backend operation failed, rolling back UI', {
                    photoCount: count,
                    error: backendError.message
                });

                if (photosBackup && setAllPhotosForCurrentFetch) {
                    setAllPhotosForCurrentFetch(photosBackup);
                }
                if (miniPhotosBackup && setPhotosListMiniAllPhotos) {
                    setPhotosListMiniAllPhotos(miniPhotosBackup);
                }
                if (setPhotosListMiniCurrentIndex && miniIndexBackup !== undefined) {
                    setPhotosListMiniCurrentIndex(miniIndexBackup);
                }
                if (setCurrentPhotoIndex && currentIndexBackup !== undefined) {
                    setCurrentPhotoIndex(currentIndexBackup);
                }
                if (setCurrentPhoto && currentPhotoBackup) {
                    setCurrentPhoto(currentPhotoBackup);
                }
                addFooterMessage('trash', 'Delete operation failed. Reloading...');

                // Reload to ensure UI matches database state
                if (reloadCurrentModeData) {
                    await reloadCurrentModeData();
                }

                throw backendError;
            }
        } catch (error) {
            logger.error('useTrashOperations', 'delete_photos_failed', 'Failed to delete photos', {
                photoCount: count,
                error: error.message
            });
            handleError(error, 'Move to trash');
            return false;
        }
    }, [
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        photoSelection,
        clearPhotoSelection,
        dateNum,
        updateDateNum,
        dateList,
        updateDateList,
        reloadCurrentModeData,
        handleError,
        addFooterMessage,
        currentPhoto,
        setCurrentPhoto,
        currentPhotoIndex,
        setCurrentPhotoIndex,
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        handlePhotoRemovalNavigationBulk
    ]);

    /**
     * Generic handler to restore photos with date count updates
     * @param {string[]} paths - Array of photo paths to restore
     * @param {Object} options - Options for restoration behavior
     * @param {boolean} options.skipConfirmation - Skip confirmation dialog
     * @param {boolean} options.clearSelection - Clear photo selection after restore
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const restorePhotos = useCallback(async (paths, { skipConfirmation = false, clearSelection = true } = {}) => {
        if (!paths || paths.length === 0) {
            addFooterMessage('trash', 'No photos to restore');
            return false;
        }

        const count = paths.length;

        try {
            logger.info('useTrashOperations', 'restore_photos_start', 'Restoring photos from trash', {
                photoCount: count,
                skipConfirmation,
                clearSelection
            });

            // Save paths before clearing selection
            const restoredPaths = [...paths];

            // Clear selection if requested
            if (clearSelection && photoSelection && clearPhotoSelection) {
                clearPhotoSelection();
            }

            // Optimistic UI update - remove from trash view
            if (updatePhotosAfterTrashOperation) {
                await updatePhotosAfterTrashOperation(restoredPaths, 'restore');
            }

            try {
                // Use batch command for efficient date_summary update
                const resultStr = await invoke("restore_from_trash_batch", { paths: restoredPaths });
                const result = JSON.parse(resultStr);

                // Update date counts locally
                if (result.date_changes && dateNum && updateDateNum && dateList && updateDateList) {
                    const updatedDateNum = { ...dateNum };

                    for (const [date, delta] of Object.entries(result.date_changes)) {
                        updatedDateNum[date] = (updatedDateNum[date] || 0) + delta;

                        if (updatedDateNum[date] <= 0) {
                            delete updatedDateNum[date];
                        }
                    }

                    updateDateNum(updatedDateNum);
                    updateDateList([...dateList]); // Trigger re-render with new reference

                    logger.info('useTrashOperations', 'restore_photos_date_updated', 'Updated date counts after restore', {
                        changedDates: Object.keys(result.date_changes).length,
                        dateChanges: result.date_changes
                    });
                }

                // Show result message
                if (result.failed > 0) {
                    addFooterMessage('trash', `${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} restored, ${result.failed} failed`);
                } else {
                    addFooterMessage('trash', `${count} photo${count > 1 ? 's' : ''} restored successfully`);
                }

                logger.info('useTrashOperations', 'restore_photos_success', 'Photos restored successfully', {
                    photoCount: count,
                    result
                });

                return true;
            } catch (backendError) {
                // Rollback UI changes on backend failure
                logger.error('useTrashOperations', 'restore_photos_backend_failed', 'Backend operation failed, reloading trash view', {
                    photoCount: count,
                    error: backendError.message
                });

                addFooterMessage('trash', 'Restore operation failed. Reloading...');

                // Reload trash view to restore UI state
                if (reloadCurrentModeData) {
                    await reloadCurrentModeData();
                }

                throw backendError;
            }
        } catch (error) {
            logger.error('useTrashOperations', 'restore_photos_failed', 'Failed to restore photos from trash', {
                photoCount: count,
                error: error.message
            });
            handleError(error, 'Restore from trash');
            return false;
        }
    }, [
        photoSelection,
        clearPhotoSelection,
        updatePhotosAfterTrashOperation,
        dateNum,
        updateDateNum,
        dateList,
        updateDateList,
        reloadCurrentModeData,
        handleError,
        addFooterMessage
    ]);

    return {
        deletePhotos,
        restorePhotos
    };
}
