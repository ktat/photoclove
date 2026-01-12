import React, { useState, useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { logger } from "../../services/LoggerService.js";
import { useUI } from "../../context/UIContext.jsx";
import { useError } from "../../context/ErrorContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";
import { useTutorial } from "../../hooks/useTutorial.js";
import AlbumCreationModal from "../../components/AlbumCreationModal.jsx";
import AlbumSelectorModal from "../../components/AlbumSelectorModal.jsx";
import BulkTagSelectorModal from "../../components/BulkTagSelectorModal.jsx";
import ContextualDeleteModal from "../../components/ContextualDeleteModal.jsx";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";
import Scrollable from "../../Scrollable.jsx";
import SelectionTab from "./DirectoryMenu/SelectionTab.jsx";
import FilterTab from "./DirectoryMenu/FilterTab.jsx";
import { getTutorialContent } from "./DirectoryMenu/tutorialContent.jsx";
import { usePhotoImport, useGooglePhotosUpload, useTrashOperations } from "./DirectoryMenu/photoOperations.js";
import { useAlbumOperations, useTagOperations } from "./DirectoryMenu/collectionOperations.js";
import { useDateOperations } from "./DirectoryMenu/dateOperations.js";

function DirectoryMenu(props) {
    const { handleTauriError } = useError();

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteModalConfig, setDeleteModalConfig] = useState({
        operation: null,
        count: 0,
        onConfirm: null
    });

    // Photo operations hooks
    const { importSelectedPhotos } = usePhotoImport({
        importState: props.importState,
        photoSelection: props.photoSelection,
        clearPhotoSelection: props.clearPhotoSelection,
        addFooterMessage: props.addFooterMessage,
        handleTauriError
    });

    const { uploadToGooglePhotos } = useGooglePhotosUpload({
        photoSelection: props.photoSelection,
        clearPhotoSelection: props.clearPhotoSelection,
        addFooterMessage: props.addFooterMessage,
        setShowJobQueue: props.setShowJobQueue
    });

    const { deleteFiles, restoreSelectedFromTrash, permanentDeleteSelected } = useTrashOperations({
        photoSelection: props.photoSelection,
        clearPhotoSelection: props.clearPhotoSelection,
        addFooterMessage: props.addFooterMessage,
        handleTauriError,
        deletePhotos: props.deletePhotos,
        restorePhotos: props.restorePhotos,
        updatePhotosAfterTrashOperation: props.updatePhotosAfterTrashOperation,
        reloadCurrentModeData: props.reloadCurrentModeData,
        setDeleteModalConfig,
        setShowDeleteModal
    });

    // Collection operations hooks
    const {
        showAlbumCreationModal,
        setShowAlbumCreationModal,
        showAlbumSelectorModal,
        setShowAlbumSelectorModal,
        showCreateAlbumModal,
        showAddToAlbumModal,
        createAlbumFromSelection,
        addPhotosToAlbum,
        removeFromCurrentAlbum
    } = useAlbumOperations({
        photoSelection: props.photoSelection,
        clearPhotoSelection: props.clearPhotoSelection,
        addFooterMessage: props.addFooterMessage,
        handleTauriError,
        viewModeObj: props.viewModeObj,
        removePhotoFromList: props.removePhotoFromList
    });

    const {
        showBulkTagModal,
        setShowBulkTagModal,
        showAddTagsModal,
        addTagsToPhotos
    } = useTagOperations({
        photoSelection: props.photoSelection,
        clearPhotoSelection: props.clearPhotoSelection,
        addFooterMessage: props.addFooterMessage,
        handleTauriError,
        onPhotosRefresh: props.onPhotosRefresh
    });

    // Date operations hook
    const { createDbInDate, movePhotosToExifDate, createThumbnails, applyDateChanges } = useDateOperations({
        currentDate: props.currentDate,
        setCurrentDateNum: props.setCurrentDateNum,
        dateNum: props.dateNum,
        setDateNum: props.setDateNum,
        dateList: props.dateList,
        setDateList: props.setDateList
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
        // Don't show tutorial in album list or tag list modes
        const isAlbumListMode = props.viewModeObj?.isAlbumListMode?.() || false;
        const isTagListMode = props.viewModeObj?.isTagListMode?.() || false;

        if (isAlbumListMode || isTagListMode) {
            setShowTutorial(false);
            return;
        }

        if (props.photoSelection.length > 0) {
            const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
            const isTrashMode = props.viewModeObj?.isTrashMode() || false;

            // Only show tutorial if not already showing and if should show
            if (!showTutorial && shouldShowTutorial('selectionTutorial', context)) {
                setTutorialContent(getTutorialContent(context, props.photoSelection.length, isTrashMode));
                setShowTutorial(true);
                markTutorialShown('selectionTutorial', context);

                logger.info('DirectoryMenu', 'tutorial_triggered', 'Selection tutorial shown', {
                    context,
                    photoCount: props.photoSelection.length,
                    isTrashMode
                });
            }
        } else {
            setShowTutorial(false);
        }
    }, [props.photoSelection.length, props.viewModeObj, showTutorial]);

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

    // doOperation handler for dropdown menu
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
        } else if (selected == "addTags") {
            showAddTagsModal();
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

    // The following functions have been moved to operation hooks:
    // - importSelectedPhotos -> usePhotoImport
    // - uploadToGooglePhotos -> useGooglePhotosUpload
    // - deleteFiles, restoreSelectedFromTrash, permanentDeleteSelected -> useTrashOperations
    // - createDbInDate, movePhotosToExifDate, createThumbnails, applyDateChanges -> useDateOperations
    // - showCreateAlbumModal, showAddToAlbumModal, createAlbumFromSelection, addPhotosToAlbum, removeFromCurrentAlbum -> useAlbumOperations
    // - showAddTagsModal, addTagsToPhotos -> useTagOperations

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

            {/* Bulk Tag Selector Modal */}
            <BulkTagSelectorModal
                isOpen={showBulkTagModal}
                onClose={() => setShowBulkTagModal(false)}
                onConfirm={addTagsToPhotos}
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
