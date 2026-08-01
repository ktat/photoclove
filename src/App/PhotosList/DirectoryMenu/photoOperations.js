/**
 * Photo operations for DirectoryMenu
 * Handles import, upload, delete, and restore operations
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from "@tauri-apps/api/core";
import { localForage } from "../../../storage/forage";
import { logger } from "../../../services/LoggerService.js";
import { invokeWithErrorHandling } from "../../../services/TauriService.js";
import { mergeVideos } from "../../../services/VideoService.js";
import { isVideoPath } from "../../../utils/videoFormats.js";
import { toMergePayload, MIN_MERGE_CLIPS } from "../../VideoEditor/trimUtils.js";

/**
 * Hook for photo import operations
 */
export function usePhotoImport({ importState, photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, dialog }) {
    const importSelectedPhotos = useCallback(async () => {
        if (!importState || photoSelection.length === 0) {
            addFooterMessage('import', 'Please select photos first');
            return;
        }

        const count = photoSelection.length;
        const confirmed = await dialog.confirm({
            title: 'Confirm Import',
            message: `Import ${count} photo${count > 1 ? 's' : ''} to your library?`,
            confirmText: 'Import',
            kind: 'info',
        });

        if (confirmed) {
            try {
                logger.info('photoOperations', 'import_photos_start', 'Starting photo import', {
                    photoCount: count,
                    currentPath: importState.currentImportPath
                });

                await importState.importPhotos(photoSelection);

                clearPhotoSelection();
                addFooterMessage('import', `${count} photo${count > 1 ? 's' : ''} imported successfully`);

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
    }, [importState, photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError, dialog]);

    return { importSelectedPhotos };
}

/**
 * Hook for Google Photos upload operations
 */
export function useGooglePhotosUpload({ photoSelection, clearPhotoSelection, addFooterMessage, setShowJobQueue, dialog }) {
    const lockUploadRef = useRef(false);

    const uploadToGooglePhotos = useCallback(async () => {
        if (lockUploadRef.current) {
            await dialog.message({ title: 'Upload in Progress', message: 'Currently uploading. Please wait for the current upload to complete.', kind: 'warning' });
            return;
        }

        const files = photoSelection;
        const BATCH_SIZE = 50;
        const numBatches = Math.ceil(files.length / BATCH_SIZE);

        let msg = `Upload ${files.length} photos to Google Photos?`;
        if (files.length > BATCH_SIZE) {
            msg += `\nThis will create ${numBatches} upload jobs (max ${BATCH_SIZE} photos per job).`;
        }
        const answer = await dialog.confirm({ title: 'Confirm Upload', message: msg, confirmText: 'Upload', kind: 'info' });

        if (answer) {
            try {
                const tokens = await localForage.getItem("GoogleOAuthTokens");
                if (!tokens) {
                    await dialog.message({ title: 'Authentication Required', message: 'Please sign in to Google Photos first', kind: 'warning' });
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

                await dialog.message({
                    title: 'Upload Started',
                    message: `Created ${jobUnitIds.length} upload job${jobUnitIds.length > 1 ? 's' : ''}. Check Job Queue for progress.`,
                    kind: 'success',
                });

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
                await dialog.message({ title: 'Upload Error', message: 'Failed to start upload: ' + e.toString(), kind: 'error' });
            }
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, setShowJobQueue, dialog]);

    return { uploadToGooglePhotos };
}

/**
 * Hook for merging the selected videos into a single file.
 *
 * Opens the trim editor first: the merge itself is a queued job, so everything
 * the user has to decide (order, in/out points) is settled before submitting.
 */
export function useVideoMerge({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    resolveAbsolutePath,
    setShowJobQueue,
    dialog
}) {
    const { t } = useTranslation(['directoryMenu']);
    const [showVideoMergeModal, setShowVideoMergeModal] = useState(false);

    // Non-videos in the selection are simply not candidates, so they are
    // dropped rather than treated as an error the user has to undo.
    const selectedVideoPaths = useMemo(
        () => (photoSelection || []).filter(isVideoPath).map(resolveAbsolutePath),
        [photoSelection, resolveAbsolutePath]
    );

    const showVideoMergeEditor = useCallback(async () => {
        if (selectedVideoPaths.length < MIN_MERGE_CLIPS) {
            await dialog.message({
                title: t('directoryMenu:videoMerge.title'),
                message: t('directoryMenu:videoMerge.needMoreClips', { count: MIN_MERGE_CLIPS }),
                kind: 'warning'
            });
            return;
        }
        logger.info('photoOperations', 'video_merge_editor_open', 'Opening video merge editor', {
            videoCount: selectedVideoPaths.length
        });
        setShowVideoMergeModal(true);
    }, [selectedVideoPaths, dialog, t]);

    const submitVideoMerge = useCallback(async (clips) => {
        const jobUnitId = await mergeVideos(toMergePayload(clips));

        setShowVideoMergeModal(false);
        clearPhotoSelection();
        addFooterMessage('video_merge', t('directoryMenu:videoMerge.started'));
        setShowJobQueue?.(true);

        logger.info('photoOperations', 'video_merge_submitted', 'Video merge job created', {
            jobUnitId,
            clipCount: clips.length
        });
    }, [clearPhotoSelection, addFooterMessage, setShowJobQueue, t]);

    return {
        showVideoMergeModal,
        setShowVideoMergeModal,
        selectedVideoPaths,
        showVideoMergeEditor,
        submitVideoMerge
    };
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
            addFooterMessage('photo_op', 'Please select photos first');
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
            addFooterMessage('photo_op', 'Please select photos first');
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
            addFooterMessage('photo_op', 'Please select photos first');
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
                            addFooterMessage('photo_op', `${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} permanently deleted, ${result.failed} failed`);
                        } else {
                            addFooterMessage('photo_op', `${count} photo${count > 1 ? 's' : ''} permanently deleted`);
                        }
                    } catch (backendError) {
                        addFooterMessage('photo_op', 'Permanent delete operation failed. Reloading...');

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

/**
 * Hook for startup image operations
 * Adds selected photos to the startup image list in config
 */
export function useStartupImageOperations({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    config,
    saveConfigWithStartupImages
}) {
    const addToStartupImages = useCallback(async () => {
        if (!photoSelection || photoSelection.length === 0) {
            addFooterMessage('startupImages', 'Please select photos first');
            return;
        }

        // Filter to only include image files (not videos)
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
        const imagePhotos = photoSelection.filter(path => {
            const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
            return imageExtensions.includes(ext);
        });

        if (imagePhotos.length === 0) {
            addFooterMessage('startupImages', 'No image files selected (videos are not supported for startup images)');
            return;
        }

        // Get existing startup images or create default structure
        const currentStartupImages = config?.startup_images || { mode: 'default', images: [] };
        const existingPaths = new Set((currentStartupImages.images || []).map(img => img.path));

        // Create new startup image entries for photos not already in the list
        const newImages = imagePhotos
            .filter(path => !existingPaths.has(path))
            .map(path => {
                // Extract date from path (assumes format like .../YYYY/MM/DD/...)
                const dateMatch = path.match(/(\d{4})\/(\d{2})\/(\d{2})/);
                const photoDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

                return {
                    path: path,
                    enabled: true,
                    photo_date: photoDate
                };
            });

        if (newImages.length === 0) {
            addFooterMessage('startupImages', 'Selected photos are already in startup images');
            return;
        }

        // Merge with existing images
        const updatedImages = [...(currentStartupImages.images || []), ...newImages];

        // Update config with new startup images
        const updatedStartupImages = {
            mode: 'custom', // Automatically switch to custom mode when adding images
            images: updatedImages
        };

        try {
            await saveConfigWithStartupImages(updatedStartupImages);

            clearPhotoSelection();

            const addedCount = newImages.length;
            const skippedCount = imagePhotos.length - addedCount;
            let msg = `${addedCount} photo${addedCount !== 1 ? 's' : ''} added to startup images`;
            if (skippedCount > 0) {
                msg += ` (${skippedCount} already existed)`;
            }
            addFooterMessage('startupImages', msg, false, 3000);

            logger.info('photoOperations', 'startup_images_added', 'Photos added to startup images', {
                addedCount,
                skippedCount,
                totalImages: updatedImages.length
            });
        } catch (error) {
            logger.error('photoOperations', 'startup_images_add_failed', 'Failed to add photos to startup images', {
                error: error.message
            });
            addFooterMessage('startupImages', 'Failed to add photos to startup images');
        }
    }, [photoSelection, clearPhotoSelection, addFooterMessage, config, saveConfigWithStartupImages]);

    return { addToStartupImages };
}
