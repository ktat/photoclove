import { logger } from '../services/LoggerService.js';

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

        // State flags
        this.inTrashBin = data.inTrashBin || false;
        this.inAlbum = data.inAlbum || false;
        this.albumId = data.albumId || null;
        this.import_source = data.import_source || false;

        // Configuration (injected dependency)
        this.config = config;
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
            // originalPath for trash photos is already the relative path (e.g., "2024-05-13/P1012881.jpg")
            // so we need to add it directly to trash_path
            const normalizedPath = this.originalPath.startsWith('/') ? this.originalPath : '/' + this.originalPath;

            this._cachedDisplayPath = trashPath + normalizedPath;
            return this._cachedDisplayPath;
        }

        this._cachedDisplayPath = this.originalPath;
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

            // Handle video files - use .jpg extension for thumbnails
            if (this.name.match(/(mp4|webm)$/i)) {
                if (uuid) {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${uuid}/${this.name}.jpg`;
                } else {
                    thumbnailPath = `${thumbnailStore}/${photoDate}/${this.name}.jpg`;
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
        const videoExtensions = ['mp4', 'webm', 'avi', 'mov'];
        return videoExtensions.includes(this.getExtension());
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
     * Update star rating
     * @param {number} star - New star rating
     * @returns {Photo} New Photo instance with updated star
     */
    withStar(star) {
        const newData = {
            file: { path: this.originalPath, name: this.name },
            path: this.originalPath,
            has_thumbnail: this.hasThumbnail,
            star: star,
            comment: this.comment,
            css_style: this.cssStyle,
            tags: this.tags,
            inTrashBin: this.inTrashBin,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source
        };
        return new Photo(newData, this.config);
    }

    /**
     * Update comment
     * @param {string} comment - New comment
     * @returns {Photo} New Photo instance with updated comment
     */
    withComment(comment) {
        const newData = {
            file: { path: this.originalPath, name: this.name },
            path: this.originalPath,
            has_thumbnail: this.hasThumbnail,
            star: this.star,
            comment: comment,
            css_style: this.cssStyle,
            tags: this.tags,
            inTrashBin: this.inTrashBin,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source
        };
        return new Photo(newData, this.config);
    }

    /**
     * Move photo to trash
     * @returns {Photo} New Photo instance marked as in trash
     */
    moveToTrash() {
        const newData = {
            file: { path: this.originalPath, name: this.name },
            path: this.originalPath,
            has_thumbnail: this.hasThumbnail,
            star: this.star,
            comment: this.comment,
            css_style: this.cssStyle,
            tags: this.tags,
            inTrashBin: true,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source
        };
        return new Photo(newData, this.config);
    }

    /**
     * Restore photo from trash
     * @returns {Photo} New Photo instance marked as not in trash
     */
    restoreFromTrash() {
        const newData = {
            file: { path: this.originalPath, name: this.name },
            path: this.originalPath,
            has_thumbnail: this.hasThumbnail,
            star: this.star,
            comment: this.comment,
            css_style: this.cssStyle,
            tags: this.tags,
            inTrashBin: false,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source
        };
        return new Photo(newData, this.config);
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
            inTrashBin: this.inTrashBin,
            inAlbum: this.inAlbum,
            albumId: this.albumId,
            import_source: this.import_source,
            // Store config data needed for path generation
            configData: this.config ? {
                thumbnail_store: this.config.thumbnail_store,
                trash_path: this.config.trash_path
            } : null
        };

        logger.info('Photo', 'tojson_created', 'Converting Photo to JSON', {
            originalPath: this.originalPath,
            name: this.name,
            hasThumbnail: this.hasThumbnail,
            hasConfig: !!this.config,
            thumbnailStore: this.config?.thumbnail_store,
            tagsCount: this.tags ? this.tags.length : 0,
            tagsData: this.tags
        });

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
            tags: this.tags
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

        // Process tags from backend format: Array<(i32, String, Option<String>)> -> Array<{id, name, color}>
        let tags = [];
        if (backendData.tags && Array.isArray(backendData.tags)) {
            tags = backendData.tags.map(tagTuple => ({
                id: tagTuple[0],
                name: tagTuple[1],
                color: tagTuple[2] || null
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
            inTrashBin: isFromTrash,
            inAlbum: false,
            albumId: null
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
            inTrashBin: false,
            inAlbum: true,
            albumId: albumId
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
            inTrashBin: jsonData.inTrashBin || false,
            inAlbum: jsonData.inAlbum || false,
            albumId: jsonData.albumId || null,
            import_source: jsonData.import_source || false
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