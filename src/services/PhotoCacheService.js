/**
 * PhotoCacheService - Unified cache management for PhotoClove
 * Implements Phase 4 of the state management refactoring plan
 */
import { logger } from './LoggerService.js';

class PhotoCacheService {
  constructor() {
    // Cache storage maps
    this.thumbnailCache = new Map();
    this.photoCache = new Map();
    this.tagCache = new Map();
    this.metadataCache = new Map();
    this.albumCache = new Map();
    
    // Cache configuration
    this.config = {
      maxThumbnailCacheSize: 1000,
      maxPhotoCacheSize: 500,
      maxTagCacheSize: 200,
      maxMetadataCacheSize: 1000,
      maxAlbumCacheSize: 100,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      maxAge: 30 * 60 * 1000 // 30 minutes
    };
    
    // Cache statistics
    this.stats = {
      thumbnailHits: 0,
      thumbnailMisses: 0,
      photoHits: 0,
      photoMisses: 0,
      tagHits: 0,
      tagMisses: 0,
      cleanupRuns: 0
    };
    
    // Access tracking for LRU eviction
    this.accessTimes = new Map();
    
    // Start periodic cleanup
    this.startCleanupTimer();
    
    logger.info('PhotoCacheService', 'initialized', 'Photo cache service initialized', {
      config: this.config
    });
  }
  
  // Thumbnail cache methods
  getThumbnail(path) {
    const cached = this.thumbnailCache.get(path);
    if (cached && this.isValidCacheEntry(cached)) {
      this.updateAccessTime(path, 'thumbnail');
      this.stats.thumbnailHits++;
      
      logger.debug('PhotoCacheService', 'thumbnail_cache_hit', 'Thumbnail cache hit', {
        path,
        cacheSize: this.thumbnailCache.size
      });
      
      return cached.data;
    }
    
    this.stats.thumbnailMisses++;
    logger.debug('PhotoCacheService', 'thumbnail_cache_miss', 'Thumbnail cache miss', {
      path,
      cacheSize: this.thumbnailCache.size
    });
    
    return null;
  }
  
  setThumbnail(path, data) {
    const entry = {
      data,
      timestamp: Date.now(),
      type: 'thumbnail'
    };
    
    this.thumbnailCache.set(path, entry);
    this.updateAccessTime(path, 'thumbnail');
    
    logger.debug('PhotoCacheService', 'thumbnail_cached', 'Thumbnail cached', {
      path,
      cacheSize: this.thumbnailCache.size
    });
    
    // Cleanup if needed
    this.cleanupCacheIfNeeded('thumbnail');
  }
  
  // Photo cache methods
  getPhoto(path) {
    const cached = this.photoCache.get(path);
    if (cached && this.isValidCacheEntry(cached)) {
      this.updateAccessTime(path, 'photo');
      this.stats.photoHits++;
      
      logger.debug('PhotoCacheService', 'photo_cache_hit', 'Photo cache hit', {
        path,
        cacheSize: this.photoCache.size
      });
      
      return cached.data;
    }
    
    this.stats.photoMisses++;
    logger.debug('PhotoCacheService', 'photo_cache_miss', 'Photo cache miss', {
      path,
      cacheSize: this.photoCache.size
    });
    
    return null;
  }
  
  setPhoto(path, data) {
    const entry = {
      data,
      timestamp: Date.now(),
      type: 'photo'
    };
    
    this.photoCache.set(path, entry);
    this.updateAccessTime(path, 'photo');
    
    logger.debug('PhotoCacheService', 'photo_cached', 'Photo cached', {
      path,
      cacheSize: this.photoCache.size
    });
    
    this.cleanupCacheIfNeeded('photo');
  }
  
  // Tag cache methods
  getTags(photoPath) {
    const cached = this.tagCache.get(photoPath);
    if (cached && this.isValidCacheEntry(cached)) {
      this.updateAccessTime(photoPath, 'tag');
      this.stats.tagHits++;
      
      logger.debug('PhotoCacheService', 'tag_cache_hit', 'Tag cache hit', {
        photoPath,
        tagCount: cached.data.length
      });
      
      return cached.data;
    }
    
    this.stats.tagMisses++;
    return null;
  }
  
  setTags(photoPath, tags) {
    const entry = {
      data: tags,
      timestamp: Date.now(),
      type: 'tag'
    };
    
    this.tagCache.set(photoPath, entry);
    this.updateAccessTime(photoPath, 'tag');
    
    logger.debug('PhotoCacheService', 'tags_cached', 'Tags cached', {
      photoPath,
      tagCount: tags.length
    });
    
    this.cleanupCacheIfNeeded('tag');
  }
  
  // Metadata cache methods
  getMetadata(path) {
    const cached = this.metadataCache.get(path);
    if (cached && this.isValidCacheEntry(cached)) {
      this.updateAccessTime(path, 'metadata');
      return cached.data;
    }
    return null;
  }
  
  setMetadata(path, metadata) {
    const entry = {
      data: metadata,
      timestamp: Date.now(),
      type: 'metadata'
    };
    
    this.metadataCache.set(path, entry);
    this.updateAccessTime(path, 'metadata');
    this.cleanupCacheIfNeeded('metadata');
  }
  
  // Album cache methods
  getAlbumPhotos(albumId) {
    const cached = this.albumCache.get(albumId);
    if (cached && this.isValidCacheEntry(cached)) {
      this.updateAccessTime(albumId, 'album');
      return cached.data;
    }
    return null;
  }
  
  setAlbumPhotos(albumId, photos) {
    const entry = {
      data: photos,
      timestamp: Date.now(),
      type: 'album'
    };
    
    this.albumCache.set(albumId, entry);
    this.updateAccessTime(albumId, 'album');
    this.cleanupCacheIfNeeded('album');
  }
  
  // Cache invalidation methods
  invalidateThumbnail(path) {
    this.thumbnailCache.delete(path);
    this.accessTimes.delete(`thumbnail:${path}`);
    
    logger.debug('PhotoCacheService', 'thumbnail_invalidated', 'Thumbnail cache invalidated', { path });
  }
  
  invalidatePhoto(path) {
    this.photoCache.delete(path);
    this.accessTimes.delete(`photo:${path}`);
    
    logger.debug('PhotoCacheService', 'photo_invalidated', 'Photo cache invalidated', { path });
  }
  
  invalidateTags(photoPath) {
    this.tagCache.delete(photoPath);
    this.accessTimes.delete(`tag:${photoPath}`);
    
    logger.debug('PhotoCacheService', 'tags_invalidated', 'Tags cache invalidated', { photoPath });
  }
  
  invalidateAlbum(albumId) {
    this.albumCache.delete(albumId);
    this.accessTimes.delete(`album:${albumId}`);
    
    logger.debug('PhotoCacheService', 'album_invalidated', 'Album cache invalidated', { albumId });
  }
  
  // Bulk invalidation methods
  invalidateAllThumbnails() {
    const count = this.thumbnailCache.size;
    this.thumbnailCache.clear();
    
    // Clear related access times
    for (const key of this.accessTimes.keys()) {
      if (key.startsWith('thumbnail:')) {
        this.accessTimes.delete(key);
      }
    }
    
    logger.info('PhotoCacheService', 'thumbnails_cleared', 'All thumbnails cleared from cache', { count });
  }
  
  invalidateAllTags() {
    const count = this.tagCache.size;
    this.tagCache.clear();
    
    for (const key of this.accessTimes.keys()) {
      if (key.startsWith('tag:')) {
        this.accessTimes.delete(key);
      }
    }
    
    logger.info('PhotoCacheService', 'tags_cleared', 'All tags cleared from cache', { count });
  }
  
  // Utility methods
  isValidCacheEntry(entry) {
    const age = Date.now() - entry.timestamp;
    return age < this.config.maxAge;
  }
  
  updateAccessTime(key, type) {
    this.accessTimes.set(`${type}:${key}`, Date.now());
  }
  
  getCacheForType(type) {
    switch (type) {
      case 'thumbnail': return this.thumbnailCache;
      case 'photo': return this.photoCache;
      case 'tag': return this.tagCache;
      case 'metadata': return this.metadataCache;
      case 'album': return this.albumCache;
      default: return null;
    }
  }
  
  getMaxSizeForType(type) {
    switch (type) {
      case 'thumbnail': return this.config.maxThumbnailCacheSize;
      case 'photo': return this.config.maxPhotoCacheSize;
      case 'tag': return this.config.maxTagCacheSize;
      case 'metadata': return this.config.maxMetadataCacheSize;
      case 'album': return this.config.maxAlbumCacheSize;
      default: return 100;
    }
  }
  
  cleanupCacheIfNeeded(type) {
    const cache = this.getCacheForType(type);
    const maxSize = this.getMaxSizeForType(type);
    
    if (cache && cache.size > maxSize) {
      this.performLRUCleanup(type, cache, maxSize);
    }
  }
  
  performLRUCleanup(type, cache, maxSize) {
    // Get access times for this cache type
    const accessEntries = Array.from(this.accessTimes.entries())
      .filter(([key]) => key.startsWith(`${type}:`))
      .map(([key, time]) => ({ key: key.replace(`${type}:`, ''), time }))
      .sort((a, b) => a.time - b.time); // Oldest first
    
    // Calculate how many entries to remove
    const entriesToRemove = cache.size - Math.floor(maxSize * 0.8); // Remove to 80% of max
    
    // Remove oldest entries
    for (let i = 0; i < entriesToRemove && i < accessEntries.length; i++) {
      const { key } = accessEntries[i];
      cache.delete(key);
      this.accessTimes.delete(`${type}:${key}`);
    }
    
    logger.info('PhotoCacheService', 'lru_cleanup', `LRU cleanup performed for ${type} cache`, {
      type,
      removedCount: entriesToRemove,
      remainingCount: cache.size,
      maxSize
    });
  }
  
  // Periodic cleanup
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.performPeriodicCleanup();
    }, this.config.cleanupInterval);
  }
  
  performPeriodicCleanup() {
    const now = Date.now();
    let totalRemoved = 0;
    
    // Clean expired entries from all caches
    const cacheTypes = ['thumbnail', 'photo', 'tag', 'metadata', 'album'];
    
    for (const type of cacheTypes) {
      const cache = this.getCacheForType(type);
      const initialSize = cache.size;
      
      for (const [key, entry] of cache.entries()) {
        if (!this.isValidCacheEntry(entry)) {
          cache.delete(key);
          this.accessTimes.delete(`${type}:${key}`);
        }
      }
      
      const removed = initialSize - cache.size;
      totalRemoved += removed;
    }
    
    this.stats.cleanupRuns++;
    
    if (totalRemoved > 0) {
      logger.info('PhotoCacheService', 'periodic_cleanup', 'Periodic cache cleanup completed', {
        totalRemoved,
        cleanupRuns: this.stats.cleanupRuns
      });
    }
  }
  
  // Clear all caches
  clear() {
    const stats = this.getStats();
    
    this.thumbnailCache.clear();
    this.photoCache.clear();
    this.tagCache.clear();
    this.metadataCache.clear();
    this.albumCache.clear();
    this.accessTimes.clear();
    
    logger.info('PhotoCacheService', 'cache_cleared', 'All caches cleared', { previousStats: stats });
  }
  
  // Get cache statistics
  getStats() {
    return {
      ...this.stats,
      thumbnailCacheSize: this.thumbnailCache.size,
      photoCacheSize: this.photoCache.size,
      tagCacheSize: this.tagCache.size,
      metadataCacheSize: this.metadataCache.size,
      albumCacheSize: this.albumCache.size,
      totalCacheSize: this.thumbnailCache.size + this.photoCache.size + this.tagCache.size + this.metadataCache.size + this.albumCache.size,
      thumbnailHitRate: this.stats.thumbnailHits / (this.stats.thumbnailHits + this.stats.thumbnailMisses) || 0,
      photoHitRate: this.stats.photoHits / (this.stats.photoHits + this.stats.photoMisses) || 0,
      tagHitRate: this.stats.tagHits / (this.stats.tagHits + this.stats.tagMisses) || 0
    };
  }
  
  // Destroy the service
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clear();
    
    logger.info('PhotoCacheService', 'destroyed', 'Photo cache service destroyed');
  }
}

// Create singleton instance
export const photoCacheService = new PhotoCacheService();

// Export the class for testing
export { PhotoCacheService };