import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { openUrl } from '@tauri-apps/plugin-opener';
import fileUrl from "../../../PathUtil.jsx";
import { logger } from "../../../services/LoggerService.js";
import { getCombinedTransformStyle } from "../../../utils/orientationUtils.js";
import FaceBoundingBoxOverlay from "./FaceBoundingBoxOverlay.jsx";
import { useFaceDetection } from "../../../context/FaceDetectionContext.jsx";
import { usePhotoDisplayZoom } from "./hooks/usePhotoDisplayZoom.js";
import { BurstBadge, BurstGroupIndicator, FaceCountIndicator } from "./BurstOverlays.jsx";

// Layout and timing constants
const CONTAINER_READY_DELAY_MS = 50;
const VIDEO_SOURCE_DELAY_MS = 200;
const LOCK_RELEASE_DELAY_MS = 1000;
const VIDEO_HEIGHT_OFFSET = 150;
const CONTAINER_PADDING = 40;
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 100;
const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 600;
const SCROLL_LOCK_DELAY_MS = 100;
const FULL_IMAGE_LOAD_DELAY_MS = 300; // Delay before loading full image after navigation stops

// RAW file extensions that browsers cannot render natively
const RAW_EXTENSION_REGEX = /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|3fr)$/i;

let currentFile = "";
let width = 0;
let height = 0;

function PhotoDisplay(props) {
    const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");
    const [videoSource, setVideoSource] = useState("");
    const [videoClass, setVideoClass] = useState("video-off");
    const [photoDisplayWidth, setPhotoDisplayWidth] = useState("pdWidth");
    const [photoDisplayHeight, setPhotoDisplayHeight] = useState("pdHeight");

    // Progressive image loading state
    const [displaySrc, setDisplaySrc] = useState(""); // Currently displayed image source
    const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);
    const [isShowingThumbnail, setIsShowingThumbnail] = useState(false); // Track if currently showing thumbnail
    const fullImageLoadTimeoutRef = useRef(null);
    const fullImageRef = useRef(null); // Hidden img element for preloading

    // Face detection context - shared with PhotoFaces
    const { detectedFaces, showFaceBboxes, setShowFaceBboxes, isFaceTabActive, hoveredFaceId } = useFaceDetection();
    const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
    const [displayedImageSize, setDisplayedImageSize] = useState({ width: 0, height: 0 });
    const imgRef = useRef(null);

    // Zoom and drag functionality
    const { dragPhotoStart, dragPhoto, dragPhotoEnd, photoScroll } = usePhotoDisplayZoom({
        photoZoom: props.photoZoom,
        setPhotoZoom: props.setPhotoZoom,
        photoZoomReady: props.photoZoomReady,
        SetImgStyle: props.SetImgStyle,
        setDisplayedImageSize
    });

    // Function to parse CSS style string and convert to style object
    const parseCssStyle = (cssString) => {
        if (!cssString) return {};

        const styles = {};
        const declarations = cssString.split(';').filter(decl => decl.trim());

        declarations.forEach(declaration => {
            const [property, value] = declaration.split(':').map(s => s.trim());
            if (property && value) {
                // Convert CSS property names to camelCase for React
                const camelCaseProperty = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                styles[camelCaseProperty] = value;
            }
        });

        return styles;
    };

    useEffect((e) => {
        currentFile = "";
        document.querySelector("#dummy-for-focus")?.focus();

        const resizeHandler = () => {
            // Recalculate wrapper sizing on window resize
            if (width > 0 && height > 0) {
                // Small delay to ensure container has updated dimensions
                setTimeout(() => {
                    handleImgLoad(null, 0); // Recalculate wrapper size
                }, CONTAINER_READY_DELAY_MS);
            }
        };

        window.addEventListener('resize', resizeHandler);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', resizeHandler);
        };
    }, []);

    useEffect(() => {
        // Recalculate wrapper size when mini list is toggled
        // handleImgLoad is stable (defined in component scope) so we intentionally omit it
        // to prevent infinite loops while keeping the effect functional
        handleImgLoad(null, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.photosListMiniClosed])

    // Toggle face bbox visibility with 'f' key (only when Face tab is active)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && isFaceTabActive) {
                // Don't toggle if typing in an input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }
                setShowFaceBboxes(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFaceTabActive, setShowFaceBboxes]);

    // Update displayed image size when faces change or image style changes
    // This ensures face bounding boxes are positioned correctly after detection
    useLayoutEffect(() => {
        const updateSize = () => {
            if (imgRef.current) {
                const { offsetWidth, offsetHeight } = imgRef.current;
                if (offsetWidth > 0 && offsetHeight > 0) {
                    setDisplayedImageSize({ width: offsetWidth, height: offsetHeight });
                }
            }
        };

        // Update immediately
        updateSize();

        // Also update on next frame to ensure DOM has updated
        const rafId = requestAnimationFrame(updateSize);
        return () => cancelAnimationFrame(rafId);
    }, [detectedFaces, props.imgStyle]);

    useEffect((e) => {
        // Don't set opacity here - let handleImgLoad handle it when image is ready
        document.querySelector("#dummy-for-focus")?.focus();

        // Cancel any pending full image load
        if (fullImageLoadTimeoutRef.current) {
            clearTimeout(fullImageLoadTimeoutRef.current);
            fullImageLoadTimeoutRef.current = null;
        }

        // Small delay to ensure container is ready when transitioning from thumbnail view
        setTimeout(() => {
            if (props.currentDisplayPath && props.currentDisplayPath.match(/(mp4|webm)$/i)) {
                movie(props.currentDisplayPath);
                let photoDisplayDiv = document.querySelector('.photoDisplay');
                let width = photoDisplayDiv.clientWidth;
                let height = photoDisplayDiv.clientHeight - VIDEO_HEIGHT_OFFSET;

                setPhotoDisplayWidth(width + "px");
                setPhotoDisplayHeight(height + "px");
                setVideoClass("video-on");
                setDisplaySrc("");
            } else {
                setVideoClass("video-off");
                setVideoSource("");

                // Check if this is a RAW file
                const isRawFile = RAW_EXTENSION_REGEX.test(props.currentDisplayPath);

                if (isRawFile) {
                    // RAW files: use progressive loading via backend decode
                    setIsLoadingFullImage(true);
                    setIsShowingThumbnail(true);

                    // Show thumbnail if available
                    const thumbnailSrc = props.thumbnailSrc ? convertFileSrc(props.thumbnailSrc) : null;
                    if (thumbnailSrc) {
                        setDisplaySrc(thumbnailSrc);
                    }

                    const importDir = props.importState?.currentImportPath || null;
                    const currentPath = props.currentDisplayPath;

                    // Level 1: EXIF thumbnail (fast)
                    invoke('get_raw_progressive_image', {
                        pathStr: currentPath,
                        maxSize: 1600,
                        qualityLevel: 1,
                        importDirectory: importDir
                    }).then(exifPath => {
                        if (props.currentDisplayPath === currentPath) {
                            setDisplaySrc(convertFileSrc(exifPath) + '?t=' + Date.now());
                            setIsShowingThumbnail(true);
                            logger.debug('PhotoDisplay', 'raw_exif_loaded', 'RAW EXIF thumbnail loaded', {
                                path: currentPath
                            });
                        }
                    }).catch(() => {});

                    // Level 2: Full RAW decode (slow)
                    fullImageLoadTimeoutRef.current = setTimeout(() => {
                        invoke('get_raw_progressive_image', {
                            pathStr: currentPath,
                            maxSize: 1600,
                            qualityLevel: 2,
                            importDirectory: importDir
                        }).then(fullPath => {
                            if (props.currentDisplayPath === currentPath) {
                                const fullSrc = convertFileSrc(fullPath) + '?t=' + Date.now();
                                const preloadImg = new Image();
                                preloadImg.onload = () => {
                                    setDisplaySrc(fullSrc);
                                    setIsLoadingFullImage(false);
                                    setIsShowingThumbnail(false);
                                    width = preloadImg.naturalWidth;
                                    height = preloadImg.naturalHeight;
                                    logger.debug('PhotoDisplay', 'raw_full_loaded', 'RAW full decode loaded', {
                                        path: currentPath, width, height
                                    });
                                };
                                preloadImg.onerror = () => {
                                    setIsLoadingFullImage(false);
                                };
                                preloadImg.src = fullSrc;
                            }
                        }).catch(err => {
                            setIsLoadingFullImage(false);
                            logger.debug('PhotoDisplay', 'raw_full_decode_failed', 'RAW full decode failed', {
                                path: currentPath, error: err?.message || String(err)
                            });
                        });
                    }, FULL_IMAGE_LOAD_DELAY_MS);
                } else {
                // Non-RAW files: original logic
                // Get full image source
                const fullImageSrc = (props.imgCacheMap[props.currentDisplayPath] && props.imgCacheMap[props.currentDisplayPath][0])
                    || convertFileSrc(props.currentDisplayPath);
                const thumbnailSrc = props.thumbnailSrc ? convertFileSrc(props.thumbnailSrc) : null;

                // Progressive loading: Show thumbnail first if enabled and available
                if (props.progressiveImageLoading && thumbnailSrc) {
                    // Show thumbnail immediately
                    setDisplaySrc(thumbnailSrc);
                    setIsLoadingFullImage(true);
                    setIsShowingThumbnail(true);

                    // Schedule full image load after navigation stops
                    fullImageLoadTimeoutRef.current = setTimeout(() => {
                        // Preload full image in background
                        const preloadImg = new Image();
                        preloadImg.onload = () => {
                            // Switch to full image once loaded
                            setDisplaySrc(fullImageSrc);
                            setIsLoadingFullImage(false);
                            setIsShowingThumbnail(false);
                            // Trigger resize calculation with full image dimensions
                            width = preloadImg.naturalWidth;
                            height = preloadImg.naturalHeight;
                            logger.debug('PhotoDisplay', 'full_image_loaded', 'Switched to full image', {
                                path: props.currentDisplayPath,
                                width,
                                height
                            });
                        };
                        preloadImg.onerror = () => {
                            // Keep thumbnail on error
                            setIsLoadingFullImage(false);
                            logger.warn('PhotoDisplay', 'full_image_error', 'Failed to load full image', {
                                path: props.currentDisplayPath
                            });
                        };
                        preloadImg.src = fullImageSrc;
                    }, FULL_IMAGE_LOAD_DELAY_MS);
                } else {
                    // Progressive loading disabled or no thumbnail - show full image directly
                    setDisplaySrc(fullImageSrc);
                    setIsLoadingFullImage(false);
                    setIsShowingThumbnail(false);
                }
                } // end non-RAW
            }
        }, CONTAINER_READY_DELAY_MS);

        // Cleanup on unmount or path change
        return () => {
            if (fullImageLoadTimeoutRef.current) {
                clearTimeout(fullImageLoadTimeoutRef.current);
                fullImageLoadTimeoutRef.current = null;
            }
        };
    }, [props.currentDisplayPath, props.thumbnailSrc, props.imgCacheMap, props.progressiveImageLoading]);

    async function movie(path) {
        if (currentFile != path) {
            invoke("lock", { t: true }).then(async (r) => {
                // tauri cannot play movie file which is not in public folder. So copy movie file to public/movie
                const ext = path.split('.').pop();
                const result = await invoke("link_file_to_public", {
                    fromFilePath: path,
                    toFileName: "movie.tmp." + ext
                }).then((r) => {
                    let videoPath = "/movie.tmp." + ext + "?" + path;
                    currentFile = path;
                    // I don't know why it works only when set twice sometime.
                    setVideoSource("#");
                    // I don't know why react player require waiting for a while to play video correctly.
                    setTimeout(() => {
                        setVideoSource(videoPath);
                    }, VIDEO_SOURCE_DELAY_MS);
                });
                setTimeout(() => {
                    invoke("lock", { t: false })
                }, LOCK_RELEASE_DELAY_MS);
            })
        }
        return true;
    }

    const handleImgLoad = (e, retryCount = 0) => {
        // When showing thumbnail, skip recalculating wrapper size
        // Just scale thumbnail to fill existing wrapper using object-fit
        if (isShowingThumbnail) {
            // Apply style to fill wrapper while maintaining aspect ratio
            props.SetImgStyle({
                opacity: 1,
                transition: "opacity 0.3s",
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                maxWidth: '100%',
                maxHeight: '100%'
            });
            return;
        }

        if (e !== undefined && e !== null) {
            height = e.naturalHeight;
            width = e.naturalWidth;
            // Store natural size for face bbox positioning
            setImageNaturalSize({ width: e.naturalWidth, height: e.naturalHeight });
        }

        // Use the event target dimensions if available, otherwise use globals
        const imgWidth = e?.naturalWidth || width;
        const imgHeight = e?.naturalHeight || height;

        if (imgWidth > 0 && imgHeight > 0) {
            // Calculate wrapper size to contain whole image within #photo container
            const photoContainer = document.querySelector('#photo');
            const wrapperDiv = document.querySelector('#imageWrapper');
            
            if (photoContainer && wrapperDiv) {
                let availableWidth = photoContainer.clientWidth - CONTAINER_PADDING;
                let availableHeight = photoContainer.clientHeight - CONTAINER_PADDING;

                // Handle case where container dimensions are not ready on first load
                if ((availableWidth <= 0 || availableHeight <= 0) && retryCount < MAX_RETRY_COUNT) {
                    // Retry after a small delay to allow container to render
                    setTimeout(() => {
                        handleImgLoad(e, retryCount + 1);
                    }, RETRY_DELAY_MS);
                    // Set wrapper to reasonable default size as fallback
                    const fallbackWidth = Math.min(imgWidth, FALLBACK_WIDTH);
                    const fallbackHeight = Math.min(imgHeight, FALLBACK_HEIGHT);
                    wrapperDiv.style.width = fallbackWidth + 'px';
                    wrapperDiv.style.height = fallbackHeight + 'px';
                    wrapperDiv.style.maxWidth = '100%';
                    wrapperDiv.style.maxHeight = '100%';
                    wrapperDiv.style.overflow = 'hidden';
                    logger.debug('PhotoDisplay', 'fallback_wrapper_size', 'Using fallback wrapper size', {
                        retryCount: retryCount + 1,
                        fallbackWidth,
                        fallbackHeight
                    });
                    return;
                }
                
                // Use fallback dimensions if still no container size after retries
                if (availableWidth <= 0 || availableHeight <= 0) {
                    availableWidth = FALLBACK_WIDTH;
                    availableHeight = FALLBACK_HEIGHT;
                    logger.debug('PhotoDisplay', 'emergency_fallback_dimensions', 'Using emergency fallback dimensions', {
                        availableWidth,
                        availableHeight
                    });
                }
                
                const imageAspectRatio = imgWidth / imgHeight;
                const availableAspectRatio = availableWidth / availableHeight;
                
                let fittedWidth, fittedHeight;
                
                if (imageAspectRatio > availableAspectRatio) {
                    // Image is wider relative to available space - fit to width
                    fittedWidth = Math.min(imgWidth, availableWidth);
                    fittedHeight = fittedWidth / imageAspectRatio;
                } else {
                    // Image is taller relative to available space - fit to height
                    fittedHeight = Math.min(imgHeight, availableHeight);
                    fittedWidth = fittedHeight * imageAspectRatio;
                }
                
                // Set the wrapper to calculated fixed size
                wrapperDiv.style.width = fittedWidth + 'px';
                wrapperDiv.style.height = fittedHeight + 'px';
                wrapperDiv.style.overflow = 'hidden';

                // Update displayed image size for face bounding box overlay
                setDisplayedImageSize({ width: fittedWidth, height: fittedHeight });

                logger.debug('PhotoDisplay', 'wrapper_size_calculated', 'Calculated wrapper size', {
                    fittedWidth,
                    fittedHeight,
                    imgWidth,
                    imgHeight,
                    availableWidth,
                    availableHeight
                });
            }
            
            // Always apply styling immediately - no container dimension checks needed
            // Reset to wrapper size when loading new image using fixed pixel sizes
            let resetStyle;
            if (wrapperDiv && wrapperDiv.style.width && wrapperDiv.style.height) {
                const wrapperWidth = parseFloat(wrapperDiv.style.width);
                const wrapperHeight = parseFloat(wrapperDiv.style.height);
                if (wrapperWidth > 0 && wrapperHeight > 0) {
                    resetStyle = { 
                        opacity: 1, 
                        transition: "opacity 0.3s", 
                        width: wrapperWidth + 'px', 
                        height: wrapperHeight + 'px',
                        maxWidth: 'none',
                        maxHeight: 'none'
                    };
                } else {
                    resetStyle = { 
                        opacity: 1, 
                        transition: "opacity 0.3s", 
                        width: '100%', 
                        height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%'
                    };
                }
            } else {
                resetStyle = { 
                    opacity: 1, 
                    transition: "opacity 0.3s", 
                    width: '100%', 
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%'
                };
            }
            props.SetImgStyle(
                resetStyle,
                imgWidth,
                imgHeight
            );
        }
    };

    return (
        <div id="photo" className={"photo" + (props.photosListMiniClosed ? " photosListMiniClosed" : "")}>
            <div id="selectedInfo" className={props.selectedInfoHidden ? "hidden" : ""}
                dangerouslySetInnerHTML={{ __html: props.selectedContent }}>
            </div>
            <div id="unselectedInfo" className={props.unselectedInfoHidden ? "hidden" : ""}>
                {props.unselectedContent}
            </div>
            <div className={videoClass}>
                <div style={{ "width": photoDisplayWidth, "height": photoDisplayHeight }}>
                    { /* <ReactPlayer
                    width="100%"
                    height="100%"
                    controls
                    url={videoSource}
                    */ }
                    <video
                        controls
                        src={videoSource}
                    >
                    </video>
                </div>
                Open with other software: <a href="#" onClick={(e) => openUrl(fileUrl(props.currentDisplayPath))}>{props.currentDisplayPath}</a>
            </div>
            {props.currentDisplayPath && /\.nev$/i.test(props.currentDisplayPath) &&
                <div id="imageWrapper" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative', flexDirection: 'column' }}>
                    <span style={{ fontSize: '96px' }}>&#128247;</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                        Unsupported Format: {props.currentDisplayPath.split('.').pop().toUpperCase()}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                        {props.currentDisplayPath.split('/').pop()}
                    </div>
                </div>
            }
            {props.currentDisplayPath && !props.currentDisplayPath.match(/\.(mp4|webm)$/i) && !/\.nev$/i.test(props.currentDisplayPath) &&
                <div id="imageWrapper" style={{ overflow: 'auto', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%', position: 'relative' }}>
                    <img ref={imgRef} id="photoImgTag" className={photoDisplayImgClass + (isLoadingFullImage ? " loading-thumbnail" : "")}
                        loading="eager"
                        onDoubleClick={(e) => props.togglePhotoSelected(props.burstRestrictionsActive)}
                        onError={(e) => {
                            // Only handle error if not already showing error image
                            if (e.target.src.includes('/img_error.png')) {
                                return;
                            }

                            // Try thumbnail as fallback if main image fails and we have a thumbnail
                            if (props.thumbnailSrc && !e.target.dataset.triedThumbnail) {
                                e.target.dataset.triedThumbnail = "true";
                                const thumbnailSrc = convertFileSrc(props.thumbnailSrc);
                                e.target.src = thumbnailSrc;
                            } else {
                                // Final fallback: show error image
                                e.target.src = "/img_error.png";
                            }
                        }}
                        style={{
                            ...props.imgStyle,
                            ...(isShowingThumbnail && props.thumbnailOrientationCorrection
                                ? getCombinedTransformStyle(props.orientation, props.currentPhotoCssStyle)
                                : parseCssStyle(props.currentPhotoCssStyle))
                        }}
                        onLoad={(e) => {
                            handleImgLoad(e.target);
                        }}
                        src={displaySrc || convertFileSrc(props.currentDisplayPath)}
                        onMouseDown={(e) => dragPhotoStart(e, setPhotoDisplayImgClass)}
                        onMouseMove={(e) => dragPhoto(e)}
                        onMouseUp={(e) => dragPhotoEnd(setPhotoDisplayImgClass)}
                        onWheel={(e) => photoScroll(e)}
                    />
                    {/* Face bounding box overlay - only shown when Face tab is active */}
                    {isFaceTabActive && showFaceBboxes && detectedFaces.length > 0 && (
                        <FaceBoundingBoxOverlay
                            faces={detectedFaces}
                            imageWidth={displayedImageSize.width || imgRef.current?.offsetWidth || 0}
                            imageHeight={displayedImageSize.height || imgRef.current?.offsetHeight || 0}
                            hoveredFaceId={hoveredFaceId}
                        />
                    )}
                    {/* Face count indicator - only shown when Face tab is active */}
                    {isFaceTabActive && detectedFaces.length > 0 && (
                        <FaceCountIndicator
                            facesCount={detectedFaces.length}
                            showFaceBboxes={showFaceBboxes}
                            setShowFaceBboxes={setShowFaceBboxes}
                        />
                    )}
                    {/* Burst badge - shows when viewing burst representative in burst mode (clickable to open group) */}
                    {props.burstModeEnabled && props.isBurstRepresentative && props.burstGroupId && !props.isInBurstGroupMode && (
                        <BurstBadge
                            burstGroupId={props.burstGroupId}
                            burstCount={props.burstCount}
                            currentViewMode={props.currentViewMode}
                            currentViewModeData={props.currentViewModeData}
                            openBurstGroup={props.openBurstGroup}
                        />
                    )}
                    {/* Burst group indicator - clickable button to go back to burst representative view */}
                    {props.isInBurstGroupMode && props.burstGroupId && (
                        <BurstGroupIndicator goBackFromBurstGroup={props.goBackFromBurstGroup} />
                    )}
                </div>
            }
        </div>
    );
}

export default PhotoDisplay;
