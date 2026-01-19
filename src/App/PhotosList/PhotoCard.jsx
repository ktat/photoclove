import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from '@tauri-apps/plugin-opener';
import classNames from 'classnames';
import fileUrl from "../../PathUtil.jsx";
import { logger } from "../../services/LoggerService.js";
import { getCombinedTransformStyle } from "../../utils/orientationUtils.js";
import styles from './PhotoCard.module.css';

/**
 * PhotoCard Component
 * Renders an individual photo thumbnail with metadata, selection checkbox, and actions
 * Extracted from PhotoGrid.jsx to improve code organization and reusability
 */
function PhotoCard({
    photo,
    index,
    iconSize,
    isSelected,
    onAddSelection,
    onDisplayPhoto,
    onOpenBurstGroup,
    isInBurstGroupMode = false,
    burstModeEnabled = false,
    setShowSideMenu,
    importState,
    thumbnailOrientationCorrection = false
}) {
    // Check if this photo is a burst representative (has badge) and selection should be disabled
    const isBurstRepresentative = photo.burst_group_id && photo.burst_count > 1;
    const selectionDisabled = burstModeEnabled && isBurstRepresentative && !isInBurstGroupMode;
    const image_for_not_found = "/img_error.png";

    // Helper function to parse CSS style string
    const parseCssStyle = useCallback((cssString) => {
        if (!cssString) return {};

        const styles = {};
        const declarations = cssString.split(';').filter(decl => decl.trim());

        declarations.forEach(decl => {
            const [property, value] = decl.split(':').map(s => s.trim());
            if (property && value) {
                // Convert kebab-case to camelCase for React
                const camelProperty = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                styles[camelProperty] = value;
            }
        });

        return styles;
    }, []);

    // Calculate initial image source
    let imgSrc = null;
    let imgRef = useRef(null);
    const isMountedRef = useRef(true);

    // Track component mount state to prevent updates on unmounted components
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    if (photo.import_source === true) {
        // For import photos: Get thumbnail cache path and set it directly in src
        // This will trigger onError if the file doesn't exist yet
        if (!photo._cachedThumbnailPath) {
            // Get deterministic cache path and cache it on the photo object
            // Include import directory for import mode to avoid cache collisions
            // Only pass importDirectory if it's a non-empty string
            const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                ? importState.currentImportPath
                : null;
            logger.debug('PhotoCard', 'get_thumbnail_path_call', 'Calling get_thumbnail_path', {
                photoPath: photo.originalPath,
                importDirectory: importDir,
                hasImportState: !!importState,
                currentImportPath: importState?.currentImportPath,
                importSource: photo.import_source
            });
            invoke('get_thumbnail_path', {
                photoPath: photo.originalPath,
                importDirectory: importDir
            })
                .then(cachePath => {
                    // Check if component is still mounted before updating
                    if (!isMountedRef.current) return;
                    photo._cachedThumbnailPath = convertFileSrc(cachePath);
                    // If we have an imgRef, update src immediately
                    if (imgRef.current) {
                        imgRef.current.src = photo._cachedThumbnailPath;
                    }
                })
                .catch(err => {
                    logger.warn('PhotoCard', 'thumbnail_path_failed', 'Failed to get thumbnail cache path', {
                        photoPath: photo.originalPath,
                        error: err.message
                    });
                });
        }
        // Use cached thumbnail path, or empty placeholder that will be updated async
        imgSrc = photo._cachedThumbnailPath || "";
    } else if (photo.inTrashBin && !photo.hasThumbnail) {
        // For trash photos without library thumbnails: Use EXIF thumbnail cache
        // On error (cache miss), generate EXIF thumbnail from trash file
        if (!photo._trashThumbnailPath) {
            // Get cache path and store it on the photo object
            invoke('get_thumbnail_path', {
                photoPath: photo.originalPath,
                importDirectory: 'trash'  // Use 'trash' as namespace to avoid collision
            })
                .then(cachePath => {
                    if (!isMountedRef.current) return;
                    photo._trashThumbnailPath = cachePath;
                    // Update img src to try loading from cache
                    if (imgRef.current) {
                        imgRef.current.src = convertFileSrc(cachePath);
                    }
                })
                .catch(err => {
                    logger.warn('PhotoCard', 'trash_thumbnail_path_failed', 'Failed to get cache path', {
                        photoPath: photo.originalPath,
                        error: err.message
                    });
                });
        }
        // Use cached path if available, otherwise use trash file path as placeholder
        // (will be updated once get_thumbnail_path completes)
        if (photo._trashThumbnailPath) {
            imgSrc = convertFileSrc(photo._trashThumbnailPath);
        } else {
            // Temporary: use trash file path until cache path is resolved
            const trashFilePath = typeof photo.displayPath === 'function' ? photo.displayPath() : photo.originalPath;
            imgSrc = convertFileSrc(trashFilePath);
        }
    } else {
        // Normal photos: use existing logic
        if (photo.hasThumbnail && photo.thumbnailPath && typeof photo.thumbnailPath === 'function') {
            imgSrc = convertFileSrc(photo.thumbnailPath());
        } else if (photo.displayPath && typeof photo.displayPath === 'function') {
            imgSrc = convertFileSrc(photo.displayPath());
        } else {
            imgSrc = convertFileSrc(photo.originalPath);
        }
    }

    // Handle image loading to adjust aspect ratio
    const handleImageLoad = (e) => {
        let w = e.currentTarget.width;
        let h = e.currentTarget.height;
        if (w > h) {
            e.currentTarget.style.width = "97%";
            e.currentTarget.style.height = "auto";
        } else {
            e.currentTarget.style.height = "97%";
            e.currentTarget.style.width = "auto";
        }
    };

    // Handle image loading errors with fallback chain
    const handleImageError = (e) => {
        // Only handle error if not already showing error image
        if (e.currentTarget.src.includes('/img_error.png') || e.currentTarget.src === image_for_not_found) {
            return;
        }

        // For import mode photos: implement onError-based thumbnail generation chain
        if (photo.import_source === true) {
            // Step 1: First error - thumbnail doesn't exist, generate it
            if (!e.currentTarget.dataset.thumbnailGenerated) {
                e.currentTarget.dataset.thumbnailGenerated = 'true';
                const imgElement = e.currentTarget; // Capture reference before async
                logger.debug('PhotoCard', 'thumbnail_generation_started', 'Generating thumbnail on demand', {
                    photoPath: photo.originalPath
                });

                const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                    ? importState.currentImportPath
                    : null;
                invoke('get_resized_image', {
                    pathStr: photo.originalPath,
                    maxSize: 200,
                    importDirectory: importDir,
                    skipResizeFallback: photo.import_source === true  // Import modeではリサイズをスキップ
                })
                    .then(() => {
                        // Check if component is still mounted
                        if (!isMountedRef.current) return;
                        logger.debug('PhotoCard', 'thumbnail_generated', 'Thumbnail generated successfully', {
                            photoPath: photo.originalPath
                        });
                        // Step 2: Retry with thumbnail path + timestamp to bust cache
                        const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                            ? importState.currentImportPath
                            : null;
                        return invoke('get_thumbnail_path', {
                            photoPath: photo.originalPath,
                            importDirectory: importDir
                        });
                    })
                    .then(cachePath => {
                        // Check if component is still mounted and element is valid
                        if (!isMountedRef.current || !imgElement || !imgElement.isConnected) return;
                        const thumbnailUrl = convertFileSrc(cachePath) + '?t=' + Date.now();
                        logger.debug('PhotoCard', 'thumbnail_retry', 'Retrying with generated thumbnail', {
                            photoPath: photo.originalPath,
                            thumbnailUrl
                        });
                        imgElement.src = thumbnailUrl;
                    })
                    .catch(err => {
                        logger.error('PhotoCard', 'thumbnail_generation_failed', 'Failed to generate thumbnail', {
                            photoPath: photo.originalPath,
                            error: err?.message || String(err)
                        });
                        // If generation fails, try original immediately (only if still mounted and connected)
                        if (isMountedRef.current && imgElement && imgElement.isConnected && !imgElement.dataset.triedOriginal) {
                            imgElement.dataset.triedOriginal = 'true';
                            imgElement.src = convertFileSrc(photo.originalPath);
                        }
                    });
                return;
            }

            // Step 3: Second error - thumbnail generation failed or retry failed, try original
            if (!e.currentTarget.dataset.triedOriginal) {
                e.currentTarget.dataset.triedOriginal = 'true';
                logger.warn('PhotoCard', 'thumbnail_failed_fallback_original', 'Falling back to original image', {
                    photoPath: photo.originalPath
                });
                e.currentTarget.src = convertFileSrc(photo.originalPath);
                return;
            }

            // Step 4: Final error - even original failed, show error image
            logger.error('PhotoCard', 'import_photo_error', 'All fallbacks failed for import photo', {
                photoPath: photo.originalPath
            });
            e.currentTarget.src = image_for_not_found;
            return;
        }

        // For trash photos without library thumbnails: Generate EXIF thumbnail on cache miss
        if (photo.inTrashBin && !photo.hasThumbnail) {
            const trashFilePath = typeof photo.displayPath === 'function' ? photo.displayPath() : null;

            // Step 1: Cache miss - generate EXIF thumbnail from trash file
            if (!e.currentTarget.dataset.thumbnailGenerated && trashFilePath) {
                e.currentTarget.dataset.thumbnailGenerated = 'true';
                const imgElement = e.currentTarget;

                logger.debug('PhotoCard', 'trash_exif_generation_started', 'Generating EXIF thumbnail for trash photo', {
                    originalPath: photo.originalPath,
                    trashFilePath: trashFilePath?.slice(-50)
                });

                // Call get_resized_image with the trash file path to extract EXIF thumbnail
                invoke('get_resized_image', {
                    pathStr: trashFilePath,  // Use trash path as source file
                    maxSize: 200,
                    importDirectory: 'trash',  // Use 'trash' namespace for caching
                    skipResizeFallback: false  // Allow resize fallback if no EXIF thumbnail
                })
                    .then(cachePath => {
                        if (!isMountedRef.current || !imgElement || !imgElement.isConnected) return;
                        // Update photo object for future renders
                        photo._trashThumbnailPath = cachePath;
                        const thumbnailUrl = convertFileSrc(cachePath) + '?t=' + Date.now();
                        logger.info('PhotoCard', 'trash_exif_thumbnail_generated', 'EXIF thumbnail generated', {
                            originalPath: photo.originalPath?.slice(-40),
                            cachePath: cachePath?.slice(-40)
                        });
                        imgElement.src = thumbnailUrl;
                    })
                    .catch(err => {
                        logger.error('PhotoCard', 'trash_exif_generation_failed', 'Failed to generate EXIF thumbnail', {
                            originalPath: photo.originalPath,
                            error: err?.message || String(err)
                        });
                        // Fallback to full image from trash (already loaded as placeholder)
                    });
                return;
            }

            // Step 2: If we're here after thumbnail generation, the generated thumbnail also failed
            // Just keep showing the trash file (already set as placeholder)
            return;
        }

        // For normal photos: existing fallback logic
        if (photo.hasThumbnail && !e.currentTarget.dataset.triedOriginal) {
            // Mark that we've tried original to prevent infinite loop
            e.currentTarget.dataset.triedOriginal = "true";

            // Try original image as fallback using Photo entity displayPath
            let originalSrc;
            if (photo.displayPath && typeof photo.displayPath === 'function') {
                originalSrc = convertFileSrc(photo.displayPath());
            } else {
                originalSrc = convertFileSrc(photo.originalPath);
            }

            e.currentTarget.src = originalSrc;

        } else {
            // Final fallback: show error image
            e.currentTarget.src = image_for_not_found;
        }
    };

    // Get tags from photo (supports both Photo entity and plain objects)
    const getTags = () => {
        return photo.getTags ? photo.getTags() : (photo.tags || []);
    };

    const tags = getTags();
    const uniqueKey = photo.originalPath;

    // Get CSS module class for icon size
    const getSizeClass = useCallback((size) => {
        const sizeMap = {
            50: styles.size50,
            100: styles.size100,
            200: styles.size200,
            300: styles.size300
        };
        return sizeMap[size] || styles.card;
    }, []);

    // Calculate thumbnail image style with optional orientation correction
    const thumbnailStyle = useMemo(() => {
        const baseStyle = { width: "97%" };

        // Get orientation from photo's EXIF data (meta_data.orientation)
        const orientation = photo.meta_data?.orientation;

        // Debug log - log for all photos when orientation correction is enabled (to debug scroll issue)
        if (thumbnailOrientationCorrection && (index < 5 || (index >= 48 && index <= 55))) {
            logger.info('PhotoCard', 'orientation_debug', 'Photo orientation check', {
                index,
                orientation: orientation || 'NONE',
                hasMeta: !!photo.meta_data,
                metaKeys: photo.meta_data ? Object.keys(photo.meta_data).length : 0,
                photoPath: photo.originalPath?.slice(-40)
            });
        }

        if (thumbnailOrientationCorrection) {
            const combinedStyle = getCombinedTransformStyle(orientation, photo.cssStyle);

            // Debug: log the resulting style for photos needing rotation
            if (orientation && orientation !== 'Straight') {
                logger.info('PhotoCard', 'orientation_style_result', 'Combined style for rotated photo', {
                    index,
                    inputOrientation: orientation,
                    inputCssStyle: photo.cssStyle || 'NONE',
                    resultStyle: combinedStyle,
                    hasTransform: !!combinedStyle.transform,
                    photoPath: photo.originalPath?.slice(-40)
                });
            }

            return { ...baseStyle, ...combinedStyle };
        } else {
            // Use only PhotoEditor CSS style (existing behavior)
            return { ...baseStyle, ...parseCssStyle(photo.cssStyle) };
        }
    }, [thumbnailOrientationCorrection, photo.meta_data?.orientation, photo.cssStyle, parseCssStyle, index, photo.originalPath]);

    return (
        <div
            key={uniqueKey}
            className={classNames('row', getSizeClass(iconSize), { [styles.cardSelected]: isSelected })}
            style={{
                flex: "0 0 " + ((iconSize / 1) + 41) + "px",
                textAlign: "center",
                verticalAlign: "middle",
                position: "relative"
            }}
        >
            <div className={styles.thumbnailContainer} style={{ width: iconSize + 'px', height: iconSize + 'px' }}>
                <a href="#" onClick={() => onDisplayPhoto(photo.originalPath, index)}>
                    {!photo.hasThumbnail && photo.originalPath?.match(/\.(mp4|webm)$/i)
                        ? <div className="photo-list-movie" style={{ minWidth: (iconSize - 20) + 'px', marginTop: (iconSize / 7) + "px" }}>
                            <span style={{ fontSize: (iconSize / 3) + 'px' }}>&#127909;</span>
                        </div>
                        : <div className={styles.imageWrapper}>
                            <img
                                ref={(photo.import_source === true || (photo.inTrashBin && !photo.hasThumbnail)) ? imgRef : null}
                                alt={photo.originalPath}
                                style={thumbnailStyle}
                                src={imgSrc}
                                loading="lazy"
                                onLoad={handleImageLoad}
                                onError={handleImageError}
                            />
                            {photo.originalPath?.match(/\.(mp4|webm)$/i) && (
                                <div className={styles.videoPlayIcon} style={{ fontSize: (iconSize / 6) + 'px' }}>
                                    &#x25b6;
                                </div>
                            )}
                        </div>
                    }
                </a>
                {/* Metadata overlay - stars and comments */}
                {(photo.star > 0 || photo.comment) && (
                    <div className={styles.metadataOverlay}>
                        {photo.star > 0 && (
                            <span>⭐{photo.star}</span>
                        )}
                        {photo.comment && (
                            <span>💬</span>
                        )}
                    </div>
                )}
                {/* Tags indicator - simple emoji */}
                {tags.length > 0 && (
                    <div
                        className={styles.tagsIndicator}
                        title={`${tags.length} tag${tags.length !== 1 ? 's' : ''}: ${tags.map(t => t.name).join(', ')}`}
                    >
                        <span>🏷️</span>
                        {tags.length > 1 && (
                            <span>{tags.length}</span>
                        )}
                    </div>
                )}
                {/* Burst group badge - shows count when NOT in burst group, shows "Grouped" when IN burst group */}
                {photo.burst_group_id && photo.burst_count > 1 && !isInBurstGroupMode && (
                    <div
                        className={styles.burstBadge}
                        title={`Burst group: ${photo.burst_count} photos - Click to view all`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onOpenBurstGroup) {
                                onOpenBurstGroup(photo.burst_group_id, index);
                            }
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        +{photo.burst_count - 1}
                    </div>
                )}
            </div>

            {/* Photo actions menu - using global CSS for backward compatibility */}
            <div className="photo-list-menu">
                <input
                    type="checkbox"
                    id={"photo-checkbox-" + index}
                    checked={isSelected}
                    disabled={selectionDisabled}
                    onChange={(e) => onAddSelection(e.target.checked, photo.originalPath)}
                    title={selectionDisabled ? "Cannot select burst group representative. Open burst group to select individual photos." : ""}
                />
                <label
                    className={`checkbox-photo checkbox hover ${selectionDisabled ? 'disabled' : ''}`}
                    htmlFor={"photo-checkbox-" + index}
                    style={selectionDisabled ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                ></label>
                <a href="#" onClick={() => {
                    onDisplayPhoto(photo.originalPath, index);
                    setShowSideMenu(true);
                }}>(&#8505;)</a>
                <a
                    href="#"
                    className="run-app"
                    onClick={(e) => openUrl(fileUrl(photo.originalPath))}
                >&#128640;</a>
            </div>
        </div>
    );
}

export default PhotoCard;
