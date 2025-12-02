import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import PhotoDisplay from "./PhotosListMini/PhotoDisplay.jsx";
import { ImgCacheContext, AllPhotosContext } from "../ImgCacheContext.jsx";
import ContextualDeleteModal from "../../components/ContextualDeleteModal.jsx";
import { logger } from "../../services/LoggerService.js";
import { Photo } from "../../domain/Photo.js";
import { parseCssStyle, calculateSimpleThumbnailDisplay, getDateKey as utilGetDateKey, createBorderStyles } from "./PhotosListMini/photoUtils.js";
import { useKeyboardShortcuts } from "./PhotosListMini/useKeyboardShortcuts.js";

const NUM_OF_PHOTO_LIST = 9;

function preventScroll(e) {
    e.preventDefault();
}

function PhotosListMini(props) {
    // Context
    const { imgCacheMap, setImgCacheMap } = useContext(ImgCacheContext);
    const { photosListMiniAllPhotos, setPhotosListMiniAllPhotos } = useContext(AllPhotosContext);

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
    const searchQuery = props.searchQuery || "";
    const onClearSearch = props.onClearSearch;
    const recentPhotosMode = props.recentPhotosMode || false;

    // State from original implementation - simplified
    const [showPhotosIndex, setShowPhotosIndex] = useState([]);
    const [borderStyle, setBorderStyle] = useState([]);
    const [currentPhotoSize, setCurrentPhotoSize] = useState([]);
    const [photoZoomReady, setPhotoZoomReady] = useState(false);
    const [photoZoom, setPhotoZoom] = useState("auto");
    const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
    const [imgStyle, setImgStyle] = useState({
        transition: 'opacity 0.1s',
        opacity: 0.5,
        overflow: "hidden"
    });
    const [thumbnailStore, setThumbnailStore] = useState("");
    const [photosListImgSrc, setPhotosListImgSrc] = useState({});
    const [photosListMiniClosed, setPhotosListMiniClosed] = useState(false);
    const [selectedInfoHidden, setSelectedInfoHidden] = useState(true);
    const [unselectedInfoHidden, setUnselectedInfoHidden] = useState(true);
    const [selectedContent, setSelectedContent] = useState("");
    const [unselectedContent, setUnselectedContent] = useState("");
    const [showHelp, setShowHelp] = useState(false);

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteOperation, setDeleteOperation] = useState(null); // 'removeFromAlbum' | 'deleteFile'


    const navigateLock = useRef(false);

    // Check if we're in album mode
    const isAlbumMode = props.albumId !== undefined && props.albumId !== null;

    // Helper function to get the correct date key for pagination
    const getDateKey = () => {
        return utilGetDateKey(recentPhotosMode, isSearchMode, props.currentDate);
    };

    const handleClick = useCallback((e) => {
        // 既存の操作系（input／button など）をクリックした時は奪わない
        const interactive = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'];
        if (interactive.includes(e.target.tagName)) return;
        document.querySelector("#dummy-for-focus").focus();
    }, []);

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
        });
    }, [])

    // Set initial focus for keyboard navigation
    useEffect(() => {
        // Focus the dummy element when component mounts or when photo display is shown
        const dummyFocus = document.querySelector("#dummy-for-focus");
        if (dummyFocus) {
            dummyFocus.focus();
        }
    }, [props.showPhotoDisplay])

    // Handle date changes - clear thumbnail cache and reset state
    useEffect(() => {
        // Clear cached thumbnail sources when date changes
        setPhotosListImgSrc({});
    }, [props.currentDate]);

    useEffect(() => {
        const currentPhotoIndex = props.currentIndex; // Use the corrected global index
        const loadedCount = photosWithMethods.length;


        if (loadedCount > 0 && currentPhotoIndex >= 0) {
            adjustCurrentIndex();
        } else {
        }
    }, [props.currentIndex, props.reread, photosWithMethods.length, props.currentDate]);

    // Note: Removed redundant useEffect to prevent conflicts
    // Thumbnail display adjustment is now handled in the main useEffect above

    // Note: hasNext is no longer needed since we load all photos at once

    function backwardPhotos() {
        const totalPhotos = photosWithMethods.length;
        const { showPrev, startIndex } = calculateSimpleThumbnailDisplay(photosWithMethods, props.currentIndex);
        if (!showPrev) return;

        // Shift window backward by recalculating with simple logic
        const newSelectedIndex = Math.max(0, startIndex - 1);

        // Navigate to a photo that would shift the window
        if (photosWithMethods[newSelectedIndex]) {
            props.setCurrentIndex(newSelectedIndex);
            props.setCurrentPhotoPath(photosWithMethods[newSelectedIndex].originalPath);
            setImageCache(newSelectedIndex, -1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    function forwardPhotos() {
        const totalPhotos = photosWithMethods.length;
        const { showNext, endIndex } = calculateSimpleThumbnailDisplay(photosWithMethods, props.currentIndex);
        if (!showNext) return;

        // Shift window forward by recalculating with simple logic
        const newSelectedIndex = Math.min(totalPhotos - 1, endIndex + 1);

        // Navigate to a photo that would shift the window
        if (photosWithMethods[newSelectedIndex]) {
            props.setCurrentIndex(newSelectedIndex);
            props.setCurrentPhotoPath(photosWithMethods[newSelectedIndex].originalPath);
            setImageCache(newSelectedIndex, 1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    async function setImageCache(i, direction) {
        let minIndex = i - (direction == -1 ? 4 : 2)
        let maxIndex = i + (direction == 1 ? 4 : 2)
        const cacheCandidates = []
        const thisTimeCacheMap = {}
        if (minIndex < 0) minIndex = 0;
        if (maxIndex >= photosWithMethods.length) maxIndex = photosWithMethods.length - 1;

        for (let j = minIndex; j <= maxIndex; j++) {
            if (!photosWithMethods[j] || !photosWithMethods[j].originalPath?.match(/\.jpe?g/i)) {
                continue
            }
            const f = photosWithMethods[j].originalPath
            thisTimeCacheMap[f] = true
            if (!imgCacheMap[f]) {
                cacheCandidates.push(j) // Store index instead of just path
            }
        }
        for (let j = 0; j < cacheCandidates.length; j++) {
            const photoIndex = cacheCandidates[j]
            const photo = photosWithMethods[photoIndex]
            const f = photo.originalPath
            // Use Photo entity displayPath method
            const displayPath = photo.displayPath()
            const response = await fetch(convertFileSrc(displayPath), { cache: "force-cache" })
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);
            imgCacheMap[f] = [objectURL];
            setImgCacheMap(imgCacheMap)
        }
        const keys = Object.keys(imgCacheMap)
        keys.forEach((v) => {
            if (!thisTimeCacheMap[v]) {
                delete imgCacheMap[v];
            }
        });
        setImgCacheMap(imgCacheMap)
    }

    function _movePhotos(index) {
        props.setCurrentIndex(index);

        // Use the new simple thumbnail display logic
        const { startIndex, endIndex, borderPosition } = calculateSimpleThumbnailDisplay(photosWithMethods, index);


        const photosIndex = [];
        for (let i = startIndex; i <= endIndex && i < photosWithMethods.length; i++) {
            if (photosWithMethods[i]) {
                photosIndex.push(i);
            }
        }

        // Update both at the same time to ensure consistency
        setShowPhotosIndex(photosIndex);

        // Create border styles using extracted utility
        const newBorderStyle = createBorderStyles(photosIndex.length, borderPosition);
        setBorderStyle(newBorderStyle);

    }

    // Note: loadAllPhotosMetadata function removed - PhotosList should provide all photos data
    // Note: calculateSimpleThumbnailDisplay moved to photoUtils.js

    function adjustCurrentIndex() {
        const totalPhotos = photosWithMethods.length;
        const selectedIndex = props.currentIndex;


        if (totalPhotos === 0 || selectedIndex === undefined || selectedIndex === null || selectedIndex < 0 || selectedIndex >= totalPhotos) {
            logger.warn('PhotosListMini', 'adjust_invalid_state', 'Invalid state for index adjustment', {
                totalPhotos: totalPhotos,
                selectedIndex: selectedIndex
            });
            // Reset to safe state
            setShowPhotosIndex([]);
            setBorderStyle([]);
            return;
        }


        // Use the new simple thumbnail display logic
        const { startIndex, endIndex, borderPosition, showPrev, showNext } = calculateSimpleThumbnailDisplay(photosWithMethods, selectedIndex);


        const photosIndex = [];
        for (let i = startIndex; i <= endIndex && i < totalPhotos; i++) {
            if (photosWithMethods[i]) {
                photosIndex.push(i);
            }
        }


        // Update both at the same time to ensure consistency
        setShowPhotosIndex(photosIndex);

        // Create border styles using extracted utility
        const newBorderStyle = createBorderStyles(photosIndex.length, borderPosition);
        setBorderStyle(newBorderStyle);

    }

    // Note: resetSelectedBorder function removed - border styles are now created directly in adjustCurrentIndex

    function SetImgStyle(style, w, h) {
        setImgStyle(prevStyle => ({ ...prevStyle, ...style }));
        if (w && h) {
            setCurrentPhotoSize([w, h]);
        }
    }


    // Navigation functions
    const lockNavigate = (fn) => {
        if (navigateLock.current) return;
        navigateLock.current = true;
        fn();
        setTimeout(() => {
            navigateLock.current = false;
        }, 100);
    };

    function nextPhoto() {
        const nextIndex = props.currentIndex + 1;


        if (nextIndex < photosWithMethods.length) {
            _nextOrPrevPhoto(nextIndex);
            setImageCache(nextIndex, 1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    function prevPhoto() {
        const prevIndex = props.currentIndex - 1;


        if (prevIndex >= 0) {
            _nextOrPrevPhoto(prevIndex);
            setImageCache(prevIndex, -1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    // Note: updateThumbnailDisplay function removed - using adjustCurrentIndex for all thumbnail updates

    function _nextOrPrevPhoto(index) {
        const currentW = currentPhotoSize[0];
        const currentH = currentPhotoSize[1];
        if (currentW && currentH) {
            SetImgStyle({ opacity: 0 }, currentW, currentH);
        } else {
            SetImgStyle({ opacity: 0 });
        }
        // Don't reset zoom when navigating photos
        // setPhotoZoom("auto");
        if (photosWithMethods[index]) {
            props.setCurrentPhotoPath(photosWithMethods[index].originalPath);
            props.datePage[getDateKey()] = Math.trunc((index) / props.num) + 1;
            props.setCurrentIndex(index);
        }
    }

    // Restored keyboard functions from main branch
    function photoNavigationUp(e) {
        if (e.ctrlKey) {
            setPhotoZoomReady(false);
            window.removeEventListener('wheel', preventScroll, { passive: false });
        }
    }

    function changeStar(isIncrease, additionalMessage) {
        invoke("get_photo_info", { pathStr: props.currentPhotoPath }).then((r) => {
            let data = JSON.parse(r);
            let star = 0;
            let curStar = 0;
            if (data.meta) {
                curStar = data.meta.star.data || 0;
                if (isIncrease) {
                    if (curStar < 5) {
                        star = curStar + 1;
                    } else {
                        star = 5;
                    }
                } else if (!isIncrease && curStar > 0) {
                    star = curStar - 1;
                }
            }
            let stars = ["☆", "☆", "☆", "☆", "☆"];
            let newStar = [false, false, false, false, false];
            for (let i = 0; i < star; i++) {
                stars[i] = "★";
                newStar[i] = true;
            }
            props.setStar(newStar);
            let c = "Star: " + stars.join("")
            if (additionalMessage && additionalMessage !== "") {
                c = additionalMessage + "<br />" + c;
            }
            setSelectedContent(c);
            setTimeout(() => {
                setSelectedInfoHidden(true);
            }, 700)
            setSelectedInfoHidden(false);
            invoke("save_star", { pathStr: props.currentPhotoPath, starNum: star });
        });
    }

    function togglePhotoSelected() {
        const t = props.toggleSelection(props.currentPhotoPath);
        setTimeout(() => {
            if (t) {
                setSelectedInfoHidden(true);
            } else {
                setUnselectedInfoHidden(true);
            }
        }, 700)
        if (t) {
            setSelectedContent("Photo is selected")
            setSelectedInfoHidden(false);
        } else {
            setUnselectedContent("Photo is unselected")
            setUnselectedInfoHidden(false);
        }
    }

    // Modal handlers
    const showRemoveFromAlbumModal = () => {
        setDeleteOperation('removeFromAlbum');
        setShowDeleteModal(true);
    };

    const showDeleteFileModal = () => {
        setDeleteOperation('deleteFile');
        setShowDeleteModal(true);
    };

    const handleConfirmAction = async () => {
        const currentPhoto = photosWithMethods[props.currentIndex];
        if (!currentPhoto) return;

        try {
            if (deleteOperation === 'removeFromAlbum') {
                await invoke('remove_photo_from_album', {
                    albumId: props.albumId,
                    photoPath: currentPhoto.originalPath
                });

                logger.info('PhotosListMini', 'photo_removed_from_album', 'Photo removed from album', {
                    albumId: props.albumId,
                    photoPath: currentPhoto.originalPath
                });

                // Remove from current view
                props.removePhotoFromList?.(props.currentIndex);
                props.addFooterMessage?.('Photo removed from album');
            } else {
                await props.moveToTrashCan(currentPhoto.originalPath);

                logger.info('PhotosListMini', 'photo_deleted', 'Photo moved to trash', {
                    photoPath: currentPhoto.originalPath
                });

                // Photo removal is handled by moveToTrashCan
                props.addFooterMessage?.('Photo deleted');
            }
        } catch (error) {
            logger.error('PhotosListMini', 'action_failed', 'Failed to perform action', {
                operation: deleteOperation,
                error: error.message
            });
            props.handleTauriError?.(error, deleteOperation === 'removeFromAlbum' ? 'Remove from album' : 'Delete photo');
        } finally {
            setShowDeleteModal(false);
            setDeleteOperation(null);
        }
    };

    // Keyboard navigation - restored from main branch
    function photoNavigation(e) {
        let f = props.currentPhotoPath;
        if (e.keyCode === 39) { // right arrow
            e.preventDefault();
            nextPhoto();
        } else if (e.keyCode === 37) { // left arrow
            e.preventDefault();
            prevPhoto();
        } else if (e.keyCode === 38) { // up arrow ... open mini list
            e.preventDefault();
            setPhotosListMiniClosed(false);
        } else if (e.keyCode === 40) { // down arrow ... close mini list
            e.preventDefault();
            setPhotosListMiniClosed(true);
        } else if (e.keyCode === 67) { // c ... choose as selected
            togglePhotoSelected();
        } else if (e.keyCode === 83) { // s ... increase star
            changeStar(true);
        } else if (e.keyCode === 68) { // d ... declease star
            changeStar(false);
        } else if (e.keyCode === 73) { // i ... toggle show photo info
            props.setShowSideMenu(!props.showSideMenu);
        } else if (e.keyCode === 70) { // f ... c & s
            let additionalMessage = "Photo is selected";
            if (props.isSelected(f)) {
                additionalMessage = "Photo is already selected";
            } else {
                props.toggleSelection(props.currentPhotoPath);
            }
            changeStar(true, additionalMessage);
        } else if (e.keyCode === 191) { // ? ... show help
            setShowHelp(!showHelp);
        } else if (e.keyCode === 46) { // Del
            e.preventDefault(); // Prevent default behavior

            if (isAlbumMode) {
                if (e.ctrlKey) {
                    // Ctrl+DEL: Delete file AND remove from album
                    logger.info('PhotosListMini', 'delete_key_pressed', 'Ctrl+DEL pressed in album mode', {
                        albumId: props.albumId,
                        photoPath: f
                    });
                    showDeleteFileModal();
                } else {
                    // DEL only: Remove from album (safer default)
                    logger.info('PhotosListMini', 'delete_key_pressed', 'DEL pressed in album mode', {
                        albumId: props.albumId,
                        photoPath: f
                    });
                    showRemoveFromAlbumModal();
                }
            } else {
                // Date/Search mode: DEL deletes file (current behavior)
                logger.info('PhotosListMini', 'delete_key_pressed', 'DEL pressed in library mode', {
                    photoPath: f
                });
                showDeleteFileModal();
            }
        } else if (e.ctrlKey && e.keyCode === 48) { // ctrl+0
            setPhotoZoom("auto");
            // Reset to wrapper size using fixed pixel sizes
            const wrapperDiv = document.querySelector('#imageWrapper');
            if (wrapperDiv) {
                const wrapperWidth = parseFloat(wrapperDiv.style.width);
                const wrapperHeight = parseFloat(wrapperDiv.style.height);
                SetImgStyle({ width: wrapperWidth + 'px', height: wrapperHeight + 'px', opacity: '100%' });
            } else {
                SetImgStyle({ width: '100%', height: '100%', opacity: '100%' });
            }
            document.querySelector("#dummy-for-focus").focus();
        } else if (!photoZoomReady && e.ctrlKey) {
            setPhotoZoomReady(true);
            window.addEventListener('wheel', preventScroll, { passive: false });
        }
    }

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
                        onKeyDown={(e) => photoNavigation(e)}
                        onKeyUp={(e) => photoNavigationUp(e)}
                        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                    >{/* Dummy for keyboard focus */}</a>
                    {props.currentIndex > 0 ?
                        <><a href="#" onClick={() => lockNavigate(prevPhoto)}>&lt;&lt; prev</a>&nbsp;&nbsp;|| </> :
                        <>&lt;&lt; <s>prev</s>&nbsp;&nbsp;|| </>
                    }
                    <a href="#" onClick={() => props.closePhotoDisplay()}>close</a>
                    {props.currentIndex < (photosListMiniAllPhotos.length - 1) ?
                        <> ||&nbsp;&nbsp;<a href="#" onClick={() => lockNavigate(nextPhoto)}>next &gt;&gt;</a><br /><br /></>
                        : <> ||&nbsp;&nbsp;<s>next</s> &gt;&gt;<br /><br /></>
                    }

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
                        <a style={{ display: calculateSimpleThumbnailDisplay(photosWithMethods, props.currentIndex).showPrev ? "" : "none" }} onClick={() => { backwardPhotos() }}>◁</a>
                    </div>
                    {showPhotosIndex.map((vIndex, i) => {
                        // Strict validation to prevent rendering invalid photos
                        if (typeof vIndex !== 'number' || vIndex < 0 || vIndex >= photosWithMethods.length) {
                            logger.warn('PhotosListMini', 'thumbnail_invalid_index', 'Invalid index for thumbnail', {
                                vIndex: vIndex,
                                arrayLength: photosWithMethods.length
                            });
                            return null;
                        }

                        let v = photosWithMethods[vIndex];

                        // Skip if photo doesn't exist at this index
                        if (!v || !v.originalPath) {
                            logger.warn('PhotosListMini', 'thumbnail_invalid_photo', 'Photo at index is undefined or missing originalPath', {
                                vIndex: vIndex,
                                hasPhoto: !!v,
                                hasOriginalPath: !!(v && v.originalPath)
                            });
                            return null; // Don't render anything for missing photos
                        }

                        const clientHeight = document.querySelector('#photos-list-mini')?.clientHeight - 20 || 80;

                        // Use Photo entity methods for thumbnail path
                        // Initialize image source if not already set
                        if (!photosListImgSrc[v.originalPath]) {
                            if (v.import_source === true) {
                                // Import mode: Get cache thumbnail path (may not exist yet)
                                if (!v._cachedThumbnailPath) {
                                    invoke('get_thumbnail_path', { photoPath: v.originalPath })
                                        .then(cachePath => {
                                            v._cachedThumbnailPath = convertFileSrc(cachePath);
                                            // Update if already rendered with empty string
                                            if (photosListImgSrc[v.originalPath] === "") {
                                                photosListImgSrc[v.originalPath] = v._cachedThumbnailPath;
                                                // Trigger re-render
                                                setPhotosListImgSrc({...photosListImgSrc});
                                            }
                                        })
                                        .catch(err => {
                                            logger.warn('PhotosListMini', 'thumbnail_path_failed', 'Failed to get thumbnail cache path', {
                                                photoPath: v.originalPath,
                                                error: err.message
                                            });
                                        });
                                }
                                // Set empty string initially (will trigger onError if not exists)
                                photosListImgSrc[v.originalPath] = v._cachedThumbnailPath || "";
                            } else if (v.hasThumbnail) {
                                // Normal mode: Use existing thumbnail
                                const thumbnailSrc = v.thumbnailPath();
                                photosListImgSrc[v.originalPath] = convertFileSrc(thumbnailSrc);
                            } else {
                                // Normal mode without thumbnail: Use original
                                const displayPath = v.displayPath();
                                photosListImgSrc[v.originalPath] = convertFileSrc(displayPath);
                            }
                        }

                        return <div className="row2" key={`${vIndex}-${v.originalPath}`} style={{ position: "relative" }}>
                            <a onClick={(e) => {
                                props.setCurrentIndex(vIndex);
                                props.setCurrentPhotoPath(v.originalPath);
                                props.datePage[getDateKey()] = Math.trunc((vIndex) / props.num) + 1;
                                setImageCache(vIndex, 0);

                                // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
                            }}>
                                {!v.hasThumbnail && v.originalPath?.match(/\.(mp4|webm)$/i)
                                    ? <div className="photo-list-movie" style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }}>
                                        <span>🎬</span>
                                    </div>
                                    : <>
                                        <img src={photosListImgSrc[v.originalPath]}
                                            style={{
                                                border: borderStyle[i],
                                                maxHeight: clientHeight + "px",
                                                ...parseCssStyle(v.cssStyle)
                                            }}
                                            alt={"photo-" + i}
                                            onError={(e) => {
                                                // Only handle error if not already showing error image
                                                if (e.target.src.includes('/img_error.png')) {
                                                    return;
                                                }

                                                // Import mode: on-demand thumbnail generation
                                                if (v.import_source === true) {
                                                    // Step 1: Generate thumbnail
                                                    if (!e.target.dataset.thumbnailGenerated) {
                                                        e.target.dataset.thumbnailGenerated = 'true';
                                                        const imgElement = e.target;

                                                        logger.debug('PhotosListMini', 'thumbnail_generation_started', 'Generating thumbnail on demand', {
                                                            photoPath: v.originalPath
                                                        });

                                                        invoke('get_resized_image', {
                                                            pathStr: v.originalPath,
                                                            maxSize: 200
                                                        })
                                                            .then(() => {
                                                                logger.debug('PhotosListMini', 'thumbnail_generated', 'Thumbnail generated successfully', {
                                                                    photoPath: v.originalPath
                                                                });
                                                                return invoke('get_thumbnail_path', { photoPath: v.originalPath });
                                                            })
                                                            .then(cachePath => {
                                                                const thumbnailUrl = convertFileSrc(cachePath) + '?t=' + Date.now();
                                                                logger.debug('PhotosListMini', 'thumbnail_retry', 'Retrying with generated thumbnail', {
                                                                    photoPath: v.originalPath,
                                                                    thumbnailUrl
                                                                });
                                                                if (imgElement) {
                                                                    imgElement.src = thumbnailUrl;
                                                                }
                                                            })
                                                            .catch(err => {
                                                                logger.error('PhotosListMini', 'thumbnail_generation_failed', 'Failed to generate thumbnail', {
                                                                    photoPath: v.originalPath,
                                                                    error: err.message
                                                                });
                                                                // Fallback to original
                                                                if (imgElement && !imgElement.dataset.triedOriginal) {
                                                                    imgElement.dataset.triedOriginal = 'true';
                                                                    imgElement.src = convertFileSrc(v.originalPath);
                                                                }
                                                            });
                                                        return;
                                                    }

                                                    // Step 2: Thumbnail generation failed, try original
                                                    if (!e.target.dataset.triedOriginal) {
                                                        e.target.dataset.triedOriginal = 'true';
                                                        logger.warn('PhotosListMini', 'thumbnail_failed_fallback_original', 'Falling back to original image', {
                                                            photoPath: v.originalPath
                                                        });
                                                        e.target.src = convertFileSrc(v.originalPath);
                                                        return;
                                                    }

                                                    // Step 3: Final fallback
                                                    logger.error('PhotosListMini', 'import_photo_error', 'All fallbacks failed for import photo', {
                                                        photoPath: v.originalPath
                                                    });
                                                    e.target.src = "/img_error.png";
                                                    return;
                                                }

                                                // Normal mode: existing fallback logic
                                                if (v.hasThumbnail && !e.target.dataset.triedOriginal) {
                                                    // Mark that we've tried original to prevent infinite loop
                                                    e.target.dataset.triedOriginal = "true";
                                                    // Try original image as fallback
                                                    const originalSrc = convertFileSrc(v.displayPath());
                                                    e.target.src = originalSrc;
                                                } else {
                                                    // Final fallback: show error image
                                                    e.target.src = "/img_error.png";
                                                }
                                            }} />
                                        {v.originalPath?.match(/\.(mp4|webm)$/i) && <div style={{ color: "white", position: "relative", top: clientHeight / -4 }}>▶</div>}
                                    </>
                                }
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
                                    {v.star > 0 && (
                                        <span>⭐{v.star}</span>
                                    )}
                                    {v.comment && (
                                        <span>💬</span>
                                    )}
                                </div>
                            )}
                        </div>
                    })}
                    <div className="row1">
                        <a style={{ display: calculateSimpleThumbnailDisplay(photosWithMethods, props.currentIndex).showNext ? "" : "none" }} onClick={() => { forwardPhotos() }}>▷</a>
                    </div>
                </div >

                <div style={{ textAlign: "center", width: "100%", margin: "0px 0px 0px 0px", padding: "0px 0px 0px 0px" }}>
                    <a href="#" onClick={() => { setPhotosListMiniClosed(!photosListMiniClosed); document.querySelector("#dummy-for-focus").focus(); }}>
                        {photosListMiniClosed ? "△ open mini list △" : "▽ close mini list ▽"}
                    </a>
                </div>

                <div id="help" className={(showHelp ? "" : " hidden")} onClick={() => { setShowHelp(false); document.querySelector("#dummy-for-focus").focus(); }}>
                    <h1>Help</h1>
                    <table>
                        <tr><th>Right/Left Arrow</th><td>navigate photos</td></tr>
                        <tr><th>Up Arrow/Down Arrow</th><td>Open/Close mini list</td></tr>
                        <tr><th>Ctrl + Mouse Wheel</th><td>zoom photo</td></tr>
                        <tr><th>Ctrl + Drag</th><td>drag photo while zooming</td></tr>
                        <tr><th>Ctrl + 0</th><td>reset zoom</td></tr>
                        <tr><th>S</th><td>increase star</td></tr>
                        <tr><th>D</th><td>decrease star</td></tr>
                        <tr><th>I</th><td>toggle photo info</td></tr>
                        <tr><th>Del</th><td>{isAlbumMode ? "remove from album" : "move to trash can"}</td></tr>
                        {isAlbumMode && <tr><th>Ctrl + Del</th><td>delete file permanently</td></tr>}
                        <tr><th>?</th><td>toggle showing this help</td></tr>
                    </table>
                </div>

                {/* Mode indicator - only show in album mode */}
                {isAlbumMode && (
                    <div style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        zIndex: 1000
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div>📚 {props.albumName || 'Album'}</div>
                            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                                DEL: Remove | Ctrl+DEL: Delete
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Context-aware delete modal */}
            <ContextualDeleteModal
                isOpen={showDeleteModal}
                operation={deleteOperation}
                photoPath={photosWithMethods[props.currentIndex]?.originalPath}
                albumName={props.albumName}
                onConfirm={handleConfirmAction}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeleteOperation(null);
                }}
            />
        </>
    )
}

export default PhotosListMini;
