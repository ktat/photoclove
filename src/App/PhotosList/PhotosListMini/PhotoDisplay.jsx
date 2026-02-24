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
const VIDEO_HEIGHT_OFFSET = 150;
const CONTAINER_PADDING = 40;
const MAX_INTERNAL_VIDEO_SIZE_MB = 500; // 500MB threshold for internal video playback
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 100;
const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 600;
const SCROLL_LOCK_DELAY_MS = 100;
const FULL_IMAGE_LOAD_DELAY_MS = 300; // Delay before loading full image after navigation stops

// Non-browser-native format extensions (RAW + HEIC/HEIF/AVIF)
const NON_NATIVE_FORMAT_REGEX = /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|3fr|heic|heif|avif)$/i;

let currentFile = "";
let width = 0;
let height = 0;

function PhotoDisplay(props) {
    const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");
    const [videoSource, setVideoSource] = useState("");
    const [videoClass, setVideoClass] = useState("video-off");
    const videoRef = useRef(null);
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
    // Function to update video container size based on current app size
    const updateVideoSize = () => {
        let photoContainer = document.querySelector('#photo');
        if (photoContainer) {
            let containerWidth = photoContainer.clientWidth - CONTAINER_PADDING;
            let containerHeight = photoContainer.clientHeight - VIDEO_HEIGHT_OFFSET;
            
            // Ensure minimum reasonable size
            containerWidth = Math.max(containerWidth, 600);
            containerHeight = Math.max(containerHeight, 400);
            
            setPhotoDisplayWidth(containerWidth + "px");
            setPhotoDisplayHeight(containerHeight + "px");
            
            logger.debug('PhotoDisplay', 'video_size_updated', 'Video container resized', {
                width: containerWidth,
                height: containerHeight
            });
        }
    };

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
            
            // Also resize video container if video is currently showing
            if (videoClass === "video-on" && props.currentDisplayPath && props.currentDisplayPath.match(/(mp4|webm)$/i)) {
                updateVideoSize();
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

    // Video keyboard seek with fastSeek() (glucose_media_player inspired)
    // ArrowLeft/Right: ±5 seconds, 0-9: percentage seek
    useEffect(() => {
        if (videoClass !== "video-on") return;

        const handleVideoKeyDown = (e) => {
            const video = videoRef.current;
            if (!video || !video.duration) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const seek = (targetTime) => {
                if ('fastSeek' in video) {
                    video.fastSeek(targetTime);
                } else {
                    video.currentTime = targetTime;
                }
            };

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                seek(Math.max(0, video.currentTime - 5));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                seek(Math.min(video.duration, video.currentTime + 5));
            } else if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                seek(video.duration * (parseInt(e.key) / 10));
            }
        };

        document.addEventListener('keydown', handleVideoKeyDown);
        return () => document.removeEventListener('keydown', handleVideoKeyDown);
    }, [videoClass]);

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
                updateVideoSize();
                setVideoClass("video-on");
                setDisplaySrc("");
            } else {
                setVideoClass("video-off");
                setVideoSource("");

                // Check if this is a RAW file
                const isNonNativeFormat = NON_NATIVE_FORMAT_REGEX.test(props.currentDisplayPath);

                if (isNonNativeFormat) {
                    // Non-native formats (RAW/HEIC/AVIF): use progressive loading via backend decode
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
                    invoke('get_progressive_image', {
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
                        invoke('get_progressive_image', {
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
        if (currentFile !== path) {
            currentFile = path;
            try {
                // Start video server if not already running
                await invoke('start_video_server');
                
                // Register video file and get streaming URL
                const streamingUrl = await invoke('register_video_path', { videoPath: path });
                setVideoSource(streamingUrl);
                logger.info('PhotoDisplay', 'video_load', 'Loading video via HTTP streaming server', { 
                    path, 
                    streamingUrl 
                });
            } catch (error) {
                // Fallback to asset protocol if HTTP server fails
                logger.warn('PhotoDisplay', 'video_streaming_fallback', 'HTTP streaming failed, using asset protocol', {
                    path,
                    error: error.message
                });
                const assetUrl = convertFileSrc(path);
                setVideoSource(assetUrl);
            }
        }
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
                        key={videoSource || 'empty'}
                        ref={videoRef}
                        controls
                        src={videoSource || undefined}
                        preload="auto"
                        controlsList="nodownload nofullscreen noremoteplayback"
                        disablePictureInPicture
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            backgroundColor: 'var(--color-bg-secondary)'
                        }}
                        onLoadStart={() => {
                            logger.info('PhotoDisplay', 'video_load_start', 'Video loading started', { src: videoSource });
                        }}
                        onLoadedMetadata={(e) => {
                            const video = e.target;
                            logger.info('PhotoDisplay', 'video_metadata', 'Video metadata loaded', {
                                duration: video.duration,
                                videoWidth: video.videoWidth,
                                videoHeight: video.videoHeight,
                                codecs: video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
                                src: videoSource
                            });
                            
                            // Log buffer status without forcing reload
                            try {
                                if (video.buffered && video.buffered.length > 0) {
                                    logger.debug('PhotoDisplay', 'buffer_status', 'Initial buffer', {
                                        buffered: video.buffered.end(0) - video.buffered.start(0)
                                    });
                                }
                            } catch (err) {
                                logger.debug('PhotoDisplay', 'buffer_setup_failed', 'Buffer status failed', { error: err.message });
                            }
                        }}
                        onError={(e) => { if (!videoSource) return; logger.error('PhotoDisplay', 'video_error', 'Video loading error', { src: videoSource, error: e.target.error }); }}
                        onCanPlay={() => logger.info('PhotoDisplay', 'video_can_play', 'Video can play', { src: videoSource })}
                        onWaiting={() => {
                            logger.warn('PhotoDisplay', 'video_buffering', 'Video buffering detected - may need larger chunks', { src: videoSource });
                        }}
                        onProgress={(e) => {
                            if (e.target.buffered.length > 0) {
                                const bufferedEnd = e.target.buffered.end(0);
                                const currentTime = e.target.currentTime;
                                const bufferAhead = bufferedEnd - currentTime;
                                logger.debug('PhotoDisplay', 'buffer_progress', 'Buffer status', {
                                    bufferedSeconds: bufferAhead,
                                    currentTime: currentTime
                                });
                            }
                        }}
                        onPlaying={() => logger.debug('PhotoDisplay', 'video_playing', 'Video playing smoothly', { src: videoSource })}
                        onStalled={() => logger.warn('PhotoDisplay', 'video_stalled', 'Video playback stalled', { src: videoSource })}
                        onSuspend={() => logger.debug('PhotoDisplay', 'video_suspended', 'Video loading suspended', { src: videoSource })}
                        onVolumeChange={(e) => {
                            // Ensure audio doesn't get muted accidentally
                            if (e.target.muted) {
                                logger.warn('PhotoDisplay', 'video_muted', 'Video was muted unexpectedly');
                            }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                    <a href="#" onClick={(e) => {e.preventDefault(); openUrl(fileUrl(props.currentDisplayPath));}}>
                        📺 Open with external player
                    </a>
                    <span style={{ margin: '0 var(--space-2)', color: 'var(--color-text-secondary)' }}>|</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{props.currentDisplayPath}</span>
                </div>
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
                <div id="imageWrapper" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative' }}>
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
