import { Photo } from '../domain/Photo.js';
import { logger } from './LoggerService.js';

/**
 * Photo Service - Application service for photo operations
 */
export class PhotoService {
    constructor(config) {
        this.config = config;
    }
    
    /**
     * Transform backend photo data to Photo entities
     * @param {Array} backendData - Raw photo data from backend
     * @param {boolean} isFromTrash - Whether photos are from trash
     * @returns {Array<Photo>} Array of Photo entities
     */
    transformBackendData(backendData, isFromTrash = false) {
        if (!Array.isArray(backendData)) {
            logger.warn('PhotoService', 'invalid_data', 'Backend data is not an array', { backendData });
            return [];
        }
        
        return backendData.map(photoData => {
            try {
                return Photo.fromBackendData(photoData, this.config, isFromTrash);
            } catch (error) {
                logger.error('PhotoService', 'transform_error', 'Failed to transform photo data', {
                    photoData,
                    error: error.message
                });
                return null;
            }
        }).filter(photo => photo !== null);
    }
    
    /**
     * Transform album photo data to Photo entities
     * @param {Array} albumPhotoData - Photo data from album
     * @param {string} albumId - Album ID
     * @returns {Array<Photo>} Array of Photo entities
     */
    transformAlbumData(albumPhotoData, albumId) {
        if (!Array.isArray(albumPhotoData)) {
            logger.warn('PhotoService', 'invalid_album_data', 'Album photo data is not an array', { albumPhotoData });
            return [];
        }
        
        return albumPhotoData.map(photoData => {
            try {
                return Photo.fromAlbumData(photoData, albumId, this.config);
            } catch (error) {
                logger.error('PhotoService', 'transform_album_error', 'Failed to transform album photo data', {
                    photoData,
                    albumId,
                    error: error.message
                });
                return null;
            }
        }).filter(photo => photo !== null);
    }
    
    /**
     * Convert Photo entities back to legacy format for backward compatibility
     * @param {Array<Photo>} photos - Array of Photo entities
     * @returns {Array} Array of legacy photo objects
     */
    toLegacyFormat(photos) {
        return photos.map(photo => photo.toLegacyFormat());
    }
    
    /**
     * Update photo star rating
     * @param {Array<Photo>} photos - Current photo array
     * @param {string} photoPath - Path of photo to update
     * @param {number} newStar - New star rating
     * @returns {Array<Photo>} Updated photo array
     */
    updatePhotoStar(photos, photoPath, newStar) {
        return photos.map(photo => {
            if (photo.originalPath === photoPath) {
                return photo.withStar(newStar);
            }
            return photo;
        });
    }
    
    /**
     * Update photo comment
     * @param {Array<Photo>} photos - Current photo array
     * @param {string} photoPath - Path of photo to update
     * @param {string} newComment - New comment
     * @returns {Array<Photo>} Updated photo array
     */
    updatePhotoComment(photos, photoPath, newComment) {
        return photos.map(photo => {
            if (photo.originalPath === photoPath) {
                return photo.withComment(newComment);
            }
            return photo;
        });
    }
    
    /**
     * Remove photo from array
     * @param {Array<Photo>} photos - Current photo array
     * @param {string} photoPath - Path of photo to remove
     * @returns {Array<Photo>} Updated photo array
     */
    removePhoto(photos, photoPath) {
        return photos.filter(photo => photo.originalPath !== photoPath);
    }
    
    /**
     * Move photos to trash
     * @param {Array<Photo>} photos - Current photo array
     * @param {string} photoPath - Path of photo to move to trash
     * @returns {Array<Photo>} Updated photo array
     */
    movePhotoToTrash(photos, photoPath) {
        return photos.map(photo => {
            if (photo.originalPath === photoPath) {
                return photo.moveToTrash();
            }
            return photo;
        });
    }
    
    /**
     * Restore photos from trash
     * @param {Array<Photo>} photos - Current photo array
     * @param {string} photoPath - Path of photo to restore
     * @returns {Array<Photo>} Updated photo array
     */
    restorePhotoFromTrash(photos, photoPath) {
        return photos.map(photo => {
            if (photo.originalPath === photoPath) {
                return photo.restoreFromTrash();
            }
            return photo;
        });
    }
}