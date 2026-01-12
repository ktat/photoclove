/**
 * Photo operations for DirectoryMenu
 * Handles import, upload, delete, and restore operations
 */
import { useCallback, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import { localForage } from "../../../storage/forage";
import { logger } from "../../../services/LoggerService.js";
import { invokeWithErrorHandling } from "../../../services/TauriService.js";

/**
 * Hook for photo import operations
 */
export function usePhotoImport({ importState, photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError }) {
    const importSelectedPhotos = useCallback(async () => {
        if (!importState || photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return;
        }

        const count = photoSelection.length;
        const confirmed = await confirm(
            `Import ${count} photo${count > 1 ? 's' : ''} to your library?`,
            "Confirm Import"
        );

        if (confirmed) {
            try {
                logger.info('photoOperations', 'import_photos_start', 'Starting photo import', {
                    photoCount: count,
                    currentPath: importState.currentImportPath
                });

                await importState.importPhotos(photoSelection);

                clearPhotoSelection();
                addFooterMessage(`${count} photo${count > 1 ? 's' : ''} imported successfully`);

                logger.info('photoOperations', 'photos_imported', 'Photos imported successfully', {
                    photoCount: count
                });
            } catch (error) {
                logger.error('photoOperations', 'import_photos_failed', 'Failed to import photos', {
                    photoCount: count,
                    error: error.message
                });
                handleTauriError(error, 'Import photos');
            }
        }
    }, [importState, photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError]);

    return { importSelectedPhotos };
}

/**
 * Hook for Google Photos upload operations
 */
export function useGooglePhotosUpload({ photoSelection, clearPhotoSelection, addFooterMessage, setShowJobQueue }) {
    const lockUploadRef = useRef(false);

    const uploadToGooglePhotos = useCallback(async () => {
        if (lockUploadRef.current) {
            message("Currently uploading. Please wait for the current upload to complete.", "Upload in Progress");
            return;
        }

        const files = photoSelection;
        const BATCH_SIZE = 50;
        const numBatches = Math.ceil(files.length / BATCH_SIZE);

        let answer = true;
        if (files.length > BATCH_SIZE) {
            answer = await confirm(
                `Upload ${files.length} photos to Google Photos?\n` +
                `This will create ${numBatches} upload jobs (max ${BATCH_SIZE} photos per job).`,
                "Confirm Upload"
            );
        } else {
            answer = await confirm(
                `Upload ${files.length} photos to Google Photos?`,
                "Confirm Upload"
            );
        }

        if (answer) {
            try {
                const tokens = await localForage.getItem("GoogleOAuthTokens");
                if (!tokens) {
                    message("Please sign in to Google Photos first", "Authentication Required");
                    return;
                }

                lockUploadRef.current = true;

                logger.info('photoOperations', 'google_photos_upload_start', 'User initiated Google Photos upload', {
                    filesCount: files.length,
                    batchesExpected: numBatches
                });

                const jobUnitIds = await invoke("upload_to_google_photos", {
                    selectedFiles: files,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken
                });

                clearPhotoSelection();
                lockUploadRef.current = false;

                message(
                    `Created ${jobUnitIds.length} upload job${jobUnitIds.length > 1 ? 's' : ''}. ` +
                    `Check Job Queue for progress.`,
                    "Upload Started"
                );

                logger.info('photoOperations', 'google_photos_jobs_created', 'Google Photos upload jobs created', {
                    jobUnitsCreated: jobUnitIds.length,
                    jobUnitIds: jobUnitIds
                });

                setShowJobQueue?.(true);

            } catch (e) {
                lockUploadRef.current = false;
                logger.error('photoOperations', 'google_photos_upload_error', 'Failed to start Google Photos upload', {
                    error: e.toString(),
                    filesCount: files.length
                });
                message("Failed to start upload: " + e.toString(), "Upload Error");
            }
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, setShowJobQueue]);

    return { uploadToGooglePhotos };
}

/**
 * Hook for trash operations (delete, restore, permanent delete)
 */
export function useTrashOperations({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    handleTauriError,
    deletePhotos,
    restorePhotos,
    updatePhotosAfterTrashOperation,
    reloadCurrentModeData,
    setDeleteModalConfig,
    setShowDeleteModal
}) {
    const lockDeleteRef = useRef(false);

    const deleteFiles = useCallback(async () => {
        if (lockDeleteRef.current) return false;

        if (!photoSelection || photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return false;
        }

        const count = photoSelection.length;

        setDeleteModalConfig({
            operation: 'moveToTrash',
            count: count,
            onConfirm: async () => {
                setShowDeleteModal(false);

                try {
                    lockDeleteRef.current = true;

                    const result = await deletePhotos(photoSelection, {
                        skipConfirmation: true,
                        clearSelection: true
                    });

                    return result;
                } finally {
                    lockDeleteRef.current = false;
                }
            }
        });
        setShowDeleteModal(true);
        return false;
    }, [photoSelection, addFooterMessage, deletePhotos, setDeleteModalConfig, setShowDeleteModal]);

    const restoreSelectedFromTrash = useCallback(async () => {
        if (!photoSelection || photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return false;
        }

        const count = photoSelection.length;

        setDeleteModalConfig({
            operation: 'restoreFromTrash',
            count: count,
            onConfirm: async () => {
                setShowDeleteModal(false);

                const result = await restorePhotos(photoSelection, {
                    skipConfirmation: true,
                    clearSelection: true
                });

                return result;
            }
        });
        setShowDeleteModal(true);
        return false;
    }, [photoSelection, addFooterMessage, restorePhotos, setDeleteModalConfig, setShowDeleteModal]);

    const permanentDeleteSelected = useCallback(async () => {
        if (photoSelection.length === 0) {
            addFooterMessage('Please select photos first');
            return;
        }

        const count = photoSelection.length;

        setDeleteModalConfig({
            operation: 'permanentDelete',
            count: count,
            onConfirm: async () => {
                setShowDeleteModal(false);

                try {
                    logger.info('photoOperations', 'permanent_delete_start', 'Permanently deleting photos', {
                        photoCount: count
                    });

                    const deletedPaths = [...photoSelection];

                    clearPhotoSelection();
                    if (updatePhotosAfterTrashOperation) {
                        await updatePhotosAfterTrashOperation(deletedPaths, 'permanentDelete');
                    }

                    try {
                        const result = await invokeWithErrorHandling(
                            "delete_permanently_batch",
                            { paths: deletedPaths },
                            'photoOperations',
                            { parseJson: true }
                        );

                        if (result.failed > 0) {
                            addFooterMessage(`${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} permanently deleted, ${result.failed} failed`);
                        } else {
                            addFooterMessage(`${count} photo${count > 1 ? 's' : ''} permanently deleted`);
                        }
                    } catch (backendError) {
                        addFooterMessage('Permanent delete operation failed. Reloading...');

                        if (reloadCurrentModeData) {
                            await reloadCurrentModeData();
                        }

                        throw backendError;
                    }
                } catch (error) {
                    logger.error('photoOperations', 'permanent_delete_failed', 'Failed to permanently delete photos', {
                        photoCount: count,
                        error: error.message
                    });
                    handleTauriError(error, 'Permanently delete photos');
                }
            }
        });
        setShowDeleteModal(true);
    }, [
        photoSelection,
        clearPhotoSelection,
        addFooterMessage,
        handleTauriError,
        updatePhotosAfterTrashOperation,
        reloadCurrentModeData,
        setDeleteModalConfig,
        setShowDeleteModal
    ]);

    return {
        deleteFiles,
        restoreSelectedFromTrash,
        permanentDeleteSelected
    };
}
