import { invoke } from "@tauri-apps/api/core";
import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';
import { logger } from '../services/LoggerService.js';

/**
 * Utilities for migrating from legacy album/tag system to unified collections
 */
export class CollectionMigrationUtils {
    
    /**
     * Check if migration is needed by comparing old and new collections
     */
    static async needsMigration() {
        try {
            // Check if we have any data in the new unified tables
            const unifiedCollections = await UnifiedPhotoCollection.getAll();
            
            // Check if we have any data in the legacy tables
            const [legacyAlbums, legacyTags] = await Promise.all([
                invoke("get_all_albums").catch(() => []),
                invoke("get_all_tags_with_photo_count").catch(() => [])
            ]);
            
            const hasLegacyData = (Array.isArray(legacyAlbums) && legacyAlbums.length > 0) ||
                                 (Array.isArray(legacyTags) && legacyTags.length > 0);
            const hasUnifiedData = unifiedCollections.length > 0;
            
            logger.info('CollectionMigrationUtils', 'migration_check', 'Migration status check', {
                hasLegacyData,
                hasUnifiedData,
                legacyAlbumsCount: Array.isArray(legacyAlbums) ? legacyAlbums.length : 0,
                legacyTagsCount: Array.isArray(legacyTags) ? legacyTags.length : 0,
                unifiedCollectionsCount: unifiedCollections.length
            });
            
            // Migration needed if we have legacy data but no/incomplete unified data
            return hasLegacyData && !hasUnifiedData;
        } catch (error) {
            logger.error('CollectionMigrationUtils', 'migration_check_error', 'Error checking migration status', {
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Perform the migration from legacy to unified collections
     */
    static async performMigration() {
        logger.info('CollectionMigrationUtils', 'migration_start', 'Starting collection migration');
        
        try {
            // Step 1: Migrate albums
            const albumResults = await this.migrateLegacyAlbums();
            
            // Step 2: Migrate tags
            const tagResults = await this.migrateLegacyTags();
            
            // Step 3: Trigger backend migration to ensure data consistency
            await invoke("migrate_to_unified_collections");
            
            // Step 4: Clear service cache to ensure fresh data
            unifiedCollectionService.clearCache();
            
            const totalMigrated = albumResults.success + tagResults.success;
            const totalFailed = albumResults.failed + tagResults.failed;
            
            logger.info('CollectionMigrationUtils', 'migration_complete', 'Collection migration completed', {
                totalMigrated,
                totalFailed,
                albumsMigrated: albumResults.success,
                albumsFailed: albumResults.failed,
                tagsMigrated: tagResults.success,
                tagsFailed: tagResults.failed
            });
            
            return {
                success: true,
                totalMigrated,
                totalFailed,
                details: {
                    albums: albumResults,
                    tags: tagResults
                }
            };
            
        } catch (error) {
            logger.error('CollectionMigrationUtils', 'migration_error', 'Migration failed', {
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Migrate legacy albums to unified collections
     */
    static async migrateLegacyAlbums() {
        logger.info('CollectionMigrationUtils', 'migrate_albums', 'Starting album migration');
        
        let success = 0;
        let failed = 0;
        const errors = [];
        
        try {
            // Get legacy albums
            const legacyAlbums = await invoke("get_all_albums");
            
            if (!Array.isArray(legacyAlbums)) {
                logger.warn('CollectionMigrationUtils', 'no_legacy_albums', 'No legacy albums found');
                return { success: 0, failed: 0, errors: [] };
            }
            
            logger.info('CollectionMigrationUtils', 'album_count', 'Found legacy albums', {
                count: legacyAlbums.length
            });
            
            // Migrate each album
            for (const legacyAlbum of legacyAlbums) {
                try {
                    const albumData = unifiedCollectionService.convertLegacyAlbumData(legacyAlbum);
                    
                    // Create unified collection (this will call the backend)
                    await UnifiedPhotoCollection.create('album', {
                        name: albumData.name,
                        description: albumData.description
                    });
                    
                    success++;
                    logger.debug('CollectionMigrationUtils', 'album_migrated', 'Album migrated successfully', {
                        albumName: albumData.name
                    });
                    
                } catch (error) {
                    failed++;
                    const errorMsg = `Failed to migrate album "${legacyAlbum.name}": ${error.message}`;
                    errors.push(errorMsg);
                    logger.error('CollectionMigrationUtils', 'album_migration_error', errorMsg);
                }
            }
            
        } catch (error) {
            logger.error('CollectionMigrationUtils', 'album_fetch_error', 'Error fetching legacy albums', {
                error: error.message
            });
            errors.push(`Error fetching legacy albums: ${error.message}`);
        }
        
        return { success, failed, errors };
    }
    
    /**
     * Migrate legacy tags to unified collections
     */
    static async migrateLegacyTags() {
        logger.info('CollectionMigrationUtils', 'migrate_tags', 'Starting tag migration');
        
        let success = 0;
        let failed = 0;
        const errors = [];
        
        try {
            // Get legacy tags
            const legacyTags = await invoke("get_all_tags_with_photo_count");
            
            if (!Array.isArray(legacyTags)) {
                logger.warn('CollectionMigrationUtils', 'no_legacy_tags', 'No legacy tags found');
                return { success: 0, failed: 0, errors: [] };
            }
            
            logger.info('CollectionMigrationUtils', 'tag_count', 'Found legacy tags', {
                count: legacyTags.length
            });
            
            // Migrate each tag
            for (const legacyTag of legacyTags) {
                try {
                    const tagData = unifiedCollectionService.convertLegacyTagData(legacyTag);
                    
                    // Create unified collection (this will call the backend)
                    await UnifiedPhotoCollection.create('tag', {
                        name: tagData.name,
                        color: tagData.color
                    });
                    
                    success++;
                    logger.debug('CollectionMigrationUtils', 'tag_migrated', 'Tag migrated successfully', {
                        tagName: tagData.name
                    });
                    
                } catch (error) {
                    failed++;
                    const errorMsg = `Failed to migrate tag "${legacyTag.name}": ${error.message}`;
                    errors.push(errorMsg);
                    logger.error('CollectionMigrationUtils', 'tag_migration_error', errorMsg);
                }
            }
            
        } catch (error) {
            logger.error('CollectionMigrationUtils', 'tag_fetch_error', 'Error fetching legacy tags', {
                error: error.message
            });
            errors.push(`Error fetching legacy tags: ${error.message}`);
        }
        
        return { success, failed, errors };
    }
    
    /**
     * Verify migration was successful by comparing counts
     */
    static async verifyMigration() {
        try {
            // Get counts from unified system
            const stats = await unifiedCollectionService.getCollectionStats();
            
            // Get counts from legacy system
            const [legacyAlbums, legacyTags] = await Promise.all([
                invoke("get_all_albums").catch(() => []),
                invoke("get_all_tags_with_photo_count").catch(() => [])
            ]);
            
            const legacyAlbumCount = Array.isArray(legacyAlbums) ? legacyAlbums.length : 0;
            const legacyTagCount = Array.isArray(legacyTags) ? legacyTags.length : 0;
            
            const verification = {
                albums: {
                    legacy: legacyAlbumCount,
                    unified: stats.albums.count,
                    match: legacyAlbumCount === stats.albums.count
                },
                tags: {
                    legacy: legacyTagCount,
                    unified: stats.tags.count,
                    match: legacyTagCount === stats.tags.count
                }
            };
            
            verification.overall = verification.albums.match && verification.tags.match;
            
            logger.info('CollectionMigrationUtils', 'migration_verification', 'Migration verification results', verification);
            
            return verification;
            
        } catch (error) {
            logger.error('CollectionMigrationUtils', 'verification_error', 'Error verifying migration', {
                error: error.message
            });
            return {
                error: error.message,
                overall: false
            };
        }
    }
    
    /**
     * Get migration status and recommendations
     */
    static async getMigrationStatus() {
        const needsMigration = await this.needsMigration();
        
        if (!needsMigration) {
            return {
                status: 'complete',
                message: 'No migration needed - unified collections are up to date',
                recommendation: 'none'
            };
        }
        
        return {
            status: 'needed',
            message: 'Legacy albums/tags detected - migration recommended',
            recommendation: 'migrate'
        };
    }
    
    /**
     * Force re-migration (useful for testing or fixing issues)
     */
    static async forceMigration() {
        logger.warn('CollectionMigrationUtils', 'force_migration', 'Force migration requested');
        
        // Clear existing unified collections first
        try {
            const existingCollections = await UnifiedPhotoCollection.getAll();
            for (const collection of existingCollections) {
                await collection.delete();
            }
            logger.info('CollectionMigrationUtils', 'cleared_existing', 'Cleared existing unified collections', {
                count: existingCollections.length
            });
        } catch (error) {
            logger.warn('CollectionMigrationUtils', 'clear_error', 'Error clearing existing collections', {
                error: error.message
            });
        }
        
        // Perform migration
        return await this.performMigration();
    }
}