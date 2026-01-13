import { useState, useEffect, useRef } from "react";
import classNames from 'classnames';
import PhotoInfo from "./PhotoOption/PhotoInfo.jsx";
import PhotoEditor from "./PhotoOption/PhotoEditor.jsx";
import PhotoTags from "./PhotoOption/PhotoTags.jsx";
import AlbumTab from "./AlbumTab.jsx";
import SelectionTab from "./DirectoryMenu/SelectionTab.jsx";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";
import { useUI } from "../../context/UIContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";
import { useTutorial } from "../../hooks/useTutorial.js";
import { getTutorialContent } from "./DirectoryMenu/tutorialContent.jsx";
import { logger } from "../../services/LoggerService.js";
import styles from './PhotoOption.module.css';

function PhotoOption(props) {
    const [activeTab, setActiveTab] = useState("info");
    const { viewMode, currentAlbumId } = useUI();

    // Determine modes from viewMode
    const isAlbumMode = viewMode === VIEW_MODES.ALBUM && currentAlbumId;
    const isTrashMode = viewMode === VIEW_MODES.TRASH;
    const isImportMode = viewMode === VIEW_MODES.IMPORT;

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
        const photoCount = props.photoSelection?.length || 0;
        const albumCount = props.selectedAlbums?.length || 0;
        const tagCount = props.selectedTags?.length || 0;
        const totalSelectionCount = photoCount + albumCount + tagCount;

        // Auto-open Selection tab when selection goes from 0 to 1+
        if (prevSelectionCount.current === 0 && totalSelectionCount > 0) {
            setActiveTab("selection");
            if (!props.showSideMenu) {
                props.setShowSideMenu(true);
            }
            logger.info('PhotoOption', 'auto_open_selection_tab', 'Auto-opening Selection tab in photo viewer', {
                photoCount,
                albumCount,
                tagCount
            });
        }

        prevSelectionCount.current = totalSelectionCount;
    }, [props.photoSelection?.length, props.selectedAlbums?.length, props.selectedTags?.length, props.showSideMenu, props.setShowSideMenu]);

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

    // doOperation handler for SelectionTab (Feature #153)
    const doOperation = (e) => {
        const selected = e.target.value;
        // Note: Full implementation would require additional handlers
        // For now, supporting basic operations that are available via props
        if (selected === "deleteFiles") {
            // TODO: Implement delete operation
            if (props.addFooterMessage) {
                props.addFooterMessage("Delete operation not yet implemented in photo viewer");
            }
        } else if (selected === "createAlbum") {
            // TODO: Show album creation modal
            if (props.addFooterMessage) {
                props.addFooterMessage("Album creation not yet implemented in photo viewer");
            }
        } else if (selected === "addToAlbum") {
            // TODO: Show add to album modal
            if (props.addFooterMessage) {
                props.addFooterMessage("Add to album not yet implemented in photo viewer");
            }
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
        const hasSelection = (props.photoSelection?.length || 0) +
                           (props.selectedAlbums?.length || 0) +
                           (props.selectedTags?.length || 0) > 0;

        return classNames(styles.verticalTabButton, {
            [styles.active]: isActive,
            [styles.hasSelection]: hasSelection && !isActive
        });
    };

    return (
        <>
            {/* Vertical tabs replacing the toggle */}
            <div className={classNames(styles.verticalTabs, {
                [styles.menuOpen]: props.showSideMenu,
                [styles.menuClosed]: !props.showSideMenu
            })}>
                <button
                    className={classNames(styles.verticalTabButton, { [styles.active]: activeTab === "info" && props.showSideMenu })}
                    onClick={() => handleTabClick("info")}
                    title="Photo Information"
                >
                    <span className={styles.verticalText}>Info</span>
                </button>

                {/* Hide Editor tab in import and trash modes */}
                {!isImportMode && !isTrashMode && (
                    <button
                        className={classNames(styles.verticalTabButton, { [styles.active]: activeTab === "editor" && props.showSideMenu })}
                        onClick={() => handleTabClick("editor")}
                        title="Photo Editor"
                    >
                        <span className={styles.verticalText}>Editor</span>
                    </button>
                )}

                {/* Hide Tags tab in import and trash modes */}
                {!isImportMode && !isTrashMode && (
                    <button
                        className={classNames(styles.verticalTabButton, { [styles.active]: activeTab === "tags" && props.showSideMenu })}
                        onClick={() => handleTabClick("tags")}
                        title="Photo Tags"
                    >
                        <span className={styles.verticalText}>Tags</span>
                    </button>
                )}
                {isAlbumMode && (
                    <button
                        className={classNames(styles.verticalTabButton, { [styles.active]: activeTab === "album" && props.showSideMenu })}
                        onClick={() => handleTabClick("album")}
                        title="Album Management"
                    >
                        <span className={styles.verticalText}>Album</span>
                    </button>
                )}

                {/* Selection tab - always available (Feature #153) */}
                <button
                    className={getSelectionTabClass()}
                    onClick={() => handleTabClick("selection")}
                    title="Photo Selection"
                >
                    <span className={styles.verticalText}>Selection</span>
                </button>

                {props.showSideMenu && (
                    <button
                        className={classNames(styles.verticalTabButton, styles.closeTab)}
                        onClick={handleCloseTab}
                        title="Close Panel"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Content area */}
            {props.currentPhotoPath && props.showSideMenu && (
                <div className={styles.tabContent} style={{
                    position: 'fixed',
                    right: '0px',
                    top: '0px',
                    width: '320px',
                    height: 'calc(100vh - 25px)',
                    backgroundColor: 'var(--color-bg-elevated)',
                    paddingLeft: '20px',
                    paddingTop: '10px',
                    zIndex: 1001
                }}>
                    {activeTab === "info" && (
                        <PhotoInfo
                            currentPhotoPath={props.currentPhotoPath}
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
                            currentPhotoPath={props.currentPhotoPath}
                            showSideMenu={props.showSideMenu}
                            addFooterMessage={props.addFooterMessage}
                            onPhotosRefresh={props.onPhotosRefresh}
                        />
                    )}
                    {activeTab === "tags" && (
                        <PhotoTags
                            currentPhotoPath={props.currentPhotoPath}
                            showSideMenu={props.showSideMenu}
                            addFooterMessage={props.addFooterMessage}
                            onPhotosRefresh={props.onPhotosRefresh}
                        />
                    )}
                    {activeTab === "album" && isAlbumMode && (
                        <AlbumTab
                            albumId={currentAlbumId}
                            currentPhotoPath={props.currentPhotoPath}
                            onAlbumUpdate={props.onAlbumUpdate}
                            onAlbumDelete={props.onAlbumDelete}
                        />
                    )}
                    {activeTab === "selection" && (
                        <SelectionTab
                            viewModeObj={props.viewModeObj}
                            selectionState={{
                                photoSelection: props.photoSelection || [],
                                selectedAlbums: props.selectedAlbums || [],
                                selectedTags: props.selectedTags || []
                            }}
                            handlers={{
                                doOperation: doOperation,
                                selectAllPhotoToSelection: props.selectAllPhotoToSelection,
                                clearPhotoSelection: props.clearPhotoSelection,
                                deleteSelectedAlbums: props.deleteSelectedAlbums,
                                clearAlbumSelection: props.clearAlbumSelection,
                                deleteSelectedTags: props.deleteSelectedTags,
                                clearTagSelection: props.clearTagSelection
                            }}
                            importState={props.importState}
                            albumsList={props.albumsList || []}
                            tagsList={props.tagsList || []}
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
