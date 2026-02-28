/**
 * ThumbnailItem - Reusable thumbnail component for PhotosListMini
 * Handles image loading, error fallbacks, and metadata display
 */
import React, { useState, useEffect, useCallback } from 'react';
import { parseCssStyle } from "./photoUtils.js";
import { getCombinedTransformStyle } from "../../../utils/orientationUtils.js";
import { initializeImageSource, handleThumbnailError, isVideoFile, metadataOverlayStyle } from "./thumbnailUtils.js";

/**
 * ThumbnailItem component
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

    // Initialize image source using shared utility
    useEffect(() => {
        initializeImageSource(photo, importState, photosListImgSrc, setPhotosListImgSrc, setImgSrc);
    }, [photo, importState, photosListImgSrc, setPhotosListImgSrc]);

    // Handle image load error using shared utility
    const handleError = useCallback((e) => {
        handleThumbnailError(e, photo, importState, 'ThumbnailItem');
    }, [photo, importState]);

    // Check if this is a video file
    const isVideo = isVideoFile(photo?.originalPath);

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
                {photo?.isUnsupportedFormat && photo.isUnsupportedFormat() ? (
                    <div style={{ border: borderStyle, maxHeight: maxHeight + "px", height: maxHeight + "px", width: maxHeight + "px", display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <span style={{ fontSize: (maxHeight / 3) + 'px' }}>&#128247;</span>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {photo.getExtension().toUpperCase()}
                        </div>
                    </div>
                ) : !photo?.hasThumbnail && isVideo ? (
                    <div className="photo-list-movie" style={{ border: borderStyle, maxHeight: maxHeight + "px" }}>
                        <span>🎬</span>
                    </div>
                ) : (
                    <div style={{ position: "relative", display: "inline-block" }}>
                        <img
                            src={imgSrc}
                            style={imageStyle}
                            alt={`photo-${index}`}
                            onError={handleError}
                        />
                        {isVideo && (
                            <div style={{ color: "var(--color-text-primary)", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}>▶</div>
                        )}
                    </div>
                )}
            </a>

            {/* Metadata overlay - stars and comments */}
            {(photo?.star > 0 || photo?.comment) && (
                <div style={{ ...metadataOverlayStyle, top: "28px", left: "2px" }}>
                    {photo.star > 0 && <span>⭐{photo.star}</span>}
                    {photo.comment && <span>💬</span>}
                </div>
            )}
        </div>
    );
}

export default ThumbnailItem;
