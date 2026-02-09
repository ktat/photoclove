/**
 * ThumbnailRenderer - Renders individual thumbnails in the PhotosListMini strip
 * Extracted from PhotosListMini.jsx to reduce file size
 */
import React, { useState, useEffect, useCallback } from 'react';
import { parseCssStyle } from "./photoUtils.js";
import { getCombinedTransformStyle } from "../../../utils/orientationUtils.js";
import { initializeImageSource, handleThumbnailError, isVideoFile, metadataOverlayStyle } from "./thumbnailUtils.js";

/**
 * ThumbnailRenderer component
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

    // Initialize image source using shared utility
    useEffect(() => {
        initializeImageSource(photo, importState, imgSrcCache, setImgSrcCache, setLocalImgSrc);
    }, [photo, importState, imgSrcCache, setImgSrcCache]);

    // Handle image load error using shared utility
    const handleError = useCallback((e) => {
        handleThumbnailError(e, photo, importState, 'ThumbnailRenderer');
    }, [photo, importState]);

    if (!photo || !photo.originalPath) {
        return null;
    }

    const isMovie = !photo.hasThumbnail && isVideoFile(photo.originalPath);
    const hasVideoPlayIcon = isVideoFile(photo.originalPath);
    const tags = photo.getTags ? photo.getTags() : (photo.tags || []);

    return (
        <div className="row2" key={`${vIndex}-${photo.originalPath}`} style={{ position: "relative" }}>
            <a onClick={() => onThumbnailClick(vIndex)} style={{ position: "relative", display: "inline-block" }}>
                {photo.isUnsupportedFormat && photo.isUnsupportedFormat() ? (
                    <div style={{ border: borderStyle, maxHeight: maxHeight + "px", height: maxHeight + "px", width: maxHeight + "px", display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <span style={{ fontSize: (maxHeight / 3) + 'px' }}>&#128247;</span>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {photo.getExtension().toUpperCase()}
                        </div>
                    </div>
                ) : isMovie ? (
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

                {/* Metadata overlay - stars and comments (bottom-right, matching PhotoCard) */}
                {(photo.star > 0 || photo.comment) && (
                    <div style={{ ...metadataOverlayStyle, bottom: "2px", right: "2px" }}>
                        {photo.star > 0 && <span>⭐{photo.star}</span>}
                        {photo.comment && <span>💬</span>}
                    </div>
                )}

                {/* Tags indicator (bottom-left, matching PhotoCard) */}
                {tags.length > 0 && (
                    <div
                        style={{ ...metadataOverlayStyle, bottom: "2px", left: "2px" }}
                        title={tags.map(t => t.name).join(', ')}
                    >
                        <span>🏷️</span>
                        {tags.length > 1 && <span>{tags.length}</span>}
                    </div>
                )}
            </a>

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
