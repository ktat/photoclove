import React, { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import { emit } from "@tauri-apps/api/event";
import { localForage } from "../../storage/forage";
import { logger } from "../../services/LoggerService.js";
import { UnifiedPhotoCollection } from "../../domain/UnifiedPhotoCollection.js";
import { useUI } from "../../context/UIContext.jsx";
import { useError } from "../../context/ErrorContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";
import { useTutorial } from "../../hooks/useTutorial.js";
import AlbumCreationModal from "../../components/AlbumCreationModal.jsx";
import AlbumSelectorModal from "../../components/AlbumSelectorModal.jsx";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";
import Scrollable from "../../Scrollable.jsx";

function DirectoryMenu(props) {
    const { handleTauriError } = useError();

    const [photoIndex, setPhotoIndex] = useState(-1);
    const [showBigPhoto, setShowBigPhoto] = useState(false);
    const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
    const [showAlbumSelectorModal, setShowAlbumSelectorModal] = useState(false);
    
    // Tutorial state
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialContent, setTutorialContent] = useState('');
    const dropdownRef = useRef(null);
    
    // Use ViewMode value object methods instead of const checks
    // Assumes props.viewModeObj is passed from parent component
    
    // Tutorial hooks
    const {
        shouldShowTutorial,
        markTutorialShown,
        dismissTutorial,
        disableTutorial
    } = useTutorial();
    

    useEffect(() => {
        let l = props.photoSelection.length;
        setPhotoIndex(l - 1)
    }, [props.photoSelection])

    // Tutorial trigger effect
    useEffect(() => {
        if (props.photoSelection.length > 0) {
            const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
            
            if (shouldShowTutorial('selectionTutorial', context)) {
                setTutorialContent(getTutorialContent(context, props.photoSelection.length));
                setShowTutorial(true);
                markTutorialShown('selectionTutorial', context);
                
                logger.info('DirectoryMenu', 'tutorial_triggered', 'Selection tutorial shown', {
                    context,
                    photoCount: props.photoSelection.length
                });
            }
        } else {
            setShowTutorial(false);
        }
    }, [props.photoSelection.length, props.viewModeObj, shouldShowTutorial, markTutorialShown]);

    // Generate tutorial content based on context
    const getTutorialContent = (context, photoCount) => {
        const photoText = `${photoCount} photo${photoCount !== 1 ? 's' : ''}`;
        
        if (context === 'albumMode') {
            return (
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        💡 Selected {photoText} from this album
                    </div>
                    <div>You can now:</div>
                    <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                        <li>📚 Create Album - Make a new album</li>
                        <li>📚 Add to Album - Add to a different album</li>
                        <li>❌ Remove from Album - Remove from current album</li>
                        <li>⬆️ Upload to Google Photos - Sync with Google</li>
                        <li>🗑️ Delete Files - Permanently remove files</li>
                    </ul>
                </div>
            );
        } else {
            return (
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        💡 Selected {photoText}
                    </div>
                    <div>You can now:</div>
                    <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                        <li>📚 Create Album - Make a new album</li>
                        <li>📚 Add to Album - Add to existing album</li>
                        <li>⬆️ Upload to Google Photos - Sync with Google</li>
                        <li>🗑️ Delete Files - Permanently remove files</li>
                    </ul>
                </div>
            );
        }
    };

    // Tutorial event handlers
    const handleTutorialDismiss = () => {
        setShowTutorial(false);
        const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
        dismissTutorial('selectionTutorial', context);
        
        logger.info('DirectoryMenu', 'tutorial_dismissed', 'User dismissed selection tutorial', { context });
    };

    const handleTutorialDisable = () => {
        setShowTutorial(false);
        const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
        disableTutorial('selectionTutorial', context);
        
        logger.info('DirectoryMenu', 'tutorial_disabled', 'User disabled selection tutorial', { context });
    };

    let lock = false;
    let lockThumbnail = false;
    let lockUpload = false;
    let lockDelete = false;
    

    function doOperation(e) {
        const selected = e.target.value;
        if (selected == "uploadToGooglePhotos") {
            uploadToGooglePhotos()
        } else if (selected == "deleteFiles") {
            deleteFiles();
        } else if (selected == "removeFromAlbum") {
            removeFromCurrentAlbum();
        } else if (selected == "createAlbum") {
            showCreateAlbumModal();
        } else if (selected == "addToAlbum") {
            showAddToAlbumModal();
        } else if (selected == "importSelected") {
            importSelectedPhotos();
        } else if (selected == "selectAllInDirectory") {
            props.selectAllPhotosInDirectory?.();
        } else if (selected == "unselectAll") {
            props.clearPhotoSelection();
        } else if (selected == "restoreFromTrash") {
            restoreSelectedFromTrash();
        } else if (selected == "permanentDelete") {
            permanentDeleteSelected();
        }
        e.target.value = "";
    }

    async function importSelectedPhotos() {
        if (!props.importState || props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }

        const count = props.photoSelection.length;
        const confirmed = await confirm(
            `Import ${count} photo${count > 1 ? 's' : ''} to your library?`,
            "Confirm Import"
        );

        if (confirmed) {
            try {
                logger.info('DirectoryMenu', 'import_photos_start', 'Starting photo import', {
                    photoCount: count,
                    currentPath: props.importState.currentImportPath
                });

                // Use ImportState to handle import
                await props.importState.importPhotos(props.photoSelection);
                
                props.clearPhotoSelection();
                props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} imported successfully`);
                
                logger.info('DirectoryMenu', 'photos_imported', 'Photos imported successfully', {
                    photoCount: count
                });
            } catch (error) {
                logger.error('DirectoryMenu', 'import_photos_failed', 'Failed to import photos', {
                    photoCount: count,
                    error: error.message
                });
                handleTauriError(error, 'Import photos');
            }
        }
    }

    async function createDbInDate() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("create_db_in_date", { dateStr: props.currentDate }).then((r) => {
                        lock = false;
                        let data = JSON.parse(r);
                        props.setCurrentDateNum(data[props.currentDate.replace(/\//g, "-")]);
                    })
                }
            });
        }
    }

    async function movePhotosToExifDate() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("move_photos_to_exif_date", { dateStr: props.currentDate }).then(() => {
                        lock = false;
                    })
                }
            });
        }
    }

    async function createThumbnails() {
        if (lockThumbnail) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lockThumbnail = true;
                    invoke("create_thumbnails_in_date", { dateStr: props.currentDate }).then((r) => {
                        lockThumbnail = false;
                    })
                }
            });
        }
    }


    async function uploadToGooglePhotos() {
        if (lockUpload) {
            message("Currently uploading. Please wait for the current upload to complete.", "Upload in Progress");
            return;
        }
        
        const files = props.photoSelection;
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
                
                lockUpload = true;
                
                logger.info('DirectoryMenu', 'google_photos_upload_start', 'User initiated Google Photos upload', {
                    filesCount: files.length,
                    batchesExpected: numBatches
                });
                
                const jobUnitIds = await invoke("upload_to_google_photos", {
                    selectedFiles: files,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken
                });
                
                props.clearPhotoSelection();
                lockUpload = false;
                
                message(
                    `Created ${jobUnitIds.length} upload job${jobUnitIds.length > 1 ? 's' : ''}. ` +
                    `Check Job Queue for progress.`,
                    "Upload Started"
                );
                
                logger.info('DirectoryMenu', 'google_photos_jobs_created', 'Google Photos upload jobs created', {
                    jobUnitsCreated: jobUnitIds.length,
                    jobUnitIds: jobUnitIds
                });
                
                // Show job queue to display progress
                props.setShowJobQueue(true);
                
            } catch (e) {
                lockUpload = false;
                logger.error('DirectoryMenu', 'google_photos_upload_error', 'Failed to start Google Photos upload', {
                    error: e.toString(),
                    filesCount: files.length
                });
                message("Failed to start upload: " + e.toString(), "Upload Error");
            }
        }
    }

    /**
     * Apply date count changes from batch operation result to local state
     * @param {Object} dateChanges - Map of date -> count delta from backend
     */
    function applyDateChanges(dateChanges) {
        if (!props.dateNum || !props.setDateNum || !dateChanges) {
            return;
        }

        const updatedDateNum = { ...props.dateNum };

        for (const [date, delta] of Object.entries(dateChanges)) {
            updatedDateNum[date] = (updatedDateNum[date] || 0) + delta;

            // Remove date entry if count reaches zero or negative
            if (updatedDateNum[date] <= 0) {
                delete updatedDateNum[date];
            }
        }

        props.setDateNum(updatedDateNum);

        logger.info('DirectoryMenu', 'date_counts_updated', 'Applied date changes from batch operation', {
            changedDates: Object.keys(dateChanges).length,
            dateChanges
        });
    }

    async function deleteFiles() {
        console.log('[DEBUG] deleteFiles called, selection count:', props.photoSelection.length);
        if (lockDelete) return;

        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }

        const count = props.photoSelection.length;
        console.log('[DEBUG] About to show confirmation dialog for', count, 'photos');
        const confirmed = await confirm(
            `Move ${count} photo${count > 1 ? 's' : ''} to trash?`,
            "Move to Trash"
        );

        if (!confirmed) return;

        try {
            lockDelete = true;

            logger.info('DirectoryMenu', 'move_to_trash_batch_start', 'Moving photos to trash', {
                photoCount: count
            });

            // Backup current state for rollback on failure
            const deletedPaths = [...props.photoSelection]; // Save before clearing
            const photosBackup = props.allPhotosForCurrentFetch ? [...props.allPhotosForCurrentFetch] : null;

            // Optimistic UI update - remove deleted photos from view
            if (props.allPhotosForCurrentFetch && props.setAllPhotosForCurrentFetch) {
                const updatedPhotos = props.allPhotosForCurrentFetch.filter(
                    photo => !deletedPaths.includes(photo.originalPath)
                );
                props.setAllPhotosForCurrentFetch(updatedPhotos);
            }
            props.clearPhotoSelection();

            try {
                // Use batch command for efficient date_summary update
                console.log('[DEBUG] Calling move_to_trash_batch for', deletedPaths.length, 'photos');
                const resultStr = await invoke("move_to_trash_batch", { paths: deletedPaths });
                const result = JSON.parse(resultStr);
                console.log('[DEBUG] move_to_trash_batch result:', result);

                // Apply date changes locally instead of refetching
                if (result.date_changes) {
                    applyDateChanges(result.date_changes);
                }

                // Show result message with failure info if any
                if (result.failed > 0) {
                    props.addFooterMessage(`${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} moved to trash, ${result.failed} failed`);
                } else {
                    props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} moved to trash`);
                }

                logger.info('DirectoryMenu', 'photos_moved_to_trash', 'Photos moved to trash successfully', {
                    photoCount: count,
                    result
                });
            } catch (backendError) {
                // Rollback UI changes on backend failure
                logger.error('DirectoryMenu', 'move_to_trash_backend_failed', 'Backend operation failed, rolling back UI', {
                    photoCount: count,
                    error: backendError.message
                });

                if (photosBackup && props.setAllPhotosForCurrentFetch) {
                    props.setAllPhotosForCurrentFetch(photosBackup);
                }
                props.addFooterMessage('Delete operation failed. Reloading...');

                // Reload to ensure UI matches database state
                if (props.reloadCurrentModeData) {
                    await props.reloadCurrentModeData();
                }

                throw backendError; // Re-throw for outer catch
            }
        } catch (error) {
            logger.error('DirectoryMenu', 'move_to_trash_failed', 'Failed to move photos to trash', {
                photoCount: count,
                error: error.message
            });
            handleTauriError(error, 'Move to trash');
        } finally {
            lockDelete = false;
        }
    }

    // Trash operation functions
    async function restoreSelectedFromTrash() {
        console.log('[DEBUG] restoreSelectedFromTrash called, selection count:', props.photoSelection.length);
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }

        const count = props.photoSelection.length;
        const confirmed = await confirm(
            `Restore ${count} photo${count > 1 ? 's' : ''} from trash to ${count > 1 ? 'their' : 'its'} original location?`,
            "Restore from Trash"
        );

        if (confirmed) {
            try {
                logger.info('DirectoryMenu', 'restore_from_trash_start', 'Restoring photos from trash', {
                    photoCount: count
                });

                // Save paths before clearing selection
                const restoredPaths = [...props.photoSelection];

                // Optimistic UI update - remove from trash view
                props.clearPhotoSelection();
                if (props.updatePhotosAfterTrashOperation) {
                    await props.updatePhotosAfterTrashOperation(restoredPaths, 'restore');
                }

                try {
                    // Use batch command for efficient date_summary update
                    console.log('[DEBUG] Calling restore_from_trash_batch for', restoredPaths.length, 'photos');
                    const resultStr = await invoke("restore_from_trash_batch", { paths: restoredPaths });
                    const result = JSON.parse(resultStr);
                    console.log('[DEBUG] restore_from_trash_batch result:', result);

                    // Apply date changes locally instead of refetching
                    if (result.date_changes) {
                        applyDateChanges(result.date_changes);
                    }

                    // Show result message with failure info if any
                    if (result.failed > 0) {
                        props.addFooterMessage(`${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} restored, ${result.failed} failed`);
                    } else {
                        props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} restored successfully`);
                    }

                    logger.info('DirectoryMenu', 'photos_restored', 'Photos restored from trash successfully', {
                        photoCount: count,
                        result
                    });
                } catch (backendError) {
                    // Rollback UI changes on backend failure
                    logger.error('DirectoryMenu', 'restore_backend_failed', 'Backend operation failed, reloading trash view', {
                        photoCount: count,
                        error: backendError.message
                    });

                    props.addFooterMessage('Restore operation failed. Reloading...');

                    // Reload trash view to restore UI state
                    if (props.reloadCurrentModeData) {
                        await props.reloadCurrentModeData();
                    }

                    throw backendError; // Re-throw for outer catch
                }
            } catch (error) {
                logger.error('DirectoryMenu', 'restore_failed', 'Failed to restore photos from trash', {
                    photoCount: count,
                    error: error.message
                });
                handleTauriError(error, 'Restore from trash');
            }
        }
    }

    async function permanentDeleteSelected() {
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }

        const count = props.photoSelection.length;
        const confirmed = await confirm(
            `⚠️ PERMANENTLY DELETE ${count} photo${count > 1 ? 's' : ''}?\n\nThis action CANNOT be undone!\n\nFiles will be completely removed from your system.`,
            "⚠️ Permanent Delete"
        );

        if (confirmed) {
            try {
                logger.info('DirectoryMenu', 'permanent_delete_start', 'Permanently deleting photos', {
                    photoCount: count
                });

                // Save paths before clearing selection
                const deletedPaths = [...props.photoSelection];

                // Optimistic UI update - remove from trash view
                props.clearPhotoSelection();
                if (props.updatePhotosAfterTrashOperation) {
                    await props.updatePhotosAfterTrashOperation(deletedPaths, 'permanentDelete');
                }

                try {
                    // Use batch command for efficient processing
                    const resultStr = await invoke("delete_permanently_batch", { paths: deletedPaths });
                    const result = JSON.parse(resultStr);

                    // Show result message with failure info if any
                    if (result.failed > 0) {
                        props.addFooterMessage(`${result.succeeded} photo${result.succeeded !== 1 ? 's' : ''} permanently deleted, ${result.failed} failed`);
                    } else {
                        props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} permanently deleted`);
                    }

                    logger.info('DirectoryMenu', 'photos_permanently_deleted', 'Photos permanently deleted successfully', {
                        photoCount: count,
                        result
                    });
                } catch (backendError) {
                    // Rollback UI changes on backend failure
                    logger.error('DirectoryMenu', 'permanent_delete_backend_failed', 'Backend operation failed, reloading trash view', {
                        photoCount: count,
                        error: backendError.message
                    });

                    props.addFooterMessage('Permanent delete operation failed. Reloading...');

                    // Reload trash view to restore UI state
                    if (props.reloadCurrentModeData) {
                        await props.reloadCurrentModeData();
                    }

                    throw backendError; // Re-throw for outer catch
                }
            } catch (error) {
                logger.error('DirectoryMenu', 'permanent_delete_failed', 'Failed to permanently delete photos', {
                    photoCount: count,
                    error: error.message
                });
                handleTauriError(error, 'Permanently delete photos');
            }
        }
    }

    // Album operation functions
    async function removeFromCurrentAlbum() {
        if (!currentAlbumId || props.photoSelection.length === 0) return;
        
        const count = props.photoSelection.length;
        const confirmed = await confirm(
            `Remove ${count} photo${count > 1 ? 's' : ''} from this album?\n\nPhotos will remain in your library.`,
            "Remove from Album"
        );
        
        if (confirmed) {
            try {
                logger.info('DirectoryMenu', 'remove_from_album_start', 'Removing photos from album', {
                    albumId: currentAlbumId,
                    photoCount: count
                });
                
                for (const photoPath of props.photoSelection) {
                    await invoke("remove_photo_from_album", {
                        albumId: currentAlbumId,
                        photoPath: photoPath
                    });
                }
                
                props.clearPhotoSelection();
                props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} removed from album`);
                props.onPhotosRefresh?.(); // Refresh the album view
                
                logger.info('DirectoryMenu', 'photos_removed_from_album', 'Photos removed from album successfully', {
                    albumId: currentAlbumId,
                    photoCount: count
                });
            } catch (error) {
                logger.error('DirectoryMenu', 'remove_from_album_failed', 'Failed to remove photos from album', {
                    albumId: currentAlbumId,
                    photoCount: count,
                    error: error.message
                });
                handleTauriError(error, 'Remove from album');
            }
        }
    }

    function showCreateAlbumModal() {
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }
        
        logger.debug('DirectoryMenu', 'show_create_album_modal', 'Opening album creation modal', {
            selectedPhotosCount: props.photoSelection.length
        });
        setShowAlbumCreationModal(true);
    }

    function showAddToAlbumModal() {
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }
        
        logger.debug('DirectoryMenu', 'show_add_to_album_modal', 'Opening album selector modal', {
            selectedPhotosCount: props.photoSelection.length
        });
        setShowAlbumSelectorModal(true);
    }

    async function createAlbumFromSelection(albumData) {
        try {
            logger.info('DirectoryMenu', 'create_album_start', 'Creating album from selection using unified collections', {
                albumName: albumData.name,
                photoCount: props.photoSelection.length
            });
            
            const album = await UnifiedPhotoCollection.create('album', {
                name: albumData.name,
                description: albumData.description
            });
            
            // Add all selected photos to the new album
            for (const photoPath of props.photoSelection) {
                await album.addPhoto(photoPath);
            }
            
            // Automatically set the first selected photo as the cover photo
            if (props.photoSelection.length > 0) {
                const firstPhotoPath = props.photoSelection[0];
                logger.info('DirectoryMenu', 'set_cover_photo', 'Setting first photo as album cover using unified collection', {
                    albumId: album.id,
                    coverPhotoPath: firstPhotoPath
                });
                
                await album.update({
                    coverPhotoPath: firstPhotoPath
                });
            }
            
            const photoCount = props.photoSelection.length;
            props.clearPhotoSelection();
            props.addFooterMessage(`Album "${albumData.name}" created with ${photoCount} photos`);
            
            logger.info('DirectoryMenu', 'album_created_from_selection', 'Album created from selected photos', {
                albumName: albumData.name,
                albumId,
                photoCount,
                coverPhotoSet: props.photoSelection.length > 0
            });
            
            setShowAlbumCreationModal(false);
        } catch (error) {
            logger.error('DirectoryMenu', 'create_album_failed', 'Failed to create album from selection', {
                albumName: albumData.name,
                photoCount: props.photoSelection.length,
                error: error.message
            });
            handleTauriError(error, 'Create album');
        }
    }

    async function addPhotosToAlbum(albumId) {
        try {
            logger.info('DirectoryMenu', 'add_to_album_start', 'Adding photos to existing album', {
                albumId,
                photoCount: props.photoSelection.length
            });
            
            for (const photoPath of props.photoSelection) {
                await invoke("add_photo_to_album", {
                    albumId: albumId,
                    photoPath: photoPath
                });
            }
            
            const photoCount = props.photoSelection.length;
            props.clearPhotoSelection();
            props.addFooterMessage(`${photoCount} photo${photoCount > 1 ? 's' : ''} added to album`);
            
            logger.info('DirectoryMenu', 'photos_added_to_album', 'Photos added to album successfully', {
                albumId,
                photoCount
            });
            
            setShowAlbumSelectorModal(false);
        } catch (error) {
            logger.error('DirectoryMenu', 'add_to_album_failed', 'Failed to add photos to album', {
                albumId,
                photoCount: props.photoSelection.length,
                error: error.message
            });
            handleTauriError(error, 'Add to album');
        }
    }



    return (
        <div id="directory-maintenance">
            {props.searchMode && (
                <div id="tab-search" className={props.tabClass['search'] ? "tab-active" : "tab"}>
                    <div className="search-tools-container">
                        {props.searchTools}
                    </div>
                </div>
            )}
            {/* Maintenance tab - only shown in date mode */}
            {props.viewModeObj?.shouldShowMaintenanceTab() && (
                <div id="tab-maintenance" className={props.tabClass['maintenance'] ? "tab-active" : "tab"}>
                    <ul>
                        <li><a href="#" onClick={() => { createDbInDate() }}>(re)Create database of the date</a></li>
                        <li><a href="#" onClick={() => { movePhotosToExifDate() }}>Move files according to Exif date</a></li>
                        <li><a href="#" onClick={() => { createThumbnails() }}>Make thumbnails</a></li>
                    </ul>
                </div>
            )}
            
            {/* Directory Tab - Import Mode Only */}
            {props.viewModeObj?.shouldShowDirectoryTab() && props.importState && (
                <div 
                    id="tab-directory" 
                    className={props.tabClass['directory'] ? "tab-active" : "tab"}
                    style={{
                        height: 'calc(-10px + 100vh)',
                        overflowY: 'hidden'
                    }}
                >
                    {/* Import paths dropdown */}
                    <div style={{ marginBottom: '10px' }}>
                        <label><strong>Import Photos From</strong>: </label>
                        <select 
                            value={props.importState.currentImportPath || ''} 
                            onChange={(e) => props.importState.changeDirectory(e.target.value)}
                            style={{ 
                                width: '100%', 
                                maxWidth: '200px',
                                padding: '4px',
                                marginTop: '4px'
                            }}
                        >
                            <option value="">Select import source...</option>
                            {props.importState.importPaths?.map((p, i) => (
                                <option key={i} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Current directory - show only if different from root paths */}
                    {props.importState.currentImportPath && 
                     !props.importState.importPaths?.includes(props.importState.currentImportPath) && (
                        <p style={{ 
                            fontSize: '0.9em', 
                            color: '#888', 
                            marginBottom: '10px',
                            fontStyle: 'italic'
                        }}>
                            Currently browsing: {props.importState.currentImportPath}
                        </p>
                    )}
                    
                    {/* Date filter - integrated with directory selection */}
                    <div style={{ marginBottom: '10px' }}>
                        <label>Created Date: after </label>
                        <input 
                            type="date" 
                            value={props.importState.importFilter || ''} 
                            onChange={(e) => props.importState.updateImportFilter(e.target.value)} 
                        />
                    </div>
                    
                    {/* Directory navigation */}
                    <Scrollable 
                        style={{ 
                            maxHeight: '250px',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-elevated)'
                        }}
                    >
                        <ul style={{ listStyle: 'none', padding: '8px', margin: 0 }}>
                            {/* Parent directory - only show if not at root */}
                            {props.importState.currentImportPath && props.importState.currentImportPath !== '/' && (
                                <li style={{ padding: '4px 0' }}>
                                    <a href="#" onClick={() => props.importState.changeDirectory(props.importState.getParentDirectory())}>
                                        ↩️
                                    </a>
                                </li>
                            )}
                            
                            {/* Subdirectories */}
                            {props.importState.directories?.map((dir, i) => (
                                <li key={i} style={{ padding: '4px 0' }}>
                                    📁 <a href="#" onClick={() => props.importState.changeDirectory(dir.path)}>{dir.path.replace(/^.+\//, '')}</a>
                                </li>
                            ))}
                        </ul>
                    </Scrollable>
                </div>
            )}
            
            <div id="tab-filter" className={props.tabClass['filter'] ? "tab-active" : "tab"}>
                <ul>
                    <li>
                        Stars:
                        {[0, 1, 2, 3, 4, 5].map((v, i) => {
                            return <span key={i} onClick={() => {
                                logger.debug('DirectoryMenu', 'filter_changed', 'User changed star filter', {
                                    filterType: 'starFilter',
                                    newValue: v,
                                    previousValue: props.starFilter
                                });
                                props.setStarFilter(v);
                            }}>{props.starFilter >= v ? " ★" + i : " ☆" + i}</span>
                        })}
                    </li>
                    <li>
                        <input type="checkbox" value="1" id="filter-has-comment-check"
                            onChange={(e) => { 
                                logger.debug('DirectoryMenu', 'filter_changed', 'User changed comment filter', {
                                    filterType: 'hasCommentFilter',
                                    newValue: e.target.checked,
                                    previousValue: props.hasCommentFilter
                                });
                                props.setHasCommentFilter(e.target.checked); 
                            }}
                        />
                        <label className="checkbox checkbox-normal" htmlFor="filter-has-comment-check">Has comment</label>
                    </li>
                    <li>
                        Extensions:
                        <div style={{ marginTop: '5px' }}>
                            {/* Image Extensions Group */}
                            <div style={{ marginBottom: '10px' }}>
                                <div>
                                    <input 
                                        type="checkbox" 
                                        id="filter-extension-image-group-check"
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
                                            
                                            let newFilters;
                                            if (checked) {
                                                // Add all image extensions
                                                newFilters = [...currentFilters.filter(f => !imageExtensions.includes(f)), ...imageExtensions];
                                            } else {
                                                // Remove all image extensions
                                                newFilters = currentFilters.filter(f => !imageExtensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                            props.setExtensionFilter(filterString);
                                        }}
                                        checked={props.extensionFilter !== "all" && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => props.extensionFilter.split(',').includes(ext))}
                                    />
                                    <label className="checkbox checkbox-normal" htmlFor="filter-extension-image-group-check"><strong>Image</strong></label>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                    {[
                                        { value: 'jpeg', label: 'jpeg(jpg)', extensions: ['jpg', 'jpeg'] },
                                        { value: 'png', label: 'png', extensions: ['png'] },
                                        { value: 'gif', label: 'gif', extensions: ['gif'] },
                                        { value: 'bmp', label: 'bmp', extensions: ['bmp'] },
                                        { value: 'tiff', label: 'tiff', extensions: ['tiff'] }
                                    ].map(item => (
                                        <div key={item.value}>
                                            <input 
                                                type="checkbox" 
                                                value={item.value}
                                                id={`filter-extension-${item.value}-check`}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                                    
                                                    let newFilters;
                                                    if (checked) {
                                                        // Add all extensions for this item
                                                        newFilters = [...currentFilters, ...item.extensions];
                                                    } else {
                                                        // Remove all extensions for this item
                                                        newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                    }
                                                    
                                                    const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                    props.setExtensionFilter(filterString);
                                                }}
                                                checked={props.extensionFilter !== "all" && item.extensions.some(ext => props.extensionFilter.split(',').includes(ext))}
                                            />
                                            <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Movie Extensions Group */}
                            <div>
                                <div>
                                    <input 
                                        type="checkbox" 
                                        id="filter-extension-movie-group-check"
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const movieExtensions = ['mp4', 'webm'];
                                            
                                            let newFilters;
                                            if (checked) {
                                                // Add all movie extensions
                                                newFilters = [...currentFilters.filter(f => !movieExtensions.includes(f)), ...movieExtensions];
                                            } else {
                                                // Remove all movie extensions
                                                newFilters = currentFilters.filter(f => !movieExtensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                            props.setExtensionFilter(filterString);
                                        }}
                                        checked={props.extensionFilter !== "all" && ['mp4', 'webm'].some(ext => props.extensionFilter.split(',').includes(ext))}
                                    />
                                    <label className="checkbox checkbox-normal" htmlFor="filter-extension-movie-group-check"><strong>Movie</strong></label>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                    {[
                                        { value: 'mp4', label: 'mp4', extensions: ['mp4'] },
                                        { value: 'webm', label: 'webm', extensions: ['webm'] }
                                    ].map(item => (
                                        <div key={item.value}>
                                            <input 
                                                type="checkbox" 
                                                value={item.value}
                                                id={`filter-extension-${item.value}-check`}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                                    
                                                    let newFilters;
                                                    if (checked) {
                                                        // Add all extensions for this item
                                                        newFilters = [...currentFilters, ...item.extensions];
                                                    } else {
                                                        // Remove all extensions for this item
                                                        newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                    }
                                                    
                                                    const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                    props.setExtensionFilter(filterString);
                                                }}
                                                checked={props.extensionFilter !== "all" && item.extensions.some(ext => props.extensionFilter.split(',').includes(ext))}
                                            />
                                            <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
            <div id="tab-selection" className={props.tabClass['selection'] ? "tab-active" : "tab"}>
                {/* Photo Selection (default mode) */}
                {props.viewModeObj?.shouldShowPhotoSelection() && (
                    <>
                        <div>
                            <button onClick={() => props.selectAllPhotoToSelection()}>Select all photos in page</button>
                        </div>
                        {props.photoSelection.length == 0
                            ?
                            <div><br />Photos are not selected.</div>
                            :
                            <div>
                        <div className="operation">
                            <select ref={dropdownRef} onChange={(e) => doOperation(e)}>
                                <option value="select">Select an Operation</option>
                                
                                {/* Import-specific operations (only in import mode) */}
                                {props.viewModeObj?.shouldShowImportOperations() && (
                                    <>
                                        {props.viewModeObj?.showImportSelected() && <option value="importSelected">Import Selected Photos</option>}
                                        {props.viewModeObj?.showSelectAllInDirectory() && <option value="selectAllInDirectory">Select All in This Directory</option>}
                                        <option value="unselectAll">Unselect All</option>
                                    </>
                                )}
                                
                                {/* Album-specific operations (only in album mode) */}
                                {props.viewModeObj?.shouldShowAlbumOperations() && (
                                    <>
                                        {props.viewModeObj?.showRemoveFromAlbum() && <option value="removeFromAlbum">Remove from Album</option>}
                                    </>
                                )}
                                
                                {/* Trash mode operations */}
                                {props.viewModeObj?.isTrashMode() && (
                                    <>
                                        {props.viewModeObj?.showRestoreFromTrash() && <option value="restoreFromTrash">Restore</option>}
                                        {props.viewModeObj?.showPermanentDelete() && <option value="permanentDelete">Delete Permanently</option>}
                                    </>
                                )}

                                {/* Standard operations (non-import, non-trash modes) */}
                                {props.viewModeObj?.shouldShowStandardOperations() && !props.viewModeObj?.isTrashMode() && (
                                    <>
                                        {props.viewModeObj?.showUploadToGooglePhotos() && <option value="uploadToGooglePhotos">Upload to Google Photos</option>}
                                        {props.viewModeObj?.showDeleteFiles() && <option value="deleteFiles">Delete files</option>}

                                        {/* Album operations (all modes) */}
                                        {props.viewModeObj?.showCreateAlbum() && <option value="createAlbum">Create Album</option>}
                                        {props.viewModeObj?.showAddToAlbum() && <option value="addToAlbum">Add to Existing Album</option>}
                                    </>
                                )}
                            </select>
                        </div>
                        <ul className="list-of-selected">
                            {props.photoSelection.map((v, i) => {
                                return <li key={v}><a href="#" onClick={() => setPhotoIndex(i)}>{v.replace(/^.+\//, "")}</a></li>
                            })}
                        </ul>
                        <button onClick={() => props.clearPhotoSelection()}>Clear Selection</button>
                        
                        {/* Import Progress Display - Import Mode Only */}
                        {props.viewModeObj?.shouldShowImportProgress() && props.importState?.importProgress && (
                            <div className="import-progress" style={{ 
                                marginTop: '15px', 
                                padding: '10px', 
                                backgroundColor: 'var(--bg-elevated)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '4px' 
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Import Progress</div>
                                <div>Progress: {props.importState.importProgress.progress}%</div>
                                <div>Current: {props.importState.importProgress.current_file}</div>
                                {props.importState.importProgress.error && (
                                    <div style={{ color: '#dc2626', marginTop: '5px' }}>
                                        Error: {props.importState.importProgress.error}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                }
                {photoIndex >= 0 &&
                    <img
                        onMouseOver={() => setShowBigPhoto(true)}
                        src={convertFileSrc(props.photoSelection[photoIndex])}
                    />}
                    </>
                )}
                
                {/* Album Selection (album list mode) */}
                {props.viewModeObj?.shouldShowAlbumSelection() && (
                    <div>
                        <div style={{ marginBottom: '15px' }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Selected Albums</h3>
                        </div>
                        {props.selectedAlbums.length === 0 ? (
                            <div><br />No albums selected.</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: '15px' }}>
                                    <button 
                                        onClick={props.deleteSelectedAlbums}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginRight: '10px'
                                        }}
                                    >
                                        Delete Selected Albums
                                    </button>
                                    <button 
                                        onClick={() => props.clearAlbumSelection()}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: 'var(--bg-elevated)',
                                            color: 'var(--text)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {props.selectedAlbums.map((albumId) => {
                                        const album = props.albumsList.find(a => a.id === albumId);
                                        return album ? (
                                            <li key={albumId}>
                                                <span>{album.name} ({album.photoCount} photos)</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Tag Selection (tag list mode) */}
                {props.viewModeObj?.shouldShowTagSelection() && (
                    <div>
                        <div style={{ marginBottom: '15px' }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Selected Tags</h3>
                        </div>
                        {props.selectedTags.length === 0 ? (
                            <div><br />No tags selected.</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: '15px' }}>
                                    <button 
                                        onClick={props.deleteSelectedTags}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginRight: '10px'
                                        }}
                                    >
                                        Delete Selected Tags
                                    </button>
                                    <button 
                                        onClick={() => props.clearTagSelection()}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: 'var(--bg-elevated)',
                                            color: 'var(--text)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {props.selectedTags.map((tagId) => {
                                        const tag = props.tagsList.find(t => t.id === tagId);
                                        return tag ? (
                                            <li key={tagId}>
                                                <span style={{ 
                                                    display: 'inline-block',
                                                    width: '12px',
                                                    height: '12px',
                                                    backgroundColor: tag.color || '#374151',
                                                    borderRadius: '50%',
                                                    marginRight: '8px'
                                                }}></span>
                                                <span>{tag.name} ({tag.photoCount} photos)</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="big-photo-in-selection" style={{ display: showBigPhoto ? "block" : "none" }}
                onMouseLeave={() => setShowBigPhoto(false)}
                onClick={() => setShowBigPhoto(false)}
            >
                <img src={convertFileSrc(props.photoSelection[photoIndex])} />
            </div>
            
            {/* Album Creation Modal */}
            <AlbumCreationModal
                isOpen={showAlbumCreationModal}
                onClose={() => setShowAlbumCreationModal(false)}
                onConfirm={createAlbumFromSelection}
                selectedPhotosCount={props.photoSelection.length}
            />
            
            {/* Album Selector Modal */}
            <AlbumSelectorModal
                isOpen={showAlbumSelectorModal}
                onClose={() => setShowAlbumSelectorModal(false)}
                onConfirm={addPhotosToAlbum}
                selectedPhotosCount={props.photoSelection.length}
            />
            
            {/* Tutorial Tooltip */}
            <TutorialTooltip
                isVisible={showTutorial}
                content={tutorialContent}
                targetElement={dropdownRef.current}
                onDismiss={handleTutorialDismiss}
                onDontShowAgain={handleTutorialDisable}
                tutorialId={`selection_${props.viewModeObj?.isAlbumMode() ? 'album' : 'date'}`}
            />
        </div >
    )
}

export default DirectoryMenu;
