/**
 * Shared utilities for thumbnail components
 * Reduces duplication between ThumbnailItem and ThumbnailRenderer
 */
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";

/**
 * Get the import directory from import state
 */
export const getImportDir = (photo, importState) => {
    return (photo.import_source === true && importState?.currentImportPath && importState.currentImportPath !== '')
        ? importState.currentImportPath
        : null;
};

/**
 * Initialize image source for a photo
 * @returns {Promise<string>} The image source URL
 */
export const initializeImageSource = async (photo, importState, cache, setCache, setLocalSrc) => {
    if (!photo?.originalPath) return '';

    // Use cached source if available
    if (cache[photo.originalPath]) {
        setLocalSrc(cache[photo.originalPath]);
        return cache[photo.originalPath];
    }

    if (photo.import_source === true) {
        // Import mode: Get cache thumbnail path
        if (!photo._cachedThumbnailPath) {
            const importDir = getImportDir(photo, importState);
            try {
                const cachePath = await invoke('get_thumbnail_path', {
                    photoPath: photo.originalPath,
                    importDirectory: importDir
                });
                photo._cachedThumbnailPath = convertFileSrc(cachePath);
                setCache(prev => ({ ...prev, [photo.originalPath]: photo._cachedThumbnailPath }));
                setLocalSrc(photo._cachedThumbnailPath);
                return photo._cachedThumbnailPath;
            } catch (err) {
                logger.debug('thumbnailUtils', 'thumbnail_path_error', 'Failed to get thumbnail path', {
                    photoPath: photo.originalPath,
                    error: err?.message || String(err)
                });
                return '';
            }
        }
        setLocalSrc(photo._cachedThumbnailPath);
        return photo._cachedThumbnailPath;
    }

    // Normal mode
    const src = photo.hasThumbnail
        ? convertFileSrc(photo.thumbnailPath())
        : convertFileSrc(photo.displayPath());

    setCache(prev => ({ ...prev, [photo.originalPath]: src }));
    setLocalSrc(src);
    return src;
};

/**
 * Handle thumbnail image error with fallback logic
 * @param {Event} e - Error event
 * @param {Object} photo - Photo object
 * @param {Object} importState - Import state
 * @param {string} componentName - Name of the calling component for logging
 */
export const handleThumbnailError = async (e, photo, importState, componentName = 'Thumbnail') => {
    // Prevent handling if already showing error image
    if (e.target.src.includes('/img_error.png')) return;

    const imgElement = e.target;

    // Import mode fallback chain
    if (photo.import_source === true) {
        // Step 1: Generate thumbnail on demand
        if (!imgElement.dataset.thumbnailGenerated) {
            imgElement.dataset.thumbnailGenerated = 'true';
            const importDir = getImportDir(photo, importState);

            try {
                await invoke('get_resized_image', {
                    pathStr: photo.originalPath,
                    maxSize: 200,
                    importDirectory: importDir,
                    skipResizeFallback: true
                });
                const cachePath = await invoke('get_thumbnail_path', {
                    photoPath: photo.originalPath,
                    importDirectory: importDir
                });
                imgElement.src = convertFileSrc(cachePath) + '?t=' + Date.now();
                return;
            } catch (err) {
                logger.debug(componentName, 'thumbnail_generation_failed', 'Thumbnail generation failed', {
                    photoPath: photo.originalPath,
                    error: err?.message || String(err)
                });
            }
        }

        // Step 2: Try original image
        if (!imgElement.dataset.triedOriginal) {
            imgElement.dataset.triedOriginal = 'true';
            imgElement.src = convertFileSrc(photo.originalPath);
            return;
        }

        // Step 3: Final error fallback
        imgElement.src = "/img_error.png";
        return;
    }

    // Normal mode fallback
    if (photo.hasThumbnail && !imgElement.dataset.triedOriginal) {
        imgElement.dataset.triedOriginal = 'true';
        imgElement.src = convertFileSrc(photo.displayPath());
    } else {
        imgElement.src = "/img_error.png";
    }
};

/**
 * Check if a file path is a video
 */
export const isVideoFile = (path) => path?.match(/\.(mp4|webm)$/i);

/**
 * Metadata overlay style (shared between components)
 */
export const metadataOverlayStyle = {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "var(--color-text-primary)",
    padding: "2px 4px",
    borderRadius: "var(--radius-sm)",
    fontSize: "var(--font-size-xs)",
    display: "flex",
    alignItems: "center",
    gap: "2px",
    pointerEvents: "none"
};
