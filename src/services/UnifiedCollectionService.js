import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import { logger } from './LoggerService.js';

/**
 * Service layer for unified photo collections
 * Provides adapter methods to integrate with existing ViewMode and PhotosList systems
 */
export class UnifiedCollectionService {
    constructor() {
        this._albumsCache = null;
        this._tagsCache = null;
        this._cacheTimestamp = null;
        this._cacheExpiry = 30000; // 30 seconds
    }
    
    /**
     * Clear the cache (useful when collections are modified)
     */
    clearCache() {
        this._albumsCache = null;
        this._tagsCache = null;
        this._cacheTimestamp = null;
    }
    
    /**
     * Check if cache is valid
     */
    _isCacheValid() {
        return this._cacheTimestamp && 
               (Date.now() - this._cacheTimestamp) < this._cacheExpiry;
    }
    
    /**
     * Get all albums with caching
     */
    async getAlbums() {
        if (!this._isCacheValid() || !this._albumsCache) {
            logger.debug('UnifiedCollectionService', 'cache_miss_albums', 'Fetching albums from backend');
            this._albumsCache = await UnifiedPhotoCollection.getAllAlbums();
            this._cacheTimestamp = Date.now();
        }
        return this._albumsCache;
    }
    
    /**
     * Get all tags with caching
     */
    async getTags() {
        if (!this._isCacheValid() || !this._tagsCache) {
            logger.debug('UnifiedCollectionService', 'cache_miss_tags', 'Fetching tags from backend');
            this._tagsCache = await UnifiedPhotoCollection.getAllTags();
            this._cacheTimestamp = Date.now();
        }
        return this._tagsCache;
    }
    
    /**
     * Get all collections (albums and tags) with caching
     */
    async getAllCollections() {
        const [albums, tags] = await Promise.all([
            this.getAlbums(),
            this.getTags()
        ]);
        return [...albums, ...tags];
    }
    
    /**
     * Create a new collection and update cache
     */
    async createCollection(type, data) {
        logger.info('UnifiedCollectionService', 'create_collection', 'Creating collection', {
            type,
            name: data.name
        });
        
        const collection = await UnifiedPhotoCollection.create(type, data);
        this.clearCache(); // Invalidate cache
        return collection;
    }
    
    /**
     * Update a collection and update cache
     */
    async updateCollection(collectionId, updates) {
        logger.info('UnifiedCollectionService', 'update_collection', 'Updating collection', {
            collectionId,
            updates: Object.keys(updates)
        });
        
        // Find the collection in cache first
        const allCollections = await this.getAllCollections();
        const collection = allCollections.find(c => c.id === collectionId);
        
        if (!collection) {
            throw new Error(`Collection with id ${collectionId} not found`);
        }
        
        await collection.update(updates);
        this.clearCache(); // Invalidate cache
        return collection;
    }
    
    /**
     * Delete a collection and update cache
     */
    async deleteCollection(collectionId) {
        logger.info('UnifiedCollectionService', 'delete_collection', 'Deleting collection', {
            collectionId
        });
        
        // Find the collection in cache first
        const allCollections = await this.getAllCollections();
        const collection = allCollections.find(c => c.id === collectionId);
        
        if (!collection) {
            throw new Error(`Collection with id ${collectionId} not found`);
        }
        
        await collection.delete();
        this.clearCache(); // Invalidate cache
    }
    
    /**
     * Add photos to a collection
     */
    async addPhotosToCollection(collectionId, photoPaths) {
        logger.info('UnifiedCollectionService', 'add_photos', 'Adding photos to collection', {
            collectionId,
            photoCount: photoPaths.length
        });
        
        const allCollections = await this.getAllCollections();
        const collection = allCollections.find(c => c.id === collectionId);
        
        if (!collection) {
            throw new Error(`Collection with id ${collectionId} not found`);
        }
        
        // Add photos one by one
        for (const photoPath of photoPaths) {
            await collection.addPhoto(photoPath);
        }
        
        this.clearCache(); // Invalidate cache to refresh photo counts
        return collection;
    }
    
    /**
     * Remove photos from a collection
     */
    async removePhotosFromCollection(collectionId, photoPaths) {
        logger.info('UnifiedCollectionService', 'remove_photos', 'Removing photos from collection', {
            collectionId,
            photoCount: photoPaths.length
        });
        
        const allCollections = await this.getAllCollections();
        const collection = allCollections.find(c => c.id === collectionId);
        
        if (!collection) {
            throw new Error(`Collection with id ${collectionId} not found`);
        }
        
        // Remove photos one by one
        for (const photoPath of photoPaths) {
            await collection.removePhoto(photoPath);
        }
        
        this.clearCache(); // Invalidate cache to refresh photo counts
        return collection;
    }
    
    /**
     * Search collections by name
     */
    async searchCollections(query, type = null) {
        const allCollections = type ? 
            (type === 'album' ? await this.getAlbums() : await this.getTags()) :
            await this.getAllCollections();
        
        if (!query || query.trim() === '') {
            return allCollections;
        }
        
        const searchTerm = query.toLowerCase().trim();
        return allCollections.filter(collection => 
            collection.name.toLowerCase().includes(searchTerm) ||
            (collection.description && collection.description.toLowerCase().includes(searchTerm))
        );
    }
    
    /**
     * Get collections that contain specific photos
     */
    async getCollectionsForPhotos(photoPaths, type = null) {
        const allCollections = type ? 
            (type === 'album' ? await this.getAlbums() : await this.getTags()) :
            await this.getAllCollections();
        
        const results = new Map();
        
        // Check each collection to see which photos it contains
        for (const collection of allCollections) {
            const collectionPhotos = await collection.getPhotos();
            const collectionPhotoPaths = collectionPhotos.map(photo => 
                photo.file?.path || photo.path
            );
            
            const containedPhotos = photoPaths.filter(photoPath => 
                collectionPhotoPaths.includes(photoPath)
            );
            
            if (containedPhotos.length > 0) {
                results.set(collection.id, {
                    collection,
                    containedPhotos
                });
            }
        }
        
        return results;
    }
    
    /**
     * Convert legacy album data to unified collection format
     * This helps with migration from old album system
     */
    convertLegacyAlbumData(albumData) {
        return {
            id: albumData.id || albumData.album_id,
            type: 'album',
            name: albumData.name || albumData.album_name,
            description: albumData.description,
            color: null,
            cover_photo_path: albumData.cover_photo_path,
            photo_count: albumData.photo_count || 0,
            settings: {},
            created_at: albumData.created_at,
            updated_at: albumData.updated_at
        };
    }
    
    /**
     * Convert legacy tag data to unified collection format
     * This helps with migration from old tag system
     */
    convertLegacyTagData(tagData) {
        return {
            id: tagData.id || tagData.tag_id,
            type: 'tag',
            name: tagData.name || tagData.tag_name,
            description: null,
            color: tagData.color,
            cover_photo_path: null,
            photo_count: tagData.photo_count || 0,
            settings: {},
            created_at: tagData.created_at,
            updated_at: tagData.updated_at
        };
    }
    
    /**
     * Bulk operations for efficiency
     */
    async bulkAddPhotosToCollections(photoPath, collectionIds) {
        logger.info('UnifiedCollectionService', 'bulk_add_photo', 'Adding photo to multiple collections', {
            photoPath,
            collectionCount: collectionIds.length
        });
        
        const results = [];
        for (const collectionId of collectionIds) {
            try {
                await this.addPhotosToCollection(collectionId, [photoPath]);
                results.push({ collectionId, success: true });
            } catch (error) {
                logger.error('UnifiedCollectionService', 'bulk_add_error', 'Failed to add photo to collection', {
                    collectionId,
                    error: error.message
                });
                results.push({ collectionId, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Get collection statistics
     */
    async getCollectionStats() {
        const [albums, tags] = await Promise.all([
            this.getAlbums(),
            this.getTags()
        ]);
        
        const albumStats = albums.reduce((acc, album) => {
            acc.count += 1;
            acc.totalPhotos += album.photoCount;
            return acc;
        }, { count: 0, totalPhotos: 0 });
        
        const tagStats = tags.reduce((acc, tag) => {
            acc.count += 1;
            acc.totalPhotos += tag.photoCount;
            return acc;
        }, { count: 0, totalPhotos: 0 });
        
        return {
            albums: albumStats,
            tags: tagStats,
            total: {
                count: albumStats.count + tagStats.count,
                totalPhotos: albumStats.totalPhotos + tagStats.totalPhotos
            }
        };
    }
}

// Export singleton instance
export const unifiedCollectionService = new UnifiedCollectionService();