import { invoke } from "@tauri-apps/api/core";
import { logger } from '../services/LoggerService.js';

/**
 * UnifiedPhotoCollection - Domain model for unified albums and tags
 * 
 * This represents individual albums/tags as unified collection entities,
 * as opposed to the existing PhotoCollection which represents collections of photos.
 */
export class UnifiedPhotoCollection {
    constructor(data) {
        this.id = data.id;
        this.type = data.type; // 'album' | 'tag'
        this.name = data.name;
        this.color = data.color;
        this.description = data.description;
        this.coverPhotoPath = data.coverPhotoPath;
        this.photoCount = data.photo_count || 0;
        this.settings = data.settings || {};
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }
    
    /**
     * Check if this collection is an album
     */
    isAlbum() {
        return this.type === 'album';
    }
    
    /**
     * Check if this collection is a tag
     */
    isTag() {
        return this.type === 'tag';
    }
    
    /**
     * Get display icon for this collection type
     */
    getDisplayIcon() {
        return this.isAlbum() ? '📚' : '🏷️';
    }
    
    /**
     * Check if this collection supports photo ordering
     */
    supportsOrdering() {
        return this.isAlbum();
    }
    
    /**
     * Check if this collection supports descriptions
     */
    supportsDescription() {
        return this.isAlbum();
    }
    
    /**
     * Get visual identifier for display
     */
    getVisualIdentifier() {
        if (this.isAlbum() && this.coverPhotoPath) {
            return { type: 'image', value: this.coverPhotoPath };
        }
        if (this.isTag() && this.color) {
            return { type: 'color', value: this.color };
        }
        return { type: 'icon', value: this.getDisplayIcon() };
    }
    
    /**
     * Get display name for this collection
     */
    getDisplayName() {
        return this.name;
    }
    
    /**
     * Get display subtitle (description for albums, color for tags)
     */
    getDisplaySubtitle() {
        if (this.isAlbum()) {
            return this.description || `${this.photoCount} photos`;
        }
        return `${this.photoCount} photos`;
    }
    
    /**
     * Create a new collection
     */
    static async create(type, data) {
        logger.info('UnifiedPhotoCollection', 'create_collection', 'Creating new collection', {
            type,
            name: data.name
        });
        
        const result = await invoke("create_collection", {
            collectionType: type,
            name: data.name,
            description: data.description || null,
            color: data.color || null
        });
        
        return new UnifiedPhotoCollection({
            id: result,
            type,
            ...data,
            photo_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    
    /**
     * Get all collections of a specific type or all types
     */
    static async getAll(type = null) {
        logger.info('UnifiedPhotoCollection', 'get_all_collections', 'Fetching collections', {
            type: type || 'all'
        });
        
        const result = await invoke("get_all_collections", {
            collectionType: type
        });
        
        const collections = JSON.parse(result);
        return collections.map(data => new UnifiedPhotoCollection(data));
    }
    
    /**
     * Get all albums
     */
    static async getAllAlbums() {
        return await UnifiedPhotoCollection.getAll('album');
    }
    
    /**
     * Get all tags
     */
    static async getAllTags() {
        return await UnifiedPhotoCollection.getAll('tag');
    }
    
    /**
     * Update this collection
     */
    async update(updates) {
        logger.info('UnifiedPhotoCollection', 'update_collection', 'Updating collection', {
            id: this.id,
            updates: Object.keys(updates)
        });
        
        await invoke("update_collection", {
            id: this.id,
            name: updates.name || null,
            description: updates.description || null,
            color: updates.color || null,
            coverPhotoPath: updates.coverPhotoPath || null
        });
        
        // Update local properties
        Object.assign(this, updates);
        this.updatedAt = new Date().toISOString();
    }
    
    /**
     * Delete this collection
     */
    async delete() {
        logger.info('UnifiedPhotoCollection', 'delete_collection', 'Deleting collection', {
            id: this.id,
            type: this.type,
            name: this.name
        });
        
        await invoke("delete_collection", {
            id: this.id
        });
    }
    
    /**
     * Add a photo to this collection
     */
    async addPhoto(photoPath) {
        logger.info('UnifiedPhotoCollection', 'add_photo', 'Adding photo to collection', {
            collectionId: this.id,
            photoPath
        });
        
        await invoke("add_photo_to_collection", {
            collectionId: this.id,
            photoPath
        });
        
        this.photoCount += 1;
    }
    
    /**
     * Remove a photo from this collection
     */
    async removePhoto(photoPath) {
        logger.info('UnifiedPhotoCollection', 'remove_photo', 'Removing photo from collection', {
            collectionId: this.id,
            photoPath
        });
        
        await invoke("remove_photo_from_collection", {
            collectionId: this.id,
            photoPath
        });
        
        this.photoCount = Math.max(0, this.photoCount - 1);
    }
    
    /**
     * Get photos in this collection
     */
    async getPhotos(ordered = false) {
        logger.info('UnifiedPhotoCollection', 'get_collection_photos', 'Fetching collection photos', {
            collectionId: this.id,
            ordered
        });
        
        const result = await invoke("get_collection_photos", {
            collectionId: this.id,
            ordered: this.supportsOrdering() ? ordered : false
        });
        
        const photos = JSON.parse(result);
        return photos;
    }
    
    /**
     * Reorder photos in this collection (albums only)
     */
    async reorderPhotos(photoOrder) {
        if (!this.supportsOrdering()) {
            throw new Error('Photo ordering is only supported for albums');
        }
        
        logger.info('UnifiedPhotoCollection', 'reorder_photos', 'Reordering collection photos', {
            collectionId: this.id,
            photoCount: photoOrder.length
        });
        
        await invoke("reorder_collection_photos", {
            collectionId: this.id,
            photoOrder
        });
    }
    
    /**
     * Search collections by name
     */
    static async search(query, type = null) {
        const allCollections = await UnifiedPhotoCollection.getAll(type);
        
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
     * Get collections that contain a specific photo
     */
    static async getCollectionsForPhoto(photoPath, type = null) {
        // This would need a new backend endpoint to efficiently get collections for a photo
        // For now, we'll implement it by checking all collections
        const allCollections = await UnifiedPhotoCollection.getAll(type);
        const collectionsWithPhoto = [];
        
        for (const collection of allCollections) {
            const photos = await collection.getPhotos();
            if (photos.some(photo => photo.file?.path === photoPath || photo.path === photoPath)) {
                collectionsWithPhoto.push(collection);
            }
        }
        
        return collectionsWithPhoto;
    }
    
    /**
     * Clone this collection (useful for creating similar collections)
     */
    clone(newName = null) {
        return new UnifiedPhotoCollection({
            id: null, // Will be set when created
            type: this.type,
            name: newName || `Copy of ${this.name}`,
            color: this.color,
            description: this.description,
            cover_photo_path: null, // Don't copy cover photo
            photo_count: 0,
            settings: { ...this.settings },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    
    /**
     * Convert to JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            color: this.color,
            description: this.description,
            cover_photo_path: this.coverPhotoPath,
            photo_count: this.photoCount,
            settings: this.settings,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }
    
    /**
     * Create from JSON data
     */
    static fromJSON(data) {
        return new UnifiedPhotoCollection(data);
    }
    
    /**
     * Validate collection data
     */
    static validate(data) {
        const errors = [];
        
        if (!data.name || data.name.trim() === '') {
            errors.push('Name is required');
        }
        
        if (!['album', 'tag'].includes(data.type)) {
            errors.push('Type must be either "album" or "tag"');
        }
        
        if (data.type === 'tag' && data.description) {
            errors.push('Tags do not support descriptions');
        }
        
        if (data.name && data.name.length > 255) {
            errors.push('Name must be 255 characters or less');
        }
        
        if (data.description && data.description.length > 1000) {
            errors.push('Description must be 1000 characters or less');
        }
        
        if (data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
            errors.push('Color must be a valid hex color code');
        }
        
        return errors;
    }
    
    /**
     * Factory method for creating albums
     */
    static createAlbum(name, description = null) {
        return {
            type: 'album',
            name,
            description,
            color: null
        };
    }
    
    /**
     * Factory method for creating tags
     */
    static createTag(name, color = null) {
        return {
            type: 'tag',
            name,
            description: null,
            color
        };
    }
}