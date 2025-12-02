import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from '@tauri-apps/plugin-opener';
import Scrollable from "../../Scrollable.jsx";
import TagChip from "../../components/TagChip.jsx";
import fileUrl from "../../PathUtil.jsx";
import { logger } from "../../services/LoggerService.js";

// Get or generate thumbnail (uses Rust cache, will generate if missing)
async function getThumbnailSrc(photoPath) {
    try {
        const result = await invoke('get_resized_image', {
            pathStr: photoPath,
            maxSize: 200
        });

        // Rust returns either a file path (for cache) or data URL (fallback)
        if (result.startsWith('data:image/')) {
            logger.debug('PhotoGrid', 'thumbnail_data_url', 'Using data URL from backend', {
                photoPath
            });
            return result;
        } else {
            const assetUrl = convertFileSrc(result);
            logger.debug('PhotoGrid', 'thumbnail_file_path', 'Using cached thumbnail file', {
                photoPath,
                cachePath: result,
                assetUrl
            });
            return assetUrl;
        }
    } catch (error) {
        logger.error('PhotoGrid', 'thumbnail_error', 'Failed to get thumbnail from backend', {
            photoPath,
            error: error.message
        });
        // Fallback to original file
        return convertFileSrc(photoPath);
    }
}

function PhotoGrid({
    displayedPhotos,
    totalPhotosCount,
    iconSize,
    photoSelectionDict,
    onAddSelection,
    onDisplayPhoto,
    onInfiniteScroll,
    isLimitedByConfig,
    configLimit,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    onClearFilters,
    showSideMenu,
    setShowSideMenu
}) {

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


    // Check if any filters are active
    const hasActiveFilters = useMemo(() => {
        return starFilter > 0 || hasCommentFilter || hasTagFilter || extensionFilter !== 'all';
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    // Generate filter summary text
    const getFilterSummary = useMemo(() => {
        const filters = [];
        if (starFilter > 0) filters.push(`${starFilter}+ stars`);
        if (hasCommentFilter) filters.push('has comment');
        if (hasTagFilter) filters.push('has tags');
        if (extensionFilter !== 'all') filters.push(`${extensionFilter} files`);
        return `Filters applied: ${filters.join(', ')}`;
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    const renderPhotoTile = (photo, index) => {
        const image_for_not_found = "/img_error.png";

        // Pre-generate thumbnails for import photos (async, cached in Rust)
        if (photo.import_source === true && !photo._thumbnailRequested) {
            photo._thumbnailRequested = true;
            getThumbnailSrc(photo.originalPath).catch(err => {
                logger.debug('PhotoGrid', 'thumbnail_prefetch_failed', 'Failed to prefetch thumbnail', {
                    photoPath: photo.originalPath,
                    error: err.message
                });
            });
        }

        // Calculate initial image source - same pattern for all photos
        let imgSrc = null;

        if (photo.hasThumbnail && photo.thumbnailPath && typeof photo.thumbnailPath === 'function') {
            imgSrc = convertFileSrc(photo.thumbnailPath());
        } else if (photo.displayPath && typeof photo.displayPath === 'function') {
            imgSrc = convertFileSrc(photo.displayPath());
        } else {
            imgSrc = convertFileSrc(photo.originalPath);
        }

        // Generate unique key - use path only (index changes on scroll causing unmount/remount)
        const uniqueKey = photo.originalPath;

        return (
            <div key={uniqueKey} className={"row pict-" + iconSize} style={{ flex: "0 0 " + ((iconSize / 1) + 41) + "px", textAlign: "center", verticalAlign: "middle", position: "relative" }} >
                <div style={{ flexShrink: 0 }}>
                    <a href="#" onClick={() => onDisplayPhoto(photo.originalPath, index)}>
                        {!photo.hasThumbnail && photo.originalPath?.match(/\.(mp4|webm)$/i)
                            ? <div className="photo-list-movie" style={{ minWidth: (iconSize - 20) + 'px', marginTop: (iconSize / 7) + "px" }}>
                                <span style={{ fontSize: (iconSize / 3) + 'px' }}>&#127909;</span>
                            </div>
                            : <div style={{ width: iconSize + 'px', height: iconSize + 'px', flexShrink: 0 }} >
                                <img
                                    alt={photo.originalPath}
                                    style={{
                                        ...(photo.import_source ? { width: iconSize + 'px', height: iconSize + 'px', objectFit: 'cover' } : { width: "97%", ...parseCssStyle(photo.cssStyle) })
                                    }}
                                    src={imgSrc}
                                    onLoad={(e) => {
                                        // For import photos, size is already set, skip adjustment
                                        if (photo.import_source === true) {
                                            return;
                                        }

                                        let w = e.currentTarget.width;
                                        let h = e.currentTarget.height;
                                        if (w > h) {
                                            e.currentTarget.style.width = "97%";
                                            e.currentTarget.style.height = "auto";
                                        } else {
                                            e.currentTarget.style.height = "97%";
                                            e.currentTarget.style.width = "auto";
                                        }
                                    }}
                                    onError={(e) => {
                                        // Only handle error if not already showing error image
                                        if (e.currentTarget.src.includes('/img_error.png') || e.currentTarget.src === image_for_not_found) {
                                            return;
                                        }

                                        // For import mode photos: original already showing, just show error
                                        if (photo.import_source === true) {
                                            logger.error('PhotoGrid', 'import_photo_error', 'Failed to load import photo', {
                                                photoPath: photo.originalPath
                                            });
                                            e.currentTarget.src = image_for_not_found;
                                            return;
                                        }

                                        // If we have a thumbnail and it's failing, try original as fallback
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
                                    }
                                    }
                                />
                                {photo.originalPath?.match(/\.(mp4|webm)$/i) && <div style={{ color: "white", position: "relative", top: iconSize / -3, fontSize: (iconSize / 6) + 'px' }}>&#x25b6;</div>}
                            </div>
                        }
                    </a>

                    {/* Metadata overlay - stars and comments */}
                    {(photo.star > 0 || photo.comment) && (
                        <div style={{
                            position: "absolute",
                            bottom: "25px",
                            right: "42px",
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            color: "white",
                            padding: "1px 3px",
                            borderRadius: "3px",
                            fontSize: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "2px"
                        }}>
                            {photo.star > 0 && (
                                <span>⭐{photo.star}</span>
                            )}
                            {photo.comment && (
                                <span>💬</span>
                            )}
                        </div>
                    )}

                    {/* Tags overlay */}
                    {(() => {
                        const tags = photo.getTags ? photo.getTags() : (photo.tags || []);
                        return tags.length > 0;
                    })() && (
                            <div style={{
                                position: "absolute",
                                bottom: "4px",
                                left: "4px",
                                right: "4px",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "2px",
                                maxHeight: "40px",
                                overflow: "hidden"
                            }}>
                                {(() => {
                                    const tags = photo.getTags ? photo.getTags() : (photo.tags || []);
                                    return tags.slice(0, 3).map(tag => (
                                        <TagChip
                                            key={tag.id}
                                            tag={tag}
                                            style={{
                                                fontSize: "8px",
                                                padding: "1px 4px",
                                                maxWidth: "60px"
                                            }}
                                        />
                                    ));
                                })()}
                                {(() => {
                                    const tags = photo.getTags ? photo.getTags() : (photo.tags || []);
                                    return tags.length > 3 && (
                                        <span style={{
                                            fontSize: "8px",
                                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                                            color: "white",
                                            padding: "1px 4px",
                                            borderRadius: "8px"
                                        }}>
                                            +{tags.length - 3}
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                </div>
                <div className="photo-list-menu">
                    <input type="checkbox"
                        id={"photo-checkbox-" + index}
                        checked={photoSelectionDict[photo.originalPath] ? "checked" : ""}
                        onChange={(e) => onAddSelection(e.target.checked, photo.originalPath)}
                    />
                    <label className={"checkbox-photo checkbox hover"} htmlFor={"photo-checkbox-" + index}></label>
                    <a href="#" onClick={() => {
                        onDisplayPhoto(photo.originalPath, index);
                        setShowSideMenu(true);
                    }}>(&#8505;)</a>
                    <a href="#" className="run-app" onClick={(e) => openUrl(fileUrl(photo.originalPath))}>&#128640;</a>
                </div>
            </div>
        );
    };

    return (
        <div className="photo-grid-container">
            {/* Header with photo count and filters info */}
            <div style={{ marginBottom: "10px", fontSize: "14px", color: "var(--text)" }}>
                {displayedPhotos.length > 0 ? (
                    <>
                        <span>Showing {displayedPhotos.length} photo{displayedPhotos.length !== 1 ? 's' : ''}</span>
                        {hasActiveFilters && (
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                                {getFilterSummary}
                                <button
                                    style={{ marginLeft: "10px", fontSize: "11px", padding: "2px 6px", cursor: "pointer" }}
                                    onClick={onClearFilters}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div>No Photo Found!</div>
                        {hasActiveFilters && (
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                                {getFilterSummary}
                                <button
                                    style={{ marginLeft: "10px", fontSize: "11px", padding: "2px 6px", cursor: "pointer" }}
                                    onClick={onClearFilters}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Photo Grid */}
            <Scrollable f={onInfiniteScroll} className="photos">
                {displayedPhotos.map((photo, index) => renderPhotoTile(photo, index))}

                {/* Infinite scroll completion indicator */}
                {displayedPhotos.length > 0 && (
                    <div className="infinite-scroll-complete"
                        style={{ textAlign: 'center', padding: '20px', width: '100%', gridColumn: '1 / -1', color: '#666' }}>
                        {isLimitedByConfig ? (
                            <div>
                                <div>Showing {displayedPhotos.length} photos (limited by configuration)</div>
                                <div style={{ fontSize: '12px', marginTop: '5px', color: '#999' }}>
                                    Display limit: {configLimit} photos. There may be more photos available.
                                </div>
                            </div>
                        ) : (
                            displayedPhotos.length < totalPhotosCount ? (
                                <div>
                                    <div>Scroll to load more photos</div>
                                    <div style={{ fontSize: '12px', marginTop: '5px', color: '#999' }}>
                                        Showing {displayedPhotos.length} of {totalPhotosCount} photos
                                    </div>
                                </div>
                            ) : (
                                <div>All photos displayed ({displayedPhotos.length} photos)</div>
                            )
                        )}
                    </div>
                )}
            </Scrollable>
        </div>
    );
}

export default PhotoGrid;