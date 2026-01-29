/**
 * ThumbnailRenderer - Renders individual thumbnails in the PhotosListMini strip
 * Extracted from PhotosListMini.jsx to reduce file size
 */
import React, { useState, useEffect, useCallback } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";
import { parseCssStyle } from "./photoUtils.js";
import { getCombinedTransformStyle } from "../../../utils/orientationUtils.js";

/**
 * ThumbnailRenderer component
 * @param {Object} props
 * @param {Object} props.photo - Photo entity
 * @param {number} props.vIndex - Actual index in the full photos array
 * @param {number} props.displayIndex - Index in the visible thumbnails array (for styling)
 * @param {string} props.borderStyle - Border style for this thumbnail
 * @param {number} props.maxHeight - Maximum height for thumbnail
 * @param {boolean} props.thumbnailOrientationCorrection - Whether to apply orientation correction
 * @param {Function} props.onThumbnailClick - Click handler for thumbnail
 * @param {Function} props.onBurstBadgeClick - Click handler for burst badge
 * @param {Object} props.importState - Import state for import mode
 * @param {Object} props.imgSrcCache - Cached image sources
 * @param {Function} props.setImgSrcCache - Update image source cache
 * @param {boolean} props.isInBurstGroupMode - Whether currently viewing a burst group
 */
function ThumbnailRenderer({
    photo,
    vIndex,
    displayIndex,
    borderStyle,
    maxHeight,
    thumbnailOrientationCorrection,
    onThumbnailClick,
    onBurstBadgeClick,
    importState,
    imgSrcCache,
    setImgSrcCache,
    isInBurstGroupMode
}) {
    const [localImgSrc, setLocalImgSrc] = useState('');

    // Initialize image source
    useEffect(() => {
        if (!photo?.originalPath) return;

        // Use cached source if available
        if (imgSrcCache[photo.originalPath]) {
            setLocalImgSrc(imgSrcCache[photo.originalPath]);
            return;
        }

        let imgSrc = '';

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
                        setImgSrcCache(prev => {
                            if (!prev[photo.originalPath] || prev[photo.originalPath] === "") {
                                return { ...prev, [photo.originalPath]: photo._cachedThumbnailPath };
                            }
                            return prev;
                        });
                        setLocalImgSrc(photo._cachedThumbnailPath);
                    })
                    .catch(err => {
                        logger.debug('ThumbnailRenderer', 'thumbnail_path_error', 'Failed to get thumbnail path', {
                            photoPath: photo.originalPath,
                            error: err?.message || String(err)
                        });
                    });
                imgSrc = photo._cachedThumbnailPath || "";
            } else {
                imgSrc = photo._cachedThumbnailPath;
            }
        } else if (photo.hasThumbnail) {
            imgSrc = convertFileSrc(photo.thumbnailPath());
        } else {
            imgSrc = convertFileSrc(photo.displayPath());
        }

        // Update state and cache if we computed a new value
        if (imgSrc) {
            setLocalImgSrc(imgSrc);
            setImgSrcCache(prev => {
                if (!prev[photo.originalPath]) {
                    return { ...prev, [photo.originalPath]: imgSrc };
                }
                return prev;
            });
        }
    }, [photo, importState, imgSrcCache, setImgSrcCache]);

    /**
     * Handle image load error with fallback logic
     */
    const handleError = useCallback((e) => {
        if (e.target.src.includes('/img_error.png')) return;

        if (photo.import_source === true) {
            if (!e.target.dataset.thumbnailGenerated) {
                e.target.dataset.thumbnailGenerated = 'true';
                const imgElement = e.target;
                const importDir = (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
                    ? importState.currentImportPath
                    : null;
                invoke('get_resized_image', {
                    pathStr: photo.originalPath,
                    maxSize: 200,
                    importDirectory: importDir,
                    skipResizeFallback: true
                })
                    .then(() => invoke('get_thumbnail_path', { photoPath: photo.originalPath, importDirectory: importDir }))
                    .then(cachePath => {
                        imgElement.src = convertFileSrc(cachePath) + '?t=' + Date.now();
                    })
                    .catch(() => {
                        if (imgElement && !imgElement.dataset.triedOriginal) {
                            imgElement.dataset.triedOriginal = 'true';
                            imgElement.src = convertFileSrc(photo.originalPath);
                        }
                    });
                return;
            }
            if (!e.target.dataset.triedOriginal) {
                e.target.dataset.triedOriginal = 'true';
                e.target.src = convertFileSrc(photo.originalPath);
                return;
            }
            e.target.src = "/img_error.png";
            return;
        }

        if (photo.hasThumbnail && !e.target.dataset.triedOriginal) {
            e.target.dataset.triedOriginal = "true";
            e.target.src = convertFileSrc(photo.displayPath());
        } else {
            e.target.src = "/img_error.png";
        }
    }, [photo, importState]);

    if (!photo || !photo.originalPath) {
        return null;
    }

    const isMovie = !photo.hasThumbnail && photo.originalPath?.match(/\.(mp4|webm)$/i);
    const hasVideoPlayIcon = photo.originalPath?.match(/\.(mp4|webm)$/i);

    return (
        <div className="row2" key={`${vIndex}-${photo.originalPath}`} style={{ position: "relative" }}>
            <a onClick={() => onThumbnailClick(vIndex)}>
                {isMovie ? (
                    <div className="photo-list-movie" style={{ border: borderStyle, maxHeight: maxHeight + "px" }}>
                        <span>🎬</span>
                    </div>
                ) : (
                    <>
                        <img
                            src={localImgSrc || imgSrcCache[photo.originalPath]}
                            style={{
                                border: borderStyle,
                                maxHeight: maxHeight + "px",
                                ...(thumbnailOrientationCorrection
                                    ? getCombinedTransformStyle(photo.meta_data?.orientation, photo.cssStyle)
                                    : parseCssStyle(photo.cssStyle))
                            }}
                            alt={"photo-" + displayIndex}
                            onError={handleError}
                        />
                        {hasVideoPlayIcon && (
                            <div style={{ color: "var(--color-text-primary)", position: "relative", top: maxHeight / -4 }}>▶</div>
                        )}
                    </>
                )}
            </a>

            {/* Metadata overlay - stars and comments */}
            {(photo.star > 0 || photo.comment) && (
                <div style={{
                    position: "absolute",
                    bottom: "2px",
                    left: "2px",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    color: "var(--color-text-primary)",
                    padding: "2px 4px",
                    borderRadius: "3px",
                    fontSize: "var(--font-size-xs)",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    pointerEvents: "none"
                }}>
                    {photo.star > 0 && <span>⭐{photo.star}</span>}
                    {photo.comment && <span>💬</span>}
                </div>
            )}

            {/* Burst group badge - shows +N when photo has burst group */}
            {photo.burst_group_id && photo.burst_count > 1 && !isInBurstGroupMode && (
                <div
                    style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        background: "var(--color-primary)",
                        color: "var(--color-text-primary)",
                        padding: "1px 4px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: "bold",
                        minWidth: "16px",
                        textAlign: "center",
                        cursor: "pointer",
                        zIndex: 4
                    }}
                    title={`Burst group: ${photo.burst_count} photos`}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onBurstBadgeClick) {
                            onBurstBadgeClick(photo.burst_group_id);
                        }
                    }}
                >
                    +{photo.burst_count - 1}
                </div>
            )}
        </div>
    );
}

export default ThumbnailRenderer;
