import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import PhotoDisplay from "./PhotosListMini/PhotoDisplay.jsx";
import { ImgCacheContext, AllPhotosContext } from "../ImgCacheContext.jsx";
import ContextualDeleteModal from "../../components/ContextualDeleteModal.jsx";
import { logger } from "../../services/LoggerService.js";
import { Photo } from "../../domain/Photo.js";
import { parseCssStyle, calculateSimpleThumbnailDisplay, getDateKey as utilGetDateKey, createBorderStyles } from "./PhotosListMini/photoUtils.js";
import { useKeyboardShortcuts } from "./PhotosListMini/useKeyboardShortcuts.js";
import { useDeletionOperations } from "./PhotosListMini/useDeletionOperations.js";
import { usePhotoNavigation } from "./PhotosListMini/usePhotoNavigation.js";
import { useStarOperations } from "./PhotosListMini/useStarOperations.js";
import HelpPanel from "./PhotosListMini/HelpPanel.jsx";
import AlbumModeIndicator from "./PhotosListMini/AlbumModeIndicator.jsx";
import { useUI } from "../../context/UIContext.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";
import { getCombinedTransformStyle } from "../../utils/orientationUtils.js";

function PhotosListMini(props) {
    // Context
    const { imgCacheMap, setImgCacheMap } = useContext(ImgCacheContext);
    const { photosListMiniAllPhotos, setPhotosListMiniAllPhotos } = useContext(AllPhotosContext);
    const { viewMode } = useUI();

    // Determine modes from viewMode
    const isImportMode = viewMode === VIEW_MODES.IMPORT;
    const isTrashMode = viewMode === VIEW_MODES.TRASH;

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

    // Check if we're in album mode
    const isAlbumMode = props.albumId !== undefined && props.albumId !== null;

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
        setImgCacheMap
    });

    // Use star operations hook
    const {
        changeStar,
        togglePhotoSelected,
        favoritePhoto,
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
        isAlbumMode,
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

    // Use keyboard shortcuts hook
    const { photoNavigation, photoNavigationUp } = useKeyboardShortcuts(
        {
            nextPhoto,
            prevPhoto,
            togglePhotoSelected,
            changeStar,
            favoritePhoto,
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
            albumId: props.albumId,
            currentPhotoPath: props.currentPhotoPath,
            showSideMenu: props.showSideMenu,
            showHelp,
            photoZoomReady
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
    }, [props.currentIndex, props.reread, photosWithMethods.length, props.currentDate]);

    function adjustCurrentIndex() {
        const totalPhotos = photosWithMethods.length;
        const selectedIndex = props.currentIndex;

        if (totalPhotos === 0 || selectedIndex === undefined || selectedIndex === null || selectedIndex < 0 || selectedIndex >= totalPhotos) {
            setShowPhotosIndex([]);
            setBorderStyle([]);
            return;
        }

        const { startIndex, endIndex, borderPosition } = calculateSimpleThumbnailDisplay(photosWithMethods, selectedIndex);

        const photosIndex = [];
        for (let i = startIndex; i <= endIndex && i < totalPhotos; i++) {
            if (photosWithMethods[i]) {
                photosIndex.push(i);
            }
        }

        setShowPhotosIndex(photosIndex);
        const newBorderStyle = createBorderStyles(photosIndex.length, borderPosition);
        setBorderStyle(newBorderStyle);
    }

    // Render thumbnail for a photo
    const renderThumbnail = useCallback((vIndex, i) => {
        if (typeof vIndex !== 'number' || vIndex < 0 || vIndex >= photosWithMethods.length) {
            return null;
        }

        let v = photosWithMethods[vIndex];
        if (!v || !v.originalPath) {
            return null;
        }

        const clientHeight = document.querySelector('#photos-list-mini')?.clientHeight - 20 || 80;

        // Initialize image source if not already set - use functional state update to avoid mutation
        let imgSrc = photosListImgSrc[v.originalPath];
        if (!imgSrc) {
            if (v.import_source === true) {
                if (!v._cachedThumbnailPath) {
                    const importDir = (v.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                        ? importState.currentImportPath
                        : null;
                    invoke('get_thumbnail_path', {
                        photoPath: v.originalPath,
                        importDirectory: importDir
                    })
                        .then(cachePath => {
                            v._cachedThumbnailPath = convertFileSrc(cachePath);
                            setPhotosListImgSrc(prev => {
                                if (!prev[v.originalPath] || prev[v.originalPath] === "") {
                                    return { ...prev, [v.originalPath]: v._cachedThumbnailPath };
                                }
                                return prev;
                            });
                        })
                        .catch(err => {
                            logger.debug('PhotosListMini', 'thumbnail_path_error', 'Failed to get thumbnail path', {
                                photoPath: v.originalPath,
                                error: err?.message || String(err)
                            });
                        });
                }
                imgSrc = v._cachedThumbnailPath || "";
            } else if (v.hasThumbnail) {
                imgSrc = convertFileSrc(v.thumbnailPath());
            } else {
                imgSrc = convertFileSrc(v.displayPath());
            }
            // Update state immutably if we computed a new value
            if (imgSrc) {
                setPhotosListImgSrc(prev => {
                    if (!prev[v.originalPath]) {
                        return { ...prev, [v.originalPath]: imgSrc };
                    }
                    return prev;
                });
            }
        }

        const handleThumbnailClick = () => {
            goToPhoto(vIndex);
        };

        const handleImgError = (e) => {
            if (e.target.src.includes('/img_error.png')) return;

            if (v.import_source === true) {
                if (!e.target.dataset.thumbnailGenerated) {
                    e.target.dataset.thumbnailGenerated = 'true';
                    const imgElement = e.target;
                    const importDir = (v.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                        ? importState.currentImportPath
                        : null;
                    invoke('get_resized_image', {
                        pathStr: v.originalPath,
                        maxSize: 200,
                        importDirectory: importDir,
                        skipResizeFallback: true
                    })
                        .then(() => invoke('get_thumbnail_path', { photoPath: v.originalPath, importDirectory: importDir }))
                        .then(cachePath => {
                            imgElement.src = convertFileSrc(cachePath) + '?t=' + Date.now();
                        })
                        .catch(() => {
                            if (imgElement && !imgElement.dataset.triedOriginal) {
                                imgElement.dataset.triedOriginal = 'true';
                                imgElement.src = convertFileSrc(v.originalPath);
                            }
                        });
                    return;
                }
                if (!e.target.dataset.triedOriginal) {
                    e.target.dataset.triedOriginal = 'true';
                    e.target.src = convertFileSrc(v.originalPath);
                    return;
                }
                e.target.src = "/img_error.png";
                return;
            }

            if (v.hasThumbnail && !e.target.dataset.triedOriginal) {
                e.target.dataset.triedOriginal = "true";
                e.target.src = convertFileSrc(v.displayPath());
            } else {
                e.target.src = "/img_error.png";
            }
        };

        const isMovie = !v.hasThumbnail && v.originalPath?.match(/\.(mp4|webm)$/i);

        return (
            <div className="row2" key={`${vIndex}-${v.originalPath}`} style={{ position: "relative" }}>
                <a onClick={handleThumbnailClick}>
                    {isMovie ? (
                        <div className="photo-list-movie" style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }}>
                            <span>🎬</span>
                        </div>
                    ) : (
                        <>
                            <img
                                src={imgSrc || photosListImgSrc[v.originalPath]}
                                style={{
                                    border: borderStyle[i],
                                    maxHeight: clientHeight + "px",
                                    ...(thumbnailOrientationCorrection
                                        ? getCombinedTransformStyle(v.meta_data?.orientation, v.cssStyle)
                                        : parseCssStyle(v.cssStyle))
                                }}
                                alt={"photo-" + i}
                                onError={handleImgError}
                            />
                            {v.originalPath?.match(/\.(mp4|webm)$/i) && (
                                <div style={{ color: "white", position: "relative", top: clientHeight / -4 }}>▶</div>
                            )}
                        </>
                    )}
                </a>

                {/* Metadata overlay - stars and comments */}
                {(v.star > 0 || v.comment) && (
                    <div style={{
                        position: "absolute",
                        top: "28px",
                        left: "2px",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        color: "white",
                        padding: "2px 4px",
                        borderRadius: "3px",
                        fontSize: "11px",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        pointerEvents: "none"
                    }}>
                        {v.star > 0 && <span>⭐{v.star}</span>}
                        {v.comment && <span>💬</span>}
                    </div>
                )}
            </div>
        );
    }, [photosWithMethods, photosListImgSrc, borderStyle, thumbnailOrientationCorrection, importState, goToPhoto]);

    const { showPrev, showNext } = calculateSimpleThumbnailDisplay(photosWithMethods, props.currentIndex);

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
                        <> ||&nbsp;&nbsp;<a href="#" onClick={() => lockNavigate(nextPhoto)}>next &gt;&gt;</a><br /><br /></>
                    ) : (
                        <> ||&nbsp;&nbsp;<s>next</s> &gt;&gt;<br /><br /></>
                    )}

                    <PhotoDisplay
                        imgStyle={imgStyle}
                        SetImgStyle={SetImgStyle}
                        setPhotoZoom={setPhotoZoom}
                        photoZoom={photoZoom}
                        photoZoomReady={photoZoomReady}
                        currentPhotoPath={props.isTrashMode && photosWithMethods[props.currentIndex]
                            ? photosWithMethods[props.currentIndex].displayPath()
                            : (props.currentPhotoPath || (photosWithMethods[props.currentIndex] && photosWithMethods[props.currentIndex].displayPath()))}
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
                    />
                </div>

                <div id="photos-list-mini" className={photosListMiniClosed ? "photosListMiniClosed" : "photosListMini"}>
                    <div className="row1">
                        <a style={{ display: showPrev ? "" : "none" }} onClick={backwardPhotos}>◁</a>
                    </div>
                    {showPhotosIndex.map((vIndex, i) => renderThumbnail(vIndex, i))}
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
                />

                <AlbumModeIndicator
                    isAlbumMode={isAlbumMode}
                    albumName={props.albumName}
                />
            </div>

            <ContextualDeleteModal
                isOpen={showDeleteModal}
                operation={deleteOperation}
                photoPath={deleteTargetPath}
                albumName={props.albumName}
                onConfirm={handleConfirmAction}
                onCancel={closeDeleteModal}
            />
        </>
    );
}

export default PhotosListMini;
