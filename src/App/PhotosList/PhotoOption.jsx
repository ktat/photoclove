import { useState, useEffect, useRef } from "react";
import classNames from 'classnames';
import { useDialog } from "../../context/DialogContext.jsx";
import PhotoInfo from "./PhotoOption/PhotoInfo.jsx";
import PhotoEditor from "./PhotoOption/PhotoEditor.jsx";
import PhotoTags from "./PhotoOption/PhotoTags.jsx";
import PhotoFaces from "./PhotoOption/PhotoFaces.jsx";
import AlbumTab from "./AlbumTab.jsx";
import SelectionTab from "./DirectoryMenu/SelectionTab.jsx";
import ShareTab from "./DirectoryMenu/ShareTab.jsx";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";
import { useUI } from "../../context/UIContext.jsx";
import { useFaceDetection } from "../../context/FaceDetectionContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";
import { useTutorial } from "../../hooks/useTutorial.js";
import { getTutorialContent } from "./DirectoryMenu/tutorialContent.jsx";
import { logger } from "../../services/LoggerService.js";
import { invokeWithErrorHandling } from "../../services/TauriService.js";
import styles from './PhotoOption.module.css';

function PhotoOption(props) {
    const [activeTab, setActiveTab] = useState("info");
    const { viewMode, currentAlbumId, burstModeEnabled } = useUI();
    const dialog = useDialog();
    const { setIsFaceTabActive, clearFaceState } = useFaceDetection();

    // Get current tag ID from viewModeObj
    const currentTagId = props.viewModeObj?.getCurrentTagId();

    // Determine modes from viewMode
    const isAlbumMode = viewMode === VIEW_MODES.ALBUM && currentAlbumId;
    const isTagMode = viewMode === VIEW_MODES.TAG && currentTagId;
    const isTrashMode = viewMode === VIEW_MODES.TRASH;
    const isImportMode = viewMode === VIEW_MODES.IMPORT;
    const isInBurstGroupMode = viewMode === VIEW_MODES.IN_BURST_GROUP;
    const isUnknownFacesMode = viewMode === VIEW_MODES.UNKNOWN_FACES;

    // Check if current photo is a burst representative (has burst badge)
    // Editor and Tags are disabled for burst representatives when burst mode is ON
    const currentPhoto = props.currentPhoto;
    const isBurstRepresentative = currentPhoto?.burst_group_id && currentPhoto?.burst_count > 1;
    const burstRestrictionsActive = burstModeEnabled && isBurstRepresentative && !isInBurstGroupMode;

    // Auto-open Faces tab when in Unknown Faces mode
    useEffect(() => {
        if (isUnknownFacesMode) {
            setActiveTab("faces");
            if (!props.showSideMenu) {
                props.setShowSideMenu(true);
            }
            logger.info('PhotoOption', 'auto_open_faces_tab', 'Auto-opening Faces tab for Unknown Faces mode');
        }
    }, [isUnknownFacesMode, props.showSideMenu, props.setShowSideMenu]);

    // Track Face tab active state for showing face bounding boxes
    useEffect(() => {
        const isFaceTabActive = activeTab === "faces" && props.showSideMenu;
        setIsFaceTabActive(isFaceTabActive);
    }, [activeTab, props.showSideMenu, setIsFaceTabActive]);

    // Clear face state when photo changes
    useEffect(() => {
        clearFaceState();
    }, [props.currentPhoto?.originalPath, clearFaceState]);

    // Tutorial state (Feature #152/#153)
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialContent, setTutorialContent] = useState('');
    const dropdownRef = useRef(null); // For tutorial tooltip positioning

    const {
        shouldShowTutorial,
        markTutorialShown,
        dismissTutorial,
        disableTutorial
    } = useTutorial();

    // Auto-open Selection tab when items are selected (Feature #152)
    const prevSelectionCount = useRef(0);
    useEffect(() => {
        // PhotoOption is only used when viewing photos, so only photo selections are relevant
        const photoCount = props.photoSelection?.length || 0;

        // Auto-open Selection tab when selection goes from 0 to 1+
        // But don't switch if Share tab is active (user is working on sharing)
        if (prevSelectionCount.current === 0 && photoCount > 0 && activeTab !== "share") {
            setActiveTab("selection");
            if (!props.showSideMenu) {
                props.setShowSideMenu(true);
            }
            logger.info('PhotoOption', 'auto_open_selection_tab', 'Auto-opening Selection tab in photo viewer', {
                photoCount
            });
        }

        prevSelectionCount.current = photoCount;
    }, [props.photoSelection?.length, props.showSideMenu, props.setShowSideMenu, activeTab]);

    // Tutorial trigger effect (Feature #152/#153)
    useEffect(() => {
        // Don't show tutorial in album list or tag list modes
        const isAlbumListMode = props.viewModeObj?.isAlbumListMode?.() || false;
        const isTagListMode = props.viewModeObj?.isTagListMode?.() || false;

        if (isAlbumListMode || isTagListMode) {
            setShowTutorial(false);
            return;
        }

        const photoCount = props.photoSelection?.length || 0;
        if (photoCount > 0) {
            const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
            const isTrashMode = props.viewModeObj?.isTrashMode() || false;

            // Only show tutorial if not already showing and if should show
            if (!showTutorial && shouldShowTutorial('selectionTutorial', context)) {
                setTutorialContent(getTutorialContent(context, photoCount, isTrashMode));
                setShowTutorial(true);
                markTutorialShown('selectionTutorial', context);

                logger.info('PhotoOption', 'tutorial_triggered', 'Selection tutorial shown in photo viewer', {
                    context,
                    photoCount,
                    isTrashMode
                });
            }
        } else {
            setShowTutorial(false);
        }
    }, [props.photoSelection?.length, props.viewModeObj, showTutorial]);

    const handleTutorialDismiss = () => {
        setShowTutorial(false);
        const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
        dismissTutorial('selectionTutorial', context);

        logger.info('PhotoOption', 'tutorial_dismissed', 'User dismissed selection tutorial in photo viewer', { context });
    };

    const handleTutorialDisable = () => {
        setShowTutorial(false);
        const context = props.viewModeObj?.isAlbumMode() ? 'albumMode' : 'dateMode';
        disableTutorial('selectionTutorial', context);

        logger.info('PhotoOption', 'tutorial_disabled', 'User disabled selection tutorial in photo viewer', { context });
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        // Show the side menu when a tab is clicked
        if (!props.showSideMenu) {
            props.setShowSideMenu(true);
        }
        document.querySelector("#dummy-for-focus").focus();
    };

    const handleCloseTab = () => {
        props.setShowSideMenu(false);
        document.querySelector("#dummy-for-focus").focus();
    };

    // Helper function to remove photos from a collection (album or tag)
    const removePhotosFromCollection = async (collectionId, collectionType) => {
        if (!collectionId || !props.photoSelection?.length) {
            logger.warn('PhotoOption', 'remove_from_collection_skipped', 'Remove skipped - no collection or no selection', {
                collectionId,
                collectionType,
                photoSelectionCount: props.photoSelection?.length
            });
            return;
        }

        const count = props.photoSelection.length;
        const totalPhotos = props.totalPhotosCount || 0;
        const willBeEmpty = count >= totalPhotos;
        const typeName = collectionType === 'album' ? 'album' : 'tag';
        const confirmed = await dialog.confirm({
            title: `Remove from ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`,
            message: `Remove ${count} photo${count > 1 ? 's' : ''} from this ${typeName}?\n\nPhotos will remain in your library.`,
            kind: 'warning',
        });

        if (confirmed) {
            try {
                for (const photoPath of props.photoSelection) {
                    await invokeWithErrorHandling(
                        "remove_photo_from_collection",
                        { collectionId, photoPath },
                        'PhotoOption',
                        { silent: true }
                    );
                    props.removePhotoFromList?.(photoPath);
                }

                props.clearPhotoSelection?.();
                props.addFooterMessage?.(`${count} photo${count > 1 ? 's' : ''} removed from ${typeName}`);

                logger.info('PhotoOption', `photos_removed_from_${typeName}`, `Photos removed from ${typeName} in PhotoViewer`, {
                    collectionId,
                    collectionType,
                    photoCount: count,
                    willBeEmpty
                });

                // Close PhotoViewer if no photos remain in the collection
                if (willBeEmpty) {
                    logger.info('PhotoOption', 'close_photo_viewer', 'Closing PhotoViewer - no photos remaining in collection', {
                        collectionType
                    });
                    props.closePhotoDisplay?.();
                }
            } catch (error) {
                logger.error('PhotoOption', `remove_from_${typeName}_failed`, `Failed to remove photos from ${typeName}`, {
                    error: error.message
                });
                props.addFooterMessage?.(`Failed to remove photos from ${typeName}`);
            }
        }
    };

    // doOperation handler for SelectionTab (Feature #153)
    // Operations are passed from parent via props.operations
    const doOperation = async (e) => {
        const selected = e.target.value;
        logger.debug('PhotoOption', 'do_operation', 'doOperation called in PhotoViewer', {
            selected,
            isAlbumMode,
            currentAlbumId,
            isTagMode,
            currentTagId,
            photoSelectionCount: props.photoSelection?.length
        });

        const operations = props.operations || {};

        if (selected === "removeFromAlbum") {
            await removePhotosFromCollection(currentAlbumId, 'album');
        } else if (selected === "removeFromTag") {
            await removePhotosFromCollection(currentTagId, 'tag');
        } else if (selected === "deleteFiles") {
            operations.deleteFiles?.();
        } else if (selected === "createAlbum") {
            operations.showCreateAlbumModal?.();
        } else if (selected === "addToAlbum") {
            operations.showAddToAlbumModal?.();
        } else if (selected === "addTags") {
            operations.showAddTagsModal?.();
        } else if (selected === "uploadToGooglePhotos") {
            operations.uploadToGooglePhotos?.();
        } else if (selected === "addToStartupImages") {
            operations.addToStartupImages?.();
        } else if (selected === "createBurstGroup") {
            operations.createBurstGroup?.();
        } else if (selected === "removeFromBurstGroup") {
            operations.removeFromBurstGroup?.();
        } else if (selected === "unselectAll") {
            if (props.clearPhotoSelection) {
                props.clearPhotoSelection();
            }
        }
        e.target.value = "";
    };

    // Helper function for selection tab class (replaces getSelectionTabClassName)
    const getSelectionTabClass = () => {
        const isActive = activeTab === "selection" && props.showSideMenu;
        // PhotoOption is only used when viewing photos, so only photo selections are relevant
        const hasSelection = (props.photoSelection?.length || 0) > 0;

        return classNames(styles['vertical-tab-button'], {
            [styles.active]: isActive,
            [styles['has-selection']]: hasSelection && !isActive
        });
    };

    return (
        <>
            {/* Vertical tabs replacing the toggle */}
            <div className={classNames(styles['vertical-tabs'], {
                [styles['menu-open']]: props.showSideMenu,
                [styles['menu-closed']]: !props.showSideMenu
            })}>
                <button
                    className={classNames(styles['vertical-tab-button'], { [styles.active]: activeTab === "info" && props.showSideMenu })}
                    onClick={() => handleTabClick("info")}
                    title="Photo Information"
                >
                    <span className={styles['vertical-text']}>Info</span>
                </button>

                {/* Hide Editor tab in import and trash modes, disable for burst representatives */}
                {!isImportMode && !isTrashMode && (
                    <button
                        className={classNames(styles['vertical-tab-button'], {
                            [styles.active]: activeTab === "editor" && props.showSideMenu,
                            [styles.disabled]: burstRestrictionsActive
                        })}
                        onClick={() => !burstRestrictionsActive && handleTabClick("editor")}
                        title={burstRestrictionsActive ? "Editor disabled for burst group photo" : "Photo Editor"}
                        disabled={burstRestrictionsActive}
                        style={burstRestrictionsActive ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                        <span className={styles['vertical-text']}>Editor</span>
                    </button>
                )}

                {/* Hide Tags tab in import and trash modes, disable for burst representatives */}
                {!isImportMode && !isTrashMode && (
                    <button
                        className={classNames(styles['vertical-tab-button'], {
                            [styles.active]: activeTab === "tags" && props.showSideMenu,
                            [styles.disabled]: burstRestrictionsActive
                        })}
                        onClick={() => !burstRestrictionsActive && handleTabClick("tags")}
                        title={burstRestrictionsActive ? "Tags disabled for burst group photo" : "Photo Tags"}
                        disabled={burstRestrictionsActive}
                        style={burstRestrictionsActive ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                        <span className={styles['vertical-text']}>Tags</span>
                    </button>
                )}
                {/* Hide Faces tab in import and trash modes */}
                {!isImportMode && !isTrashMode && (
                    <button
                        className={classNames(styles['vertical-tab-button'], {
                            [styles.active]: activeTab === "faces" && props.showSideMenu
                        })}
                        onClick={() => handleTabClick("faces")}
                        title="Face Detection"
                    >
                        <span className={styles['vertical-text']}>Faces</span>
                    </button>
                )}
                {isAlbumMode && (
                    <button
                        className={classNames(styles['vertical-tab-button'], { [styles.active]: activeTab === "album" && props.showSideMenu })}
                        onClick={() => handleTabClick("album")}
                        title="Album Management"
                    >
                        <span className={styles['vertical-text']}>Album</span>
                    </button>
                )}

                {/* Share tab - available in non-import/trash modes */}
                {!isImportMode && !isTrashMode && (
                    <button
                        className={classNames(styles['vertical-tab-button'], { [styles.active]: activeTab === "share" && props.showSideMenu })}
                        onClick={() => handleTabClick("share")}
                        title="Share Photo"
                    >
                        <span className={styles['vertical-text']}>Share</span>
                    </button>
                )}

                {/* Selection tab - always available (Feature #153) */}
                <button
                    className={getSelectionTabClass()}
                    onClick={() => handleTabClick("selection")}
                    title="Photo Selection"
                >
                    <span className={styles['vertical-text']}>Selection</span>
                </button>

                {props.showSideMenu && (
                    <button
                        className={classNames(styles['vertical-tab-button'], styles['close-tab'])}
                        onClick={handleCloseTab}
                        title="Close Panel"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Content area */}
            {props.currentPhoto && props.showSideMenu && (
                <div className={styles['tab-content']} style={{
                    position: 'fixed',
                    right: '0px',
                    top: '0px',
                    width: '320px',
                    height: 'calc(100vh - 25px)',
                    backgroundColor: 'var(--color-bg-film)',
                    paddingLeft: '20px',
                    paddingTop: '10px',
                    zIndex: 1001
                }}>
                    {activeTab === "info" && (
                        <PhotoInfo
                            currentPhoto={props.currentPhoto}
                            showSideMenu={props.showSideMenu}
                            imgCacheMap={props.imgCacheMap}
                            star={props.star}
                            setStar={props.setStar}
                            addFooterMessage={props.addFooterMessage}
                            onCommentUpdate={props.onCommentUpdate}
                            isImportMode={isImportMode}
                            isTrashMode={isTrashMode}
                        />
                    )}
                    {activeTab === "editor" && (
                        <PhotoEditor
                            currentPhoto={props.currentPhoto}
                            showSideMenu={props.showSideMenu}
                            addFooterMessage={props.addFooterMessage}
                            onPhotosRefresh={props.onPhotosRefresh}
                            onCssStyleUpdate={props.onCssStyleUpdate}
                            setEditorHasUnsavedChanges={props.setEditorHasUnsavedChanges}
                        />
                    )}
                    {activeTab === "tags" && (
                        <PhotoTags
                            currentPhoto={props.currentPhoto}
                            showSideMenu={props.showSideMenu}
                            addFooterMessage={props.addFooterMessage}
                            onTagsChanged={props.onTagsChanged}
                        />
                    )}
                    {activeTab === "faces" && (
                        <PhotoFaces
                            currentPhoto={props.currentPhoto}
                            addFooterMessage={props.addFooterMessage}
                        />
                    )}
                    {activeTab === "album" && isAlbumMode && (
                        <AlbumTab
                            albumId={currentAlbumId}
                            currentPhoto={props.currentPhoto}
                            onAlbumUpdate={props.onAlbumUpdate}
                            onAlbumDelete={props.onAlbumDelete}
                        />
                    )}
                    {activeTab === "share" && (
                        <ShareTab
                            currentPhotoPath={props.currentPhoto?.displayPath()}
                            photoSelection={props.photoSelection || []}
                            isPhotoViewer={true}
                            userWatermarkText={props.config?.custom_watermark || ''}
                            appConfig={props.config}
                        />
                    )}
                    {activeTab === "selection" && (
                        <SelectionTab
                            viewModeObj={props.viewModeObj}
                            selectionState={{
                                photoSelection: props.photoSelection || [],
                                selectedAlbums: props.selectedAlbums || [],
                                selectedTags: props.selectedTags || [],
                                persons: props.selectedPersons || []
                            }}
                            handlers={{
                                doOperation: doOperation,
                                selectAllPhotoToSelection: props.selectAllPhotoToSelection,
                                clearPhotoSelection: props.clearPhotoSelection,
                                deleteSelectedAlbums: props.deleteSelectedAlbums,
                                clearAlbumSelection: props.clearAlbumSelection,
                                deleteSelectedTags: props.deleteSelectedTags,
                                clearTagSelection: props.clearTagSelection,
                                deleteSelectedPersons: props.deleteSelectedPersons,
                                clearPersonSelection: props.clearPersonSelection
                            }}
                            importState={props.importState}
                            appConfig={props.config}
                            albumsList={props.albumsList || []}
                            tagsList={props.tagsList || []}
                            facesList={props.facesList || []}
                            dropdownRef={dropdownRef}
                            tabClass={{ selection: true }}
                        />
                    )}
                </div>
            )}

            {/* Tutorial Tooltip (Feature #152/#153) */}
            <TutorialTooltip
                isVisible={showTutorial}
                content={tutorialContent}
                targetElement={dropdownRef.current}
                onDismiss={handleTutorialDismiss}
                onDontShowAgain={handleTutorialDisable}
                tutorialId={`selection_photoviewer_${props.viewModeObj?.isAlbumMode() ? 'album' : 'date'}`}
            />
        </>
    );
}

export default PhotoOption;
