import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useRef } from "react";
import { openUrl } from '@tauri-apps/plugin-opener';
import fileUrl from "../../../PathUtil.jsx";
import { logger } from "../../../services/LoggerService.js";
import { getCombinedTransformStyle } from "../../../utils/orientationUtils.js";

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

let currentFile = "";
let width = 0;
let height = 0;

function PhotoDisplay(props) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
    const [scrollLock, setScrollLock] = useState(false);
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
            if (props.currentPhotoPath && props.currentPhotoPath.match(/(mp4|webm)$/i)) {
                movie(props.currentPhotoPath);
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

                // Get full image source
                const fullImageSrc = (props.imgCacheMap[props.currentPhotoPath] && props.imgCacheMap[props.currentPhotoPath][0])
                    || convertFileSrc(props.currentPhotoPath);
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
                                path: props.currentPhotoPath,
                                width,
                                height
                            });
                        };
                        preloadImg.onerror = () => {
                            // Keep thumbnail on error
                            setIsLoadingFullImage(false);
                            logger.warn('PhotoDisplay', 'full_image_error', 'Failed to load full image', {
                                path: props.currentPhotoPath
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
            }
        }, CONTAINER_READY_DELAY_MS);

        // Cleanup on unmount or path change
        return () => {
            if (fullImageLoadTimeoutRef.current) {
                clearTimeout(fullImageLoadTimeoutRef.current);
                fullImageLoadTimeoutRef.current = null;
            }
        };
    }, [props.currentPhotoPath, props.thumbnailSrc, props.imgCacheMap, props.progressiveImageLoading]);

    function dragPhotoStart(e) {
        setPhotoDisplayImgClass("photo_dragging");
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }

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

    // TODO: not correct scroll adjustment.
    function photoScroll(e) {
        if (scrollLock || !props.photoZoomReady) {
            return;
        }

        setScrollLock(true);
        let zoom = props.photoZoom === "auto" ? 100 : parseInt(props.photoZoom.replace("%", ""));

        const imgTag = document.querySelector(".photo img");
        const wrapperDiv = document.querySelector('#imageWrapper');
        
        if (!imgTag || !wrapperDiv) {
            setScrollLock(false);
            return;
        }

        // Get current zoom scale before update
        const currentZoom = zoom;
        
        // Calculate dynamic zoom speed based on current zoom level
        // Base speed increases with zoom level for more natural feel
        const baseSpeed = 10;
        const zoomFactor = Math.max(1, currentZoom / 100);
        const zoomSpeed = Math.round(baseSpeed * zoomFactor);
        
        // Update zoom level with dynamic speed
        if (e.deltaY > 0) {
            zoom -= zoomSpeed;
            if (zoom <= 100) {
                zoom = 100;
            }
        } else if (e.deltaY < 0) {
            zoom += zoomSpeed;
        }

        // If zoom hasn't changed, return
        if (zoom === currentZoom) {
            setScrollLock(false);
            return;
        }

        props.setPhotoZoom(zoom + "%");

        // Get wrapper base dimensions (100% size)
        const wrapperWidth = parseFloat(wrapperDiv.style.width);
        const wrapperHeight = parseFloat(wrapperDiv.style.height);
        
        // Calculate old and new dimensions
        const oldScale = currentZoom / 100;
        const newScale = zoom / 100;
        
        const oldWidth = wrapperWidth * oldScale;
        const oldHeight = wrapperHeight * oldScale;
        const newWidth = wrapperWidth * newScale;
        const newHeight = wrapperHeight * newScale;

        // Get mouse position relative to image
        const rect = imgTag.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate position ratios
        const xRatio = x / oldWidth;
        const yRatio = y / oldHeight;

        // Apply new size
        props.SetImgStyle({ 
            width: newWidth + 'px',
            height: newHeight + 'px',
            opacity: '100%' 
        });

        // Calculate scroll to keep mouse point stable
        setTimeout(() => {
            const newX = newWidth * xRatio;
            const newY = newHeight * yRatio;
            
            const deltaX = newX - x;
            const deltaY = newY - y;
            
            wrapperDiv.scrollLeft += deltaX;
            wrapperDiv.scrollTop += deltaY;
        }, 0);

        setTimeout(() => { setScrollLock(false) }, SCROLL_LOCK_DELAY_MS);
        window.onscroll = function () { };
    }

    function dragPhoto(e) {
        if (dragPhotoInfo.is_dragging) {
            let x = e.clientX - dragPhotoInfo.x;
            let y = e.clientY - dragPhotoInfo.y;
            // Use the wrapper div as the scrollable container
            let display = document.querySelector('#imageWrapper') || e.currentTarget.parentElement;
            display.scrollTop -= y / 20;
            display.scrollLeft -= x / 20;
        } else {
            /*
            */
        }
    }

    function dragPhotoEnd(e) {
        setPhotoDisplayImgClass("");
        setDragPhotoInfo({});
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
                Open with other software: <a href="#" onClick={(e) => openUrl(fileUrl(props.currentPhotoPath))}>{props.currentPhotoPath}</a>
            </div>
            {props.currentPhotoPath && !props.currentPhotoPath.match(/\.(mp4|webm)$/i) &&
                <div id="imageWrapper" style={{ overflow: 'auto', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%' }}>
                    <img id="photoImgTag" className={photoDisplayImgClass + (isLoadingFullImage ? " loading-thumbnail" : "")}
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
                        src={displaySrc || convertFileSrc(props.currentPhotoPath)}
                        onMouseDown={(e) => dragPhotoStart(e)}
                        onMouseMove={(e) => dragPhoto(e)}
                        onMouseUp={(e) => dragPhotoEnd(e)}
                        onWheel={(e) => photoScroll(e)}
                    />
                    {/* Burst badge - shows when viewing burst representative in burst mode */}
                    {props.burstModeEnabled && props.isBurstRepresentative && props.burstGroupId && (
                        <div
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (props.openBurstGroup) {
                                    // Pass current view mode and data so we can return to this photo
                                    props.openBurstGroup(
                                        props.burstGroupId,
                                        props.currentViewMode,
                                        props.currentViewModeData
                                    );
                                }
                            }}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                backgroundColor: 'var(--color-primary)',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                zIndex: 100,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                            title="Click to view all photos in this burst group"
                        >
                            +{props.burstCount - 1} photos in group
                        </div>
                    )}
                </div>
            }
        </div>
    );
}

export default PhotoDisplay;
