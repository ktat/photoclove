import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import PhotoDisplay from "./PhotosListMini/PhotoDisplay.jsx";
import { ImgCacheContext, AllPhotosContext } from "../ImgCacheContext.jsx";
import ContextualDeleteModal from "../../components/ContextualDeleteModal.jsx";
import { logger } from "../../services/LoggerService.js";
import { Photo } from "../../domain/Photo.js";
import { calculateThumbnailDisplayWithViewOffset, getDateKey as utilGetDateKey, createBorderStyles } from "./PhotosListMini/photoUtils.js";
import { useKeyboardShortcuts } from "./PhotosListMini/useKeyboardShortcuts.js";
import { useDeletionOperations } from "./PhotosListMini/useDeletionOperations.js";
import { usePhotoNavigation } from "./PhotosListMini/usePhotoNavigation.js";
import { useStarOperations } from "./PhotosListMini/useStarOperations.js";
import HelpPanel from "./PhotosListMini/HelpPanel.jsx";
import AlbumModeIndicator from "./PhotosListMini/AlbumModeIndicator.jsx";
import ThumbnailRenderer from "./PhotosListMini/ThumbnailRenderer.jsx";
import { useUI } from "../../context/UIContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";

function PhotosListMini(props) {
    // Context
    const { imgCacheMap, setImgCacheMap } = useContext(ImgCacheContext);
    const { photosListMiniAllPhotos, setPhotosListMiniAllPhotos } = useContext(AllPhotosContext);
    const { viewMode, burstModeEnabled } = useUI();

    // Determine modes from viewMode
    const isImportMode = viewMode === VIEW_MODES.IMPORT;
    const isTrashMode = viewMode === VIEW_MODES.TRASH;
    const isInBurstGroupMode = viewMode === VIEW_MODES.IN_BURST_GROUP;

    // Debug log for burst group mode
    logger.debug('PhotosListMini', 'render_state', 'PhotosListMini render state', {
        viewMode,
        isInBurstGroupMode,
        photosCount: photosListMiniAllPhotos?.length,
        propsCurrentIndex: props.currentIndex
    });

    // Convert JSON back to Photo entities for all photos operations
    const photosWithMethods = useMemo(() => {
        if (!Array.isArray(photosListMiniAllPhotos)) return [];
        return photosListMiniAllPhotos.map(photoJson => {
            if (photoJson && typeof photoJson === 'object' && photoJson.originalPath) {
                return Photo.fromJSON(photoJson);
            }
            return null;
        }).filter(photo => photo !== null);
    }, [photosListMiniAllPhotos]);

    // Search mode props
    const isSearchMode = props.searchMode || false;
    const recentPhotosMode = props.recentPhotosMode || false;

    // Import state for thumbnail caching
    const importState = props.importState;

    // Thumbnail orientation correction setting
    const thumbnailOrientationCorrection = props.config?.thumbnail_orientation_correction || false;
    // Progressive image loading setting
    const progressiveImageLoading = props.config?.progressive_image_loading || false;

    // State
    const [showPhotosIndex, setShowPhotosIndex] = useState([]);
    const [borderStyle, setBorderStyle] = useState([]);
    const [currentPhotoSize, setCurrentPhotoSize] = useState([]);
    const [photoZoomReady, setPhotoZoomReady] = useState(false);
    const [photoZoom, setPhotoZoom] = useState("auto");
    const [imgStyle, setImgStyle] = useState({
        transition: 'opacity 0.1s',
        opacity: 0.5,
        overflow: "hidden"
    });
    const [thumbnailStore, setThumbnailStore] = useState("");
    const [photosListImgSrc, setPhotosListImgSrc] = useState({});
    const [photosListMiniClosed, setPhotosListMiniClosed] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [viewStartIndex, setViewStartIndex] = useState(null); // null means auto-center on selected photo

    // Check if we're in album mode or tag mode
    const isAlbumMode = props.albumId !== undefined && props.albumId !== null;
    const isTagMode = props.tagId !== undefined && props.tagId !== null;

    // Check if current photo is a burst representative (has burst badge)
    // Selection/edit/tag operations are disabled for burst representatives when burst mode is ON
    const currentPhoto = useMemo(() => {
        if (props.currentIndex >= 0 && props.currentIndex < photosWithMethods.length) {
            return photosWithMethods[props.currentIndex];
        }
        return null;
    }, [photosWithMethods, props.currentIndex]);

    const isBurstRepresentative = currentPhoto?.burst_group_id && currentPhoto?.burst_count > 1;
    const burstRestrictionsActive = burstModeEnabled && isBurstRepresentative && !isInBurstGroupMode;

    // Reset currentIndex when in Burst Group mode and index is out of bounds
    // This is necessary because the photo list changes to a much smaller burst group list
    useEffect(() => {
        // Only act when in burst group mode with loaded photos and invalid index
        if (isInBurstGroupMode && photosWithMethods.length > 0 &&
            (props.currentIndex >= photosWithMethods.length || props.currentIndex < 0)) {
            // Find the current photo's position in the burst group
            const currentPath = props.currentPhotoPath;
            let newIndex = 0;

            if (currentPath) {
                const foundIndex = photosWithMethods.findIndex(p => p.originalPath === currentPath);
                if (foundIndex >= 0) {
                    newIndex = foundIndex;
                }
            }

            logger.info('PhotosListMini', 'burst_group_index_reset', 'Resetting out-of-bounds index for burst group mode', {
                previousIndex: props.currentIndex,
                newIndex,
                photosCount: photosWithMethods.length,
                currentPath
            });

            props.setCurrentIndex(newIndex);
            // Also reset viewStartIndex to auto-center on the selected photo
            setViewStartIndex(null);
        }
    }, [isInBurstGroupMode, photosWithMethods.length, props.currentPhotoPath, props.currentIndex]);

    // Helper function to get the correct date key for pagination
    const getDateKey = useCallback(() => {
        return utilGetDateKey(recentPhotosMode, isSearchMode, props.currentDate);
    }, [recentPhotosMode, isSearchMode, props.currentDate]);

    // SetImgStyle helper
    const SetImgStyle = useCallback((style, w, h) => {
        setImgStyle(prevStyle => ({ ...prevStyle, ...style }));
        if (w && h) {
            setCurrentPhotoSize([w, h]);
        }
    }, []);

    // Use photo navigation hook
    const {
        nextPhoto,
        prevPhoto,
        backwardPhotos,
        forwardPhotos,
        goToPhoto,
        lockNavigate
    } = usePhotoNavigation({
        photos: photosWithMethods,
        currentIndex: props.currentIndex,
        setCurrentIndex: props.setCurrentIndex,
        setCurrentPhotoPath: props.setCurrentPhotoPath,
        setImgStyle: SetImgStyle,
        currentPhotoSize,
        datePage: props.datePage,
        getDateKey,
        num: props.num,
        imgCacheMap,
        setImgCacheMap,
        viewStartIndex,
        setViewStartIndex,
        beforeNavigate: props.beforeNavigate
    });

    // Use star operations hook
    const {
        changeStar,
        togglePhotoSelected,
        favoritePhoto,
        showBlockedMessage,
        selectedInfoHidden,
        unselectedInfoHidden,
        selectedContent,
        unselectedContent
    } = useStarOperations({
        currentPhotoPath: props.currentPhotoPath,
        setStar: props.setStar,
        toggleSelection: props.toggleSelection,
        isSelected: props.isSelected
    });

    // Use deletion operations hook
    const {
        showDeleteModal,
        deleteOperation,
        showRemoveFromAlbumModal,
        showDeleteFileModal,
        showPermanentDeleteModal,
        handleConfirmAction,
        closeModal: closeDeleteModal,
        currentPhotoPath: deleteTargetPath
    } = useDeletionOperations({
        photos: photosWithMethods,
        currentIndex: props.currentIndex,
        albumId: props.albumId,
        albumName: props.albumName,
        tagId: props.tagId,
        tagName: props.tagName,
        isAlbumMode,
        isTagMode,
        isTrashMode,
        removePhotoFromList: props.removePhotoFromList,
        deletePhotos: props.deletePhotos,
        updatePhotosAfterTrashOperation: props.updatePhotosAfterTrashOperation,
        setCurrentIndex: props.setCurrentIndex,
        setCurrentPhotoPath: props.setCurrentPhotoPath,
        setCurrentPhotoIndex: props.setCurrentPhotoIndex,
        closePhotoDisplay: props.closePhotoDisplay,
        addFooterMessage: props.addFooterMessage,
        handleTauriError: props.handleTauriError,
        setAllPhotos: setPhotosListMiniAllPhotos,
        allPhotos: photosListMiniAllPhotos
    });

    // Wrapper for goBackFromBurstGroup to restore currentPhotoIndex after returning
    const handleGoBackFromBurstGroup = useCallback(() => {
        if (props.goBackFromBurstGroup) {
            const returnModeData = props.goBackFromBurstGroup();
            // Restore currentPhotoIndex after a delay to allow photos to reload
            // Using 500ms to ensure the photo list has been fully reloaded
            if (returnModeData && typeof returnModeData.currentPhotoIndex === 'number') {
                logger.info('PhotosListMini', 'restore_index', 'Restoring photo index after burst group exit', {
                    currentPhotoIndex: returnModeData.currentPhotoIndex
                });
                setTimeout(() => {
                    props.setCurrentIndex(returnModeData.currentPhotoIndex);
                }, 500);
            }
        }
    }, [props.goBackFromBurstGroup, props.setCurrentIndex]);

    // Use keyboard shortcuts hook
    const { photoNavigation, photoNavigationUp } = useKeyboardShortcuts(
        {
            nextPhoto,
            prevPhoto,
            togglePhotoSelected,
            changeStar,
            favoritePhoto,
            showBlockedMessage,
            setShowSideMenu: props.setShowSideMenu,
            showRemoveFromAlbumModal,
            showDeleteFileModal,
            showPermanentDeleteModal,
            setPhotosListMiniClosed,
            setShowHelp,
            setPhotoZoom,
            SetImgStyle,
            setPhotoZoomReady
        },
        {
            isImportMode,
            isTrashMode,
            isAlbumMode,
            isTagMode,
            albumId: props.albumId,
            tagId: props.tagId,
            currentPhotoPath: props.currentPhotoPath,
            showSideMenu: props.showSideMenu,
            showHelp,
            photoZoomReady,
            burstRestrictionsActive
        }
    );

    const handleClick = useCallback((e) => {
        const interactive = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'];
        if (interactive.includes(e.target.tagName)) return;
        document.querySelector("#dummy-for-focus")?.focus();
    }, []);

    useEffect(() => {
        invoke("get_config", {}).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
            // Apply themes on load - preserve existing DOM state if already set
            const currentGridTheme = document.documentElement.getAttribute('data-grid-theme');
            const currentColorTheme = document.documentElement.getAttribute('data-theme');
            if (!currentGridTheme && json.photo_grid_theme) {
                document.documentElement.setAttribute('data-grid-theme', json.photo_grid_theme);
            }
            if (!currentColorTheme && json.color_theme) {
                document.documentElement.setAttribute('data-theme', json.color_theme);
            }
        });
    }, []);

    // Set initial focus for keyboard navigation
    useEffect(() => {
        const dummyFocus = document.querySelector("#dummy-for-focus");
        if (dummyFocus) {
            dummyFocus.focus();
        }
    }, [props.showPhotoDisplay]);

    // Handle date changes - clear thumbnail cache and reset state
    useEffect(() => {
        setPhotosListImgSrc({});
    }, [props.currentDate]);

    useEffect(() => {
        const loadedCount = photosWithMethods.length;
        if (loadedCount > 0 && props.currentIndex >= 0) {
            adjustCurrentIndex();
        }
    }, [props.currentIndex, props.reread, photosWithMethods.length, props.currentDate, viewStartIndex]);

    function adjustCurrentIndex() {
        const totalPhotos = photosWithMethods.length;
        const selectedIndex = props.currentIndex;

        if (totalPhotos === 0 || selectedIndex === undefined || selectedIndex === null || selectedIndex < 0 || selectedIndex >= totalPhotos) {
            setShowPhotosIndex([]);
            setBorderStyle([]);
            return;
        }

        const { startIndex, endIndex, selectedPositionInView } = calculateThumbnailDisplayWithViewOffset(photosWithMethods, selectedIndex, viewStartIndex);

        const photosIndex = [];
        for (let i = startIndex; i <= endIndex && i < totalPhotos; i++) {
            if (photosWithMethods[i]) {
                photosIndex.push(i);
            }
        }

        setShowPhotosIndex(photosIndex);
        // selectedPositionInView is -1 if selected photo is not in view
        const newBorderStyle = createBorderStyles(photosIndex.length, selectedPositionInView);
        setBorderStyle(newBorderStyle);
    }

    // Calculate thumbnail max height
    const thumbnailMaxHeight = useMemo(() => {
        return document.querySelector('#photos-list-mini')?.clientHeight - 50 || 80;
    }, []);

    const { showPrev, showNext } = calculateThumbnailDisplayWithViewOffset(photosWithMethods, props.currentIndex, viewStartIndex);

    return (
        <>
            <div className={props.centerDisplayClass}>
                <div
                    className={"photoDisplay" + (photosListMiniClosed ? " photosListMiniClosed" : "")}
                    id="photoDisplay"
                    onClick={handleClick}
                >
                    <a
                        href="#"
                        id="dummy-for-focus"
                        onKeyDown={photoNavigation}
                        onKeyUp={photoNavigationUp}
                        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                    />
                    {props.currentIndex > 0 ? (
                        <><a href="#" onClick={() => lockNavigate(prevPhoto)}>&lt;&lt; prev</a>&nbsp;&nbsp;|| </>
                    ) : (
                        <>&lt;&lt; <s>prev</s>&nbsp;&nbsp;|| </>
                    )}
                    <a href="#" onClick={() => props.closePhotoDisplay()}>close</a>
                    {props.currentIndex < (photosListMiniAllPhotos.length - 1) ? (
                        <> ||&nbsp;&nbsp;<a href="#" onClick={() => lockNavigate(nextPhoto)}>next &gt;&gt;</a><br /></>
                    ) : (
                        <> ||&nbsp;&nbsp;<s>next</s> &gt;&gt;<br /></>
                    )}

                    {/* In trash mode, wait for photo data to be ready to get correct trash path */}
                    {isTrashMode && !photosWithMethods[props.currentIndex] ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
                            Loading...
                        </div>
                    ) : (
                        <PhotoDisplay
                            imgStyle={imgStyle}
                            SetImgStyle={SetImgStyle}
                            setPhotoZoom={setPhotoZoom}
                            photoZoom={photoZoom}
                            photoZoomReady={photoZoomReady}
                            currentPhotoPath={photosWithMethods[props.currentIndex]
                                ? photosWithMethods[props.currentIndex].displayPath()
                                : props.currentPhotoPath}
                            currentPhotoSize={currentPhotoSize}
                            imgCacheMap={imgCacheMap}
                            thumbnailSrc={photosWithMethods[props.currentIndex]?.hasThumbnail
                                ? photosWithMethods[props.currentIndex].thumbnailPath()
                                : ""}
                            photosListMiniClosed={photosListMiniClosed}
                            selectedInfoHidden={selectedInfoHidden}
                            unselectedInfoHidden={unselectedInfoHidden}
                            selectedContent={selectedContent}
                            unselectedContent={unselectedContent}
                            currentPhotoCssStyle={photosWithMethods[props.currentIndex]?.cssStyle}
                            orientation={photosWithMethods[props.currentIndex]?.meta_data?.orientation}
                            thumbnailOrientationCorrection={thumbnailOrientationCorrection}
                            progressiveImageLoading={progressiveImageLoading}
                            togglePhotoSelected={togglePhotoSelected}
                            burstRestrictionsActive={burstRestrictionsActive}
                            burstModeEnabled={burstModeEnabled}
                            isBurstRepresentative={isBurstRepresentative}
                            burstGroupId={currentPhoto?.burst_group_id}
                            burstCount={currentPhoto?.burst_count}
                            openBurstGroup={props.openBurstGroup}
                            goBackFromBurstGroup={handleGoBackFromBurstGroup}
                            isInBurstGroupMode={isInBurstGroupMode}
                            currentViewMode={viewMode}
                            currentViewModeData={{
                                date: props.currentDate,
                                albumId: props.albumId,
                                albumName: props.albumName,
                                currentPhotoPath: props.currentPhotoPath,
                                currentPhotoIndex: props.currentIndex
                            }}
                        />
                    )}

                    <AlbumModeIndicator
                        isAlbumMode={isAlbumMode}
                        isTagMode={isTagMode}
                        isInBurstGroupMode={isInBurstGroupMode}
                        albumName={props.albumName}
                        tagName={props.tagName}
                    />
                </div>

                <div id="photos-list-mini" className={photosListMiniClosed ? "photosListMiniClosed" : "photosListMini"}>
                    <div className="row1">
                        <a style={{ display: showPrev ? "" : "none" }} onClick={backwardPhotos}>◁</a>
                    </div>
                    {showPhotosIndex.map((vIndex, i) => {
                        const photo = photosWithMethods[vIndex];
                        if (!photo || !photo.originalPath) return null;
                        return (
                            <ThumbnailRenderer
                                key={`${vIndex}-${photo.originalPath}`}
                                photo={photo}
                                vIndex={vIndex}
                                displayIndex={i}
                                borderStyle={borderStyle[i]}
                                maxHeight={thumbnailMaxHeight}
                                thumbnailOrientationCorrection={thumbnailOrientationCorrection}
                                onThumbnailClick={goToPhoto}
                                onBurstBadgeClick={props.openBurstGroup}
                                importState={importState}
                                imgSrcCache={photosListImgSrc}
                                setImgSrcCache={setPhotosListImgSrc}
                                isInBurstGroupMode={isInBurstGroupMode}
                            />
                        );
                    })}
                    <div className="row1">
                        <a style={{ display: showNext ? "" : "none" }} onClick={forwardPhotos}>▷</a>
                    </div>
                </div>

                <div style={{ textAlign: "center", width: "100%", margin: "0px", padding: "0px" }}>
                    <a href="#" onClick={() => { setPhotosListMiniClosed(!photosListMiniClosed); document.querySelector("#dummy-for-focus")?.focus(); }}>
                        {photosListMiniClosed ? "△ open mini list △" : "▽ close mini list ▽"}
                    </a>
                </div>

                <HelpPanel
                    show={showHelp}
                    onClose={() => setShowHelp(false)}
                    isImportMode={isImportMode}
                    isTrashMode={isTrashMode}
                    isAlbumMode={isAlbumMode}
                    isTagMode={isTagMode}
                    burstRestrictionsActive={burstRestrictionsActive}
                />
            </div>

            <ContextualDeleteModal
                isOpen={showDeleteModal}
                operation={deleteOperation}
                photoPath={deleteTargetPath}
                albumName={props.albumName}
                tagName={props.tagName}
                onConfirm={handleConfirmAction}
                onCancel={closeDeleteModal}
            />
        </>
    );
}

export default PhotosListMini;
