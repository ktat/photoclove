import React, { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import { emit } from "@tauri-apps/api/event";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { localForage } from "../../storage/forage";
import { logger } from "../../services/LoggerService.js";
import { UnifiedPhotoCollection } from "../../domain/UnifiedPhotoCollection.js";
import { useUI } from "../../context/UIContext.jsx";
import { useError } from "../../context/ErrorContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";
import { useTutorial } from "../../hooks/useTutorial.js";
import AlbumCreationModal from "../../components/AlbumCreationModal.jsx";
import AlbumSelectorModal from "../../components/AlbumSelectorModal.jsx";
import ContextualDeleteModal from "../../components/ContextualDeleteModal.jsx";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";
import Scrollable from "../../Scrollable.jsx";
import SelectionTab from "./DirectoryMenu/SelectionTab.jsx";
import FilterTab from "./DirectoryMenu/FilterTab.jsx";
import { getTutorialContent } from "./DirectoryMenu/tutorialContent.jsx";

function DirectoryMenu(props) {
    const { handleTauriError } = useError();

    const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
    const [showAlbumSelectorModal, setShowAlbumSelectorModal] = useState(false);

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteModalConfig, setDeleteModalConfig] = useState({
        operation: null,
        count: 0,
        onConfirm: null
    });

    // Tutorial state
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialContent, setTutorialContent] = useState('');
    const dropdownRef = useRef(null);

    const {
        shouldShowTutorial,
        markTutorialShown,
        dismissTutorial,
        disableTutorial
    } = useTutorial();

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

    // Use useRef for lock flags to persist across re-renders
    const lockRef = useRef(false);
    const lockThumbnailRef = useRef(false);
    const lockUploadRef = useRef(false);
    const lockDeleteRef = useRef(false);

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
        if (lockRef.current) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lockRef.current = true;
                    invoke("create_db_in_date", { dateStr: props.currentDate }).then((r) => {
                        lockRef.current = false;
                        let data = JSON.parse(r);
                        props.setCurrentDateNum(data[props.currentDate.replace(/\//g, "-")]);
                    })
                }
            });
        }
    }

    async function movePhotosToExifDate() {
        if (lockRef.current) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lockRef.current = true;
                    invoke("move_photos_to_exif_date", { dateStr: props.currentDate }).then(() => {
                        lockRef.current = false;
                    })
                }
            });
        }
    }

    async function createThumbnails() {
        if (lockThumbnailRef.current) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lockThumbnailRef.current = true;
                    invoke("create_thumbnails_in_date", { dateStr: props.currentDate }).then((r) => {
                        lockThumbnailRef.current = false;
                    })
                }
            });
        }
    }

    async function uploadToGooglePhotos() {
        if (lockUploadRef.current) {
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

                lockUploadRef.current = true;

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
                lockUploadRef.current = false;

                message(
                    `Created ${jobUnitIds.length} upload job${jobUnitIds.length > 1 ? 's' : ''}. ` +
                    `Check Job Queue for progress.`,
                    "Upload Started"
                );

                logger.info('DirectoryMenu', 'google_photos_jobs_created', 'Google Photos upload jobs created', {
                    jobUnitsCreated: jobUnitIds.length,
                    jobUnitIds: jobUnitIds
                });

                props.setShowJobQueue(true);

            } catch (e) {
                lockUploadRef.current = false;
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

        if (props.setDateList && props.dateList) {
            const newDateList = [...props.dateList];
            props.setDateList(newDateList);
        }

        logger.info('DirectoryMenu', 'date_counts_updated', 'Applied date changes from batch operation', {
            changedDates: Object.keys(dateChanges).length,
            dateChanges
        });
    }

    /**
     * Deletes selected photos - wrapper that handles confirmation and calls the handler
     */
    async function deleteFiles() {
        if (lockDeleteRef.current) return false;

        if (!props.photoSelection || props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return false;
        }

        const count = props.photoSelection.length;

        console.log('[DirectoryMenu.deleteFiles] Starting deletion', {
            count,
            hasDeletePhotos: !!props.deletePhotos,
            photoSelection: props.photoSelection
        });

        // Show ContextualDeleteModal
        setDeleteModalConfig({
            operation: 'moveToTrash',
            count: count,
            onConfirm: async () => {
                setShowDeleteModal(false);

                try {
                    lockDeleteRef.current = true;

                    console.log('[DirectoryMenu.deleteFiles] Calling props.deletePhotos');

                    // Call the handler from PhotosList which handles date updates
                    const result = await props.deletePhotos(props.photoSelection, {
                        skipConfirmation: true,  // Already confirmed
                        clearSelection: true
                    });

                    console.log('[DirectoryMenu.deleteFiles] Result:', result);
                    return result;
                } finally {
                    lockDeleteRef.current = false;
                }
            }
        });
        setShowDeleteModal(true);
        return false; // Will be handled by modal confirmation
    }

    // Trash operation functions
    /**
     * Restores selected photos from trash - wrapper that handles confirmation and calls the handler
     */
    async function restoreSelectedFromTrash() {
        if (!props.photoSelection || props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return false;
        }

        const count = props.photoSelection.length;

        // Show ContextualDeleteModal
        setDeleteModalConfig({
            operation: 'restoreFromTrash',
            count: count,
            onConfirm: async () => {
                setShowDeleteModal(false);

                // Call the handler from PhotosList which handles date updates
                const result = await props.restorePhotos(props.photoSelection, {
                    skipConfirmation: true,  // Already confirmed
                    clearSelection: true
                });

                return result;
            }
        });
        setShowDeleteModal(true);
        return false; // Will be handled by modal confirmation
    }

    async function permanentDeleteSelected() {
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }

        const count = props.photoSelection.length;

        // Show ContextualDeleteModal
        setDeleteModalConfig({
            operation: 'permanentDelete',
            count: count,
            onConfirm: async () => {
                setShowDeleteModal(false);

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
        });
        setShowDeleteModal(true);
    }

    async function removeFromCurrentAlbum() {
        const currentAlbumId = props.viewModeObj?.getCurrentAlbumId();

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

                // Remove each photo from album and update UI
                for (const photoPath of props.photoSelection) {
                    await invoke("remove_photo_from_album", {
                        albumId: currentAlbumId,
                        photoPath: photoPath
                    });

                    // Remove photo from UI immediately after successful backend deletion
                    props.removePhotoFromList(photoPath);
                }

                props.clearPhotoSelection();
                props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} removed from album`);

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
                albumId: album.id,
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
                        <DatePicker
                            selected={props.importState.importFilter ? new Date(props.importState.importFilter) : null}
                            onChange={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                props.importState.updateImportFilter(dateStr);
                            }}
                            dateFormat="yyyy-MM-dd"
                            dateFormatCalendar="MMMM yyyy"
                            placeholderText="Select date"
                            isClearable
                            showYearDropdown
                            showMonthDropdown
                            dropdownMode="select"
                            yearDropdownItemNumber={100}
                            scrollableYearDropdown
                            className="date-picker-input"
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

            <FilterTab
                viewModeObj={props.viewModeObj}
                filterState={{
                    starFilter: props.starFilter,
                    setStarFilter: props.setStarFilter,
                    hasCommentFilter: props.hasCommentFilter,
                    setHasCommentFilter: props.setHasCommentFilter,
                    hasTagFilter: props.hasTagFilter,
                    setHasTagFilter: props.setHasTagFilter,
                    extensionFilter: props.extensionFilter,
                    setExtensionFilter: props.setExtensionFilter
                }}
                tabClass={props.tabClass}
            />
            <SelectionTab
                viewModeObj={props.viewModeObj}
                selectionState={{
                    photoSelection: props.photoSelection,
                    selectedAlbums: props.selectedAlbums,
                    selectedTags: props.selectedTags
                }}
                handlers={{
                    doOperation,
                    selectAllPhotoToSelection: props.selectAllPhotoToSelection,
                    clearPhotoSelection: props.clearPhotoSelection,
                    deleteSelectedAlbums: props.deleteSelectedAlbums,
                    clearAlbumSelection: props.clearAlbumSelection,
                    deleteSelectedTags: props.deleteSelectedTags,
                    clearTagSelection: props.clearTagSelection
                }}
                importState={props.importState}
                albumsList={props.albumsList}
                tagsList={props.tagsList}
                dropdownRef={dropdownRef}
                tabClass={props.tabClass}
            />

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

            {/* Contextual Delete Modal */}
            <ContextualDeleteModal
                isOpen={showDeleteModal}
                operation={deleteModalConfig.operation}
                photoCount={deleteModalConfig.count}
                onConfirm={deleteModalConfig.onConfirm}
                onCancel={() => setShowDeleteModal(false)}
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
