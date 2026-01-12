import { Photo } from '../domain/Photo.js';

/**
 * Photo Processing Utilities
 * Extracted from PhotosList.jsx to reduce component complexity and improve reusability
 */

/**
 * Convert backend photo data to Photo entities and optionally to JSON
 * @param {Array} photosData - Raw photo data from backend
 * @param {Object} appConfig - Application configuration
 * @param {boolean} isFromTrash - Whether photos are from trash
 * @param {boolean} toJSON - Whether to convert to JSON format
 * @returns {Array} Processed photo entities or JSON objects
 */
export function convertPhotosToEntities(photosData, appConfig, isFromTrash = false, toJSON = true) {
    // Convert to Photo entities
    const photoEntities = photosData
        .map(photoData => Photo.fromBackendData(photoData, appConfig, isFromTrash))
        .filter(photo => photo !== null);
    
    if (!toJSON) {
        return photoEntities;
    }
    
    // Convert to JSON for React state storage
    return photoEntities
        .filter(photo => photo && typeof photo.toJSON === 'function')
        .map(photo => photo.toJSON());
}

/**
 * Apply frontend filters to photos array
 * @param {Array} photos - Array of photo objects
 * @param {Object} filterOptions - Filter configuration
 * @returns {Array} Filtered photos array
 */
export function applyFrontendFilters(photos, filterOptions) {
    const { starFilter, hasCommentFilter, hasTagFilter, extensionFilter } = filterOptions;
    
    const filtered = photos.filter(photo => {
        // Apply star filter
        if (starFilter > 0 && (!photo.star || photo.star < starFilter)) {
            return false;
        }

        // Apply comment filter
        if (hasCommentFilter && (!photo.comment || photo.comment.trim() === "")) {
            return false;
        }

        // Apply tag filter - check if photo has any tags using raw tags property
        if (hasTagFilter) {
            if (!photo.tags || photo.tags.length === 0) {
                return false;
            }
        }

        // Apply extension filter
        if (extensionFilter !== "all") {
            const extension = photo.name.split('.').pop().toLowerCase();
            const allowedExtensions = extensionFilter.split(',').map(ext => ext.trim().toLowerCase());
            if (!allowedExtensions.includes(extension)) {
                return false;
            }
        }

        return true;
    });

    return filtered;
}

/**
 * Convert JSON photos to Photo entities with methods
 * @param {Array} photosJSON - Array of JSON photo objects
 * @param {Object} appConfig - Application configuration
 * @returns {Array} Array of Photo entities with methods
 */
export function convertJSONToPhotoEntities(photosJSON, appConfig) {
    return photosJSON.map(photo => {
        // If it's already a Photo entity, use it as-is
        if (photo && typeof photo.displayPath === 'function') {
            return photo;
        }
        // If it's a plain object (JSON), convert to Photo entity
        if (photo && photo.originalPath && appConfig) {
            return Photo.fromJSON ? Photo.fromJSON({
                ...photo,
                configData: {
                    thumbnail_store: appConfig.thumbnail_store,
                    trash_path: appConfig.trash_path
                }
            }) : photo;
        }
        return photo;
    }).filter(photo => photo !== null);
}

