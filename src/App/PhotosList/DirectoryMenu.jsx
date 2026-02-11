import React, { useState, useEffect, useRef } from "react";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import { logger } from "../../services/LoggerService.js";
import { useError } from "../../context/ErrorContext.jsx";
import { useTutorial } from "../../hooks/useTutorial.js";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";
import Scrollable from "../../Scrollable.jsx";
import SelectionTab from "./DirectoryMenu/SelectionTab.jsx";
import FilterTab from "./DirectoryMenu/FilterTab.jsx";
import ShareTab from "./DirectoryMenu/ShareTab.jsx";
import { getTutorialContent } from "./DirectoryMenu/tutorialContent.jsx";
import { usePhotoImport } from "./DirectoryMenu/photoOperations.js";
import { useDateOperations } from "./DirectoryMenu/dateOperations.js";
import { useDialog } from "../../context/DialogContext.jsx";

function DirectoryMenu(props) {
    const { t } = useTranslation(['directoryMenu']);
    const { handleTauriError } = useError();
    const dialog = useDialog();

    // Photo import (DirectoryMenu-specific for IMPORT mode)
    const { importSelectedPhotos } = usePhotoImport({
        importState: props.importState,
        photoSelection: props.photoSelection,
        clearPhotoSelection: props.clearPhotoSelection,
        addFooterMessage: props.addFooterMessage,
        handleTauriError,
        dialog
    });

    // Date operations (DirectoryMenu-specific for maintenance tab)
    const { createDbInDate, movePhotosToExifDate, createThumbnails, recalculateGroupsInDate, runAiTaggingInDate, runFaceDetectionInDate, syncToS3InDate, applyDateChanges } = useDateOperations({
        currentDate: props.currentDate,
        setCurrentDateNum: props.setCurrentDateNum,
        dateNum: props.dateNum,
        setDateNum: props.setDateNum,
        dateList: props.dateList,
        setDateList: props.setDateList,
        config: props.config,
        dialog
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

    // doOperation handler for dropdown menu - uses shared operations from props
    function doOperation(e) {
        const selected = e.target.value;
        const ops = props.sharedOperations || {};
        logger.debug('DirectoryMenu', 'do_operation', 'doOperation called', {
            selected,
            viewMode: props.viewModeObj?.mode,
            isAlbumMode: props.viewModeObj?.isAlbumMode(),
            currentAlbumId: props.viewModeObj?.getCurrentAlbumId(),
            photoSelectionCount: props.photoSelection?.length
        });
        if (selected == "uploadToGooglePhotos") {
            ops.uploadToGooglePhotos?.();
        } else if (selected == "deleteFiles") {
            ops.deleteFiles?.();
        } else if (selected == "removeFromAlbum") {
            logger.info('DirectoryMenu', 'remove_from_album_selected', 'User selected Remove from Album', {
                currentAlbumId: props.viewModeObj?.getCurrentAlbumId(),
                photoSelectionCount: props.photoSelection?.length
            });
            ops.removeFromCurrentAlbum?.();
        } else if (selected == "removeFromTag") {
            ops.removeFromCurrentTag?.();
        } else if (selected == "createAlbum") {
            ops.showCreateAlbumModal?.();
        } else if (selected == "addToAlbum") {
            ops.showAddToAlbumModal?.();
        } else if (selected == "addTags") {
            ops.showAddTagsModal?.();
        } else if (selected == "importSelected") {
            importSelectedPhotos();
        } else if (selected == "selectAllInDirectory") {
            props.selectAllPhotosInDirectory?.();
        } else if (selected == "unselectAll") {
            props.clearPhotoSelection();
        } else if (selected == "restoreFromTrash") {
            ops.restoreSelectedFromTrash?.();
        } else if (selected == "permanentDelete") {
            ops.permanentDeleteSelected?.();
        } else if (selected == "addToStartupImages") {
            ops.addToStartupImages?.();
        } else if (selected == "createBurstGroup") {
            ops.createBurstGroup?.();
        } else if (selected == "removeFromBurstGroup") {
            ops.removeFromBurstGroup?.();
        }
        e.target.value = "";
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
                    <ul style={{ listStyle: 'none', paddingLeft: '20px', paddingTop: '8px', paddingBottom: '8px', paddingRight: '8px' }}>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { createDbInDate() }}>🗄️ {t('directoryMenu:maintenance.createDb')}</a></li>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { movePhotosToExifDate() }}>📅 {t('directoryMenu:maintenance.moveToExifDate')}</a></li>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { createThumbnails() }}>🖼️ {t('directoryMenu:maintenance.makeThumbnails')}</a></li>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { recalculateGroupsInDate() }}>🔄 {t('directoryMenu:maintenance.recalculateGroups')}</a></li>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { runAiTaggingInDate() }}>🤖 {t('directoryMenu:maintenance.runAiTagging')}</a></li>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { runFaceDetectionInDate() }}>👤 {t('directoryMenu:maintenance.runFaceDetection')}</a></li>
                        <li style={{ padding: '4px 0' }}><a href="#" onClick={() => { syncToS3InDate() }}>☁️ {t('directoryMenu:maintenance.syncToS3')}</a></li>
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
                        <label><strong>{t('directoryMenu:import.importFrom')}</strong>: </label>
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
                            <option value="">{t('directoryMenu:import.selectSource')}</option>
                            {props.importState.importPaths?.map((p, i) => (
                                <option key={i} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Current directory - show only if different from root paths */}
                    {props.importState.currentImportPath &&
                        !props.importState.importPaths?.includes(props.importState.currentImportPath) && (
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-muted)',
                                marginBottom: '10px',
                                fontStyle: 'italic'
                            }}>
                                {t('directoryMenu:import.currentlyBrowsing')} {props.importState.currentImportPath}
                            </p>
                        )}

                    {/* Date filter - integrated with directory selection */}
                    <div style={{ marginBottom: '10px' }}>
                        <label>{t('directoryMenu:import.createdDateAfter')} </label>
                        <DatePicker
                            selected={props.importState.importFilter ? new Date(props.importState.importFilter) : null}
                            onChange={(date) => {
                                const dateStr = date ? date.toISOString().split('T')[0] : '';
                                props.importState.updateImportFilter(dateStr);
                            }}
                            dateFormat="yyyy-MM-dd"
                            dateFormatCalendar="MMMM yyyy"
                            placeholderText={t('directoryMenu:import.selectDate')}
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
                            border: '1px solid var(--color-border-default)',
                            borderRadius: '4px',
                            backgroundColor: 'var(--color-bg-elevated)'
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
                    selectedTags: props.selectedTags,
                    persons: props.selectedPersons,
                    unknownFaces: props.selectedUnknownFaces
                }}
                handlers={{
                    doOperation,
                    selectAllPhotoToSelection: props.selectAllPhotoToSelection,
                    clearPhotoSelection: props.clearPhotoSelection,
                    deleteSelectedAlbums: props.deleteSelectedAlbums,
                    clearAlbumSelection: props.clearAlbumSelection,
                    deleteSelectedTags: props.deleteSelectedTags,
                    clearTagSelection: props.clearTagSelection,
                    deleteSelectedPersons: props.deleteSelectedPersons,
                    clearPersonSelection: props.clearPersonSelection,
                    clearUnknownFaceSelection: props.clearUnknownFaceSelection,
                    deleteUnknownFacesBatch: props.deleteUnknownFacesBatch,
                    assignUnknownFacesToPerson: props.assignUnknownFacesToPerson
                }}
                importState={props.importState}
                albumsList={props.albumsList}
                tagsList={props.tagsList}
                facesList={props.facesList}
                faceViewType={props.faceViewType}
                dropdownRef={dropdownRef}
                tabClass={props.tabClass}
            />

            {/* Share Tab - available in standard photo modes */}
            {props.viewModeObj?.shouldShowPhotoSelection() && !props.viewModeObj?.isImportMode() && !props.viewModeObj?.isTrashMode() && (
                <div id="tab-share" className={props.tabClass['share'] ? "tab-active" : "tab"}>
                    <ShareTab
                        photoSelection={props.photoSelection}
                        isPhotoViewer={false}
                        userWatermarkText={props.config?.custom_watermark || ''}
                        appConfig={props.config}
                    />
                </div>
            )}

            {/* Modals are now rendered by SharedModals in PhotosList.jsx */}

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
