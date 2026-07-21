import { logger } from '../services/LoggerService.js';
import { VIDEO_EXTENSIONS } from '../utils/videoFormats.js';

/**
 * Photo Entity - Domain object representing a photo with its various states and paths
 */
export class Photo {
    constructor(data, config = null) {
        // Validate required config
        if (!config) {
            throw new Error('Photo entity requires config parameter for proper path generation');
        }

        // Core data
        this.originalPath = data.file?.path || data.path;
        this.name = data.file?.name || this.originalPath?.split('/').pop() || 'unknown';
        this.hasThumbnail = data.has_thumbnail || false;
        this.star = data.star || 0;
        this.comment = data.comment || '';
        this.cssStyle = data.css_style || '';
        this.tags = data.tags || []; // Array of tag objects: [{id, name, color}]
        this.created_at = data.created_at || ''; // File creation time from backend
        this.meta_data = data.meta_data || null; // EXIF data including orientation
        this.burst_group_id = data.burst_group_id || null; // Burst group ID for grouped photos
        this.burst_count = data.burst_count || null; // Number of photos in burst group

        // State flags
        this.inTrashBin = data.inTrashBin || false;
        this.inAlbum = data.inAlbum || false;
        this.albumId = data.albumId || null;
        this.import_source = data.import_source || false;

        // Configuration (injected dependency)
        this.config = config;
    }

    /**
     * Get the absolute path for the photo (import_to + relative path)
     * For library photos, resolves relative path to absolute using config.import_to.
     * For import source photos, returns originalPath as-is (already absolute).
     * @returns {string} The absolute file path
     */
    absolutePath() {
        if (this.import_source) {
            return this.originalPath;
        }
        if (!this.config?.import_to) return this.originalPath;
        const base = this.config.import_to.replace(/\/$/, '');
        const relative = this.originalPath.startsWith('/') ? this.originalPath : '/' + this.originalPath;
        return base + relative;
    }

    /**
     * Get the display path for the photo (considering trash state)
     * @returns {string} The path to use for displaying the photo
     */
    displayPath() {
        // Cache the result to avoid recalculation
        if (this._cachedDisplayPath !== undefined) {
            return this._cachedDisplayPath;
        }

        if (this.inTrashBin && this.config?.trash_path) {
            const trashPath = this.config.trash_path.replace(/\/$/, '');
            // originalPath is relative (e.g., "2024-05-13/uuid/photo.jpg")
            const normalizedPath = this.originalPath.startsWith('/') ? this.originalPath : '/' + this.originalPath;

            this._cachedDisplayPath = trashPath + normalizedPath;
            return this._cachedDisplayPath;
        }

        // Library photos: resolve relative to absolute using import_to
        this._cachedDisplayPath = this.absolutePath();
        return this._cachedDisplayPath;
    }

    /**
     * Get the thumbnail path for the photo
     * @returns {string} The path to use for thumbnail display
     */
    thumbnailPath() {
        // Cache the result to avoid recalculation
        if (this._cachedThumbnailPath !== undefined) {
            return this._cachedThumbnailPath;
        }

        if (!this.hasThumbnail) {
            // For fallback, use display path to handle trash mode correctly
            this._cachedThumbnailPath = this.displayPath();
            return this._cachedThumbnailPath;
        }

        // Extract UUID and date from path for thumbnail generation
        if (!this.originalPath) {
            this._cachedThumbnailPath = this.displayPath();
            return this._cachedThumbnailPath;
        }

        const pathParts = this.originalPath.split('/');
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let photoDate = null;
        let uuid = null;

        // Find the date directory and check if next directory is UUID
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (datePattern.test(pathParts[i])) {
                photoDate = pathParts[i];
                // Check if the next part is a UUID (not the filename)
                if (i + 2 < pathParts.length && uuidPattern.test(pathParts[i + 1])) {
                    uuid = pathParts[i + 1];
                }
                break;
            }
        }

        const thumbnailStore = this.config?.thumbnail_store || '';

        // For trash mode: thumbnails are still in normal thumbnail location
        // For normal mode: same logic
        if (photoDate) {
            let thumbnailPath;

            // Handle video files - use .jpg extension for thumbnails.
            // Use the shared isVideo() (mp4/webm/avi/mov) so .mov/.avi don't
            // fall through to the image branch and get the wrong thumbnail name.
            if (this.isVideo()) {
                if (uuid) {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${uuid}/${this.name}.jpg`;
                } else {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${this.name}.jpg`;
                }
                this._cachedThumbnailPath = thumbnailPath;
                return thumbnailPath;
            } else if (this.isRawFormat() || this.isHeicOrAvif()) {
                // RAW/HEIC/AVIF files: thumbnail is {name_lowercase}.jpg (e.g., photo.cr2 -> photo.cr2.jpg)
                const rawThumbnailName = this.name.toLowerCase() + '.jpg';
                if (uuid) {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${uuid}/${rawThumbnailName}`;
                } else {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${rawThumbnailName}`;
                }
                this._cachedThumbnailPath = thumbnailPath;
                return thumbnailPath;
            } else {
                // Handle image files - convert extension to lowercase
                const thumbnailName = this.name.replace(/\.([a-zA-Z]+)$/, (match, ext) => '.' + ext.toLowerCase());
                if (uuid) {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${uuid}/${thumbnailName}`;
                } else {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${thumbnailName}`;
                }
                this._cachedThumbnailPath = thumbnailPath;
                return thumbnailPath;
            }
        }

        // Final fallback - use display path to handle trash mode correctly
        this._cachedThumbnailPath = this.displayPath() || this.originalPath || '';
        return this._cachedThumbnailPath;
    }

    /**
     * Get file extension
     * @returns {string} File extension in lowercase
     */
    getExtension() {
        return this.originalPath?.split('.').pop()?.toLowerCase() || '';
    }

    /**
     * Check if photo is a video
     * @returns {boolean} True if the photo is a video file
     */
    isVideo() {
        return VIDEO_EXTENSIONS.includes(this.getExtension());
    }

    /**
     * Check if photo is a RAW camera file
     * @returns {boolean} True if the photo is a RAW file
     */
    isRawFormat() {
        const rawExtensions = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', '3fr'];
        return rawExtensions.includes(this.getExtension());
    }

    /**
     * Check if photo is a HEIC/HEIF/AVIF file (non-browser-native container format)
     * @returns {boolean} True if the photo is HEIC/HEIF/AVIF
     */
    isHeicOrAvif() {
        const heicExtensions = ['heic', 'heif', 'avif'];
        return heicExtensions.includes(this.getExtension());
    }

    /**
     * Check if photo is a non-browser-native format (RAW or HEIC/AVIF)
     * @returns {boolean} True if the browser cannot render this format natively
     */
    isNonNativeFormat() {
        return this.isRawFormat() || this.isHeicOrAvif();
    }

    /**
     * Check if photo is an unsupported format (imported but cannot be decoded/displayed)
     * @returns {boolean} True if the format is unsupported for display
     */
    isUnsupportedFormat() {
        const unsupportedExtensions = ['nev'];
        return unsupportedExtensions.includes(this.getExtension());
    }

    /**
     * Get tags associated with this photo
     * @returns {Array} Array of tag objects: [{id, name, color}]
     */
    getTags() {
        return this.tags || [];
    }

    /**
     * Check if photo has a specific tag
     * @param {number} tagId - Tag ID to check for
     * @returns {boolean} True if photo has the tag
     */
    hasTag(tagId) {
        return this.tags.some(tag => tag.id === tagId);
    }

    /**
     * Create a new Photo copying every constructor field, with overrides applied.
     * Keep the field list in sync with the constructor — a missing field here
     * silently drops data on every immutable update.
     * @param {Object} overrides - Constructor-format fields to replace
     * @returns {Photo} New Photo instance
     */
    #cloneWith(overrides) {
        const newData = {
            file: { path: this.originalPath, name: this.name },
            path: this.originalPath,
            has_thumbnail: this.hasThumbnail,
            star: this.star,
            comment: this.comment,
            css_style: this.cssStyle,
            tags: this.tags,
            created_at: this.created_at,
            meta_data: this.meta_data,
            burst_group_id: this.burst_group_id,
            burst_count: this.burst_count,
            inTrashBin: this.inTrashBin,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source,
            ...overrides
        };
        return new Photo(newData, this.config);
    }

    /**
     * Update star rating
     * @param {number} star - New star rating
     * @returns {Photo} New Photo instance with updated star
     */
    withStar(star) {
        return this.#cloneWith({ star });
    }

    /**
     * Update comment
     * @param {string} comment - New comment
     * @returns {Photo} New Photo instance with updated comment
     */
    withComment(comment) {
        return this.#cloneWith({ comment });
    }

    /**
     * Move photo to trash
     * @returns {Photo} New Photo instance marked as in trash
     */
    moveToTrash() {
        return this.#cloneWith({ inTrashBin: true });
    }

    /**
     * Restore photo from trash
     * @returns {Photo} New Photo instance marked as not in trash
     */
    restoreFromTrash() {
        return this.#cloneWith({ inTrashBin: false });
    }

    /**
     * Convert to JSON for React state storage
     * @returns {Object} JSON representation of Photo entity
     */
    toJSON() {
        const jsonData = {
            originalPath: this.originalPath,
            name: this.name,
            hasThumbnail: this.hasThumbnail,
            star: this.star,
            comment: this.comment,
            cssStyle: this.cssStyle,
            tags: this.tags,
            created_at: this.created_at,
            inTrashBin: this.inTrashBin,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source,
            meta_data: this.meta_data, // EXIF data including orientation
            burst_group_id: this.burst_group_id,
            burst_count: this.burst_count,
            // Store config data needed for path generation
            configData: this.config ? {
                import_to: this.config.import_to,
                thumbnail_store: this.config.thumbnail_store,
                trash_path: this.config.trash_path
            } : null
        };

        /*
        logger.info('Photo', 'tojson_created', 'Converting Photo to JSON', {
            originalPath: this.originalPath,
            name: this.name,
            hasThumbnail: this.hasThumbnail,
            hasConfig: !!this.config,
            thumbnailStore: this.config?.thumbnail_store,
            tagsCount: this.tags ? this.tags.length : 0,
            tagsData: this.tags
        });
        */

        return jsonData;
    }

    /**
     * Convert to legacy format for backward compatibility
     * @returns {Object} Legacy photo object format
     */
    toLegacyFormat() {
        return {
            file: {
                path: this.originalPath,
                name: this.name
            },
            path: this.originalPath,
            has_thumbnail: this.hasThumbnail,
            star: this.star,
            comment: this.comment,
            css_style: this.cssStyle,
            tags: this.tags,
            created_at: this.created_at
        };
    }

    /**
     * Factory method to create Photo from backend data
     * @param {Object} backendData - Raw data from backend
     * @param {Object} config - Application configuration
     * @param {boolean} isFromTrash - Whether this photo is from trash API
     * @returns {Photo} New Photo instance
     */
    static fromBackendData(backendData, config = null, isFromTrash = false) {
        // Config is required for Photo entity
        if (!config) {
            throw new Error('Photo.fromBackendData requires config parameter');
        }

        // Validate that we have valid photo data
        if (!backendData || (!backendData.file && !backendData.path)) {
            // Invalid backend data, skip creation
            return null; // Return null for invalid data
        }

        // Ensure we have a valid file path
        const photoPath = backendData.file?.path || backendData.path;
        if (!photoPath) {
            // No valid path found, skip creation
            return null; // Return null for data without path
        }

        // Process tags from backend format: Array<{id, name, color}> -> Array<{id, name, color}>
        let tags = [];
        if (backendData.tags && Array.isArray(backendData.tags)) {
            tags = backendData.tags.map(tag => ({
                id: tag.id ?? tag[0],
                name: tag.name ?? tag[1],
                color: tag.color ?? tag[2] ?? null
            }));
        }

        const data = {
            file: backendData.file || { path: photoPath, name: photoPath.split('/').pop() },
            path: photoPath,
            has_thumbnail: backendData.has_thumbnail || false,
            star: backendData.star || 0,
            comment: backendData.comment || '',
            css_style: backendData.css_style || '',
            tags: tags,
            created_at: backendData.created_at || backendData.file?.created_at || '',
            inTrashBin: isFromTrash,
            inAlbum: false,
            albumId: null,
            meta_data: backendData.meta_data || null, // EXIF data including orientation
            burst_group_id: backendData.burst_group_id || null,
            burst_count: backendData.burst_count || null
        };

        const newPhoto = new Photo(data, config);


        return newPhoto;
    }

    /**
     * Factory method to create Photo from album data
     * @param {Object} albumPhotoData - Photo data from album
     * @param {string} albumId - Album ID
     * @param {Object} config - Application configuration
     * @returns {Photo} New Photo instance
     */
    static fromAlbumData(albumPhotoData, albumId, config = null) {
        // Validate that we have valid photo data
        if (!albumPhotoData || (!albumPhotoData.file && !albumPhotoData.path)) {
            // Invalid album photo data, skip creation
            return null; // Return null for invalid data
        }

        // Ensure we have a valid file path
        const photoPath = albumPhotoData.file?.path || albumPhotoData.path;
        if (!photoPath) {
            // No valid path found, skip creation
            return null; // Return null for data without path
        }

        // Process tags from album data
        let tags = [];
        if (albumPhotoData.tags && Array.isArray(albumPhotoData.tags)) {
            tags = albumPhotoData.tags.map(tagTuple => ({
                id: tagTuple[0],
                name: tagTuple[1],
                color: tagTuple[2] || null
            }));
        }

        const data = {
            file: albumPhotoData.file || { path: photoPath, name: photoPath.split('/').pop() },
            path: photoPath,
            has_thumbnail: albumPhotoData.has_thumbnail || false,
            star: albumPhotoData.star || 0,
            comment: albumPhotoData.comment || '',
            css_style: albumPhotoData.css_style || '',
            tags: tags,
            created_at: albumPhotoData.created_at || albumPhotoData.file?.created_at || '',
            inTrashBin: false,
            inAlbum: true,
            albumId: albumId,
            meta_data: albumPhotoData.meta_data || null, // EXIF data including orientation
            burst_group_id: albumPhotoData.burst_group_id || null,
            burst_count: albumPhotoData.burst_count || null
        };
        return new Photo(data, config);
    }

    /**
     * Factory method to create Photo from JSON data (React state)
     * @param {Object} jsonData - JSON data from toJSON()
     * @returns {Photo} New Photo instance
     */
    static fromJSON(jsonData) {
        if (!jsonData || !jsonData.originalPath) {
            logger.debug('Photo', 'fromjson_invalid', 'Invalid JSON data provided', {
                hasJsonData: !!jsonData,
                hasOriginalPath: !!(jsonData?.originalPath)
            });
            return null;
        }

        const photoData = {
            file: { path: jsonData.originalPath, name: jsonData.name },
            path: jsonData.originalPath,
            has_thumbnail: jsonData.hasThumbnail,
            star: jsonData.star || 0,
            comment: jsonData.comment || '',
            css_style: jsonData.cssStyle || '',
            tags: jsonData.tags || [],
            created_at: jsonData.created_at || '',
            inTrashBin: jsonData.inTrashBin || false,
            inAlbum: jsonData.inAlbum || false,
            albumId: jsonData.albumId || null,
            import_source: jsonData.import_source || false,
            meta_data: jsonData.meta_data || null, // EXIF data including orientation
            burst_group_id: jsonData.burst_group_id || null,
            burst_count: jsonData.burst_count || null
        };

        // Restore config from stored configData
        const config = jsonData.configData || null;

        /*
        logger.info('Photo', 'fromjson_created', 'Creating Photo from JSON', {
            originalPath: jsonData.originalPath,
            name: jsonData.name,
            hasThumbnail: jsonData.hasThumbnail,
            hasConfig: !!config,
            thumbnailStore: config?.thumbnail_store,
            jsonTagsCount: jsonData.tags ? jsonData.tags.length : 0,
            jsonTagsData: jsonData.tags,
            photoDataTagsCount: photoData.tags ? photoData.tags.length : 0
        });
        */
        return new Photo(photoData, config);
    }
}