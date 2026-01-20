/**
 * ThumbnailItem - Reusable thumbnail component for PhotosListMini
 * Handles image loading, error fallbacks, and metadata display
 */
import React, { useState, useEffect, useCallback } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";
import { parseCssStyle } from "./photoUtils.js";
import { getCombinedTransformStyle } from "../../../utils/orientationUtils.js";

/**
 * ThumbnailItem component
 * @param {Object} props
 * @param {Object} props.photo - Photo entity
 * @param {number} props.index - Photo index in list
 * @param {string} props.borderStyle - Border style for selected state
 * @param {number} props.maxHeight - Maximum height for thumbnail
 * @param {boolean} props.thumbnailOrientationCorrection - Whether to apply orientation correction
 * @param {Function} props.onClick - Click handler
 * @param {Object} props.importState - Import state for import mode
 * @param {Object} props.photosListImgSrc - Image source cache
 * @param {Function} props.setPhotosListImgSrc - Update image source cache
 */
function ThumbnailItem({
    photo,
    index,
    borderStyle,
    maxHeight,
    thumbnailOrientationCorrection,
    onClick,
    importState,
    photosListImgSrc,
    setPhotosListImgSrc
}) {
    const [imgSrc, setImgSrc] = useState('');

    // Initialize image source
    useEffect(() => {
        if (!photo?.originalPath) return;

        // Use cached source if available
        if (photosListImgSrc[photo.originalPath]) {
            setImgSrc(photosListImgSrc[photo.originalPath]);
            return;
        }

        // Determine initial image source based on mode
        if (photo.import_source === true) {
            // Import mode: Get cache thumbnail path
            if (!photo._cachedThumbnailPath) {
                const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                    ? importState.currentImportPath
                    : null;

                invoke('get_thumbnail_path', {
                    photoPath: photo.originalPath,
                    importDirectory: importDir
                })
                    .then(cachePath => {
                        photo._cachedThumbnailPath = convertFileSrc(cachePath);
                        const newSrc = { ...photosListImgSrc, [photo.originalPath]: photo._cachedThumbnailPath };
                        setPhotosListImgSrc(newSrc);
                        setImgSrc(photo._cachedThumbnailPath);
                    })
                    .catch(err => {
                        logger.warn('ThumbnailItem', 'thumbnail_path_failed', 'Failed to get thumbnail cache path', {
                            photoPath: photo.originalPath,
                            error: err.message
                        });
                    });
                // Set empty initially
                setImgSrc('');
            } else {
                setImgSrc(photo._cachedThumbnailPath);
            }
        } else if (photo.hasThumbnail) {
            // Normal mode: Use existing thumbnail
            const thumbnailSrc = photo.thumbnailPath();
            const src = convertFileSrc(thumbnailSrc);
            setPhotosListImgSrc(prev => ({ ...prev, [photo.originalPath]: src }));
            setImgSrc(src);
        } else {
            // Normal mode without thumbnail: Use original
            const displayPath = photo.displayPath();
            const src = convertFileSrc(displayPath);
            setPhotosListImgSrc(prev => ({ ...prev, [photo.originalPath]: src }));
            setImgSrc(src);
        }
    }, [photo, importState, photosListImgSrc, setPhotosListImgSrc]);

    /**
     * Handle image load error with fallback logic
     */
    const handleError = useCallback((e) => {
        // Prevent handling if already showing error image
        if (e.target.src.includes('/img_error.png')) {
            return;
        }

        // Import mode: on-demand thumbnail generation
        if (photo.import_source === true) {
            // Step 1: Generate thumbnail
            if (!e.target.dataset.thumbnailGenerated) {
                e.target.dataset.thumbnailGenerated = 'true';
                const imgElement = e.target;

                logger.debug('ThumbnailItem', 'thumbnail_generation_started', 'Generating thumbnail on demand', {
                    photoPath: photo.originalPath
                });

                const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                    ? importState.currentImportPath
                    : null;

                invoke('get_resized_image', {
                    pathStr: photo.originalPath,
                    maxSize: 200,
                    importDirectory: importDir,
                    skipResizeFallback: photo.import_source === true
                })
                    .then(() => {
                        logger.debug('ThumbnailItem', 'thumbnail_generated', 'Thumbnail generated successfully', {
                            photoPath: photo.originalPath
                        });
                        return invoke('get_thumbnail_path', {
                            photoPath: photo.originalPath,
                            importDirectory: importDir
                        });
                    })
                    .then(cachePath => {
                        const thumbnailUrl = convertFileSrc(cachePath) + '?t=' + Date.now();
                        logger.debug('ThumbnailItem', 'thumbnail_retry', 'Retrying with generated thumbnail', {
                            photoPath: photo.originalPath,
                            thumbnailUrl
                        });
                        if (imgElement) {
                            imgElement.src = thumbnailUrl;
                        }
                    })
                    .catch(err => {
                        logger.error('ThumbnailItem', 'thumbnail_generation_failed', 'Failed to generate thumbnail', {
                            photoPath: photo.originalPath,
                            error: err.message
                        });
                        if (imgElement && !imgElement.dataset.triedOriginal) {
                            imgElement.dataset.triedOriginal = 'true';
                            imgElement.src = convertFileSrc(photo.originalPath);
                        }
                    });
                return;
            }

            // Step 2: Thumbnail generation failed, try original
            if (!e.target.dataset.triedOriginal) {
                e.target.dataset.triedOriginal = 'true';
                logger.warn('ThumbnailItem', 'thumbnail_failed_fallback_original', 'Falling back to original image', {
                    photoPath: photo.originalPath
                });
                e.target.src = convertFileSrc(photo.originalPath);
                return;
            }

            // Step 3: Final fallback
            logger.error('ThumbnailItem', 'import_photo_error', 'All fallbacks failed for import photo', {
                photoPath: photo.originalPath
            });
            e.target.src = "/img_error.png";
            return;
        }

        // Normal mode: existing fallback logic
        if (photo.hasThumbnail && !e.target.dataset.triedOriginal) {
            e.target.dataset.triedOriginal = "true";
            const originalSrc = convertFileSrc(photo.displayPath());
            e.target.src = originalSrc;
        } else {
            e.target.src = "/img_error.png";
        }
    }, [photo, importState]);

    // Check if this is a video file
    const isVideo = photo?.originalPath?.match(/\.(mp4|webm)$/i);

    // Get style based on orientation correction setting
    const imageStyle = {
        border: borderStyle,
        maxHeight: maxHeight + "px",
        ...(thumbnailOrientationCorrection
            ? getCombinedTransformStyle(photo?.meta_data?.orientation, photo?.cssStyle)
            : parseCssStyle(photo?.cssStyle))
    };

    return (
        <div className="row2" key={`${index}-${photo?.originalPath}`} style={{ position: "relative" }}>
            <a onClick={() => onClick(photo, index)}>
                {!photo?.hasThumbnail && isVideo ? (
                    <div className="photo-list-movie" style={{ border: borderStyle, maxHeight: maxHeight + "px" }}>
                        <span>🎬</span>
                    </div>
                ) : (
                    <>
                        <img
                            src={imgSrc}
                            style={imageStyle}
                            alt={`photo-${index}`}
                            onError={handleError}
                        />
                        {isVideo && (
                            <div style={{ color: "var(--color-text-primary)", position: "relative", top: maxHeight / -4 }}>▶</div>
                        )}
                    </>
                )}
            </a>

            {/* Metadata overlay - stars and comments */}
            {(photo?.star > 0 || photo?.comment) && (
                <div style={{
                    position: "absolute",
                    top: "28px",
                    left: "2px",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    color: "var(--color-text-primary)",
                    padding: "2px 4px",
                    borderRadius: "3px",
                    fontSize: "var(--font-size-2xs)",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    pointerEvents: "none"
                }}>
                    {photo.star > 0 && (
                        <span>⭐{photo.star}</span>
                    )}
                    {photo.comment && (
                        <span>💬</span>
                    )}
                </div>
            )}
        </div>
    );
}

export default ThumbnailItem;
