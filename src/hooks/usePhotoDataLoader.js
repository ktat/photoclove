import { useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';

/**
 * Custom hook for managing data loading operations
 * Extracted from PhotosList.jsx to reduce component complexity
 */
export function usePhotoDataLoader({ 
    handleError,
    convertPhotosToEntities,
    updateAlbumsList,
    setFilteredAlbums,
    updateAlbumPhotos,
    setPhotosList,
    setTagsList,
    setFilteredTags,
    setTagPhotos,
    setTrashPhotos,
    setCurrentAlbumName,
    openAlbum,
    setFilterOptions,
    setIsFilterOptionsLoading,
    filterOptions,
    isFilterOptionsLoading,
    appConfig
}) {
    
    // Logger helper functions for consistent logging patterns
    const logOperation = useMemo(() => ({
        start: (operation, context = {}) => 
            logger.info('PhotosList', `${operation.replace(/\s+/g, '_')}_start`, `Starting ${operation}`, context),
        complete: (operation, context = {}) => 
            logger.info('PhotosList', `${operation.replace(/\s+/g, '_')}_complete`, `${operation} completed successfully`, context),
        click: (operation, context = {}) =>
            logger.info('PhotosList', `${operation.replace(/\s+/g, '_')}_click`, `User clicked on ${operation}`, context),
        debug: (operation, message, context = {}) =>
            logger.debug('PhotosList', operation.replace(/\s+/g, '_'), message, context)
    }), []);

    // Core unified data loading function
    const loadUnifiedData = useCallback(async (searchType, params = {}, context = {}) => {
        const operation = context.operation || searchType.replace(/_/g, ' ');
        logger.info('PhotosList', `load_${searchType}_start`, `Loading ${operation}...`, context);
        
        try {
            const result = await invoke("get_photos_unified", {
                request: { type: "search", search_type: searchType, ...params }
            });
            const data = JSON.parse(result);
            
            logger.info('PhotosList', `load_${searchType}_complete`, `${operation} loaded successfully`, {
                ...context,
                count: data?.photos?.length || data?.length || 0
            });
            
            return data;
        } catch (error) {
            handleError(error, `Load ${operation}`, context);
            throw error;
        }
    }, [handleError]);

    // Album loading functions
    const loadAlbums = useCallback(async () => {
        try {
            logger.info('PhotosList', 'load_albums_start', 'Loading albums via unified collection service');

            const unifiedAlbums = await unifiedCollectionService.getAlbums();

            const processedAlbums = unifiedAlbums.map(album => ({
                id: album.id,
                name: album.name,
                description: album.description,
                coverPhoto: album.coverPhoto,  // Changed: use full Photo entity object, not just path
                photoCount: album.photoCount
            }));

            logger.info('PhotosList', 'load_albums_complete', 'Albums loaded successfully', {
                count: processedAlbums.length,
                albumsWithCoverPhotos: processedAlbums.filter(a => a.coverPhoto).length
            });

            updateAlbumsList(processedAlbums);
            setFilteredAlbums(processedAlbums);
        } catch (error) {
            handleError(error, 'Load albums');
        }
    }, [updateAlbumsList, setFilteredAlbums, handleError]);

    const loadAlbumPhotos = useCallback(async (albumId) => {
        try {
            const data = await loadUnifiedData('album_photos', 
                { params: { album_id: albumId } }, 
                { operation: 'album photos', albumId });
            
            // Handle both array and object formats
            const albumPhotosData = data.photos || data;

            // Convert to Photo entities and then to JSON for state storage
            const photosAsJSON = convertPhotosToEntities(albumPhotosData, false, true);
            updateAlbumPhotos(photosAsJSON);
            setPhotosList({ photos: photosAsJSON });
        } catch (error) {
            // Error already handled by loadUnifiedData
        }
    }, [updateAlbumPhotos, loadUnifiedData, setPhotosList, convertPhotosToEntities]);

    // Handle album click to switch to album view
    const handleAlbumClick = useCallback((album) => {
        logOperation.click('album', {
            albumId: album.id,
            albumName: album.name
        });

        // Switch to album view mode
        openAlbum(album.id);
        setCurrentAlbumName(album.name);

        // Load photos for this album
        loadAlbumPhotos(album.id);
    }, [openAlbum, loadAlbumPhotos, logOperation, setCurrentAlbumName]);

    // Tag loading functions
    const loadTags = useCallback(async () => {
        try {
            logger.info('PhotosList', 'load_tags_start', 'Loading tags via unified collection service');
            
            const unifiedTags = await unifiedCollectionService.getTags();

            const processedTags = unifiedTags.map(tag => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                photoCount: tag.photoCount
            }));

            logger.info('PhotosList', 'load_tags_complete', 'Tags loaded successfully', {
                count: processedTags.length
            });

            setTagsList(processedTags);
            setFilteredTags(processedTags);
        } catch (error) {
            handleError(error, 'Load tags');
        }
    }, [setTagsList, setFilteredTags, handleError]);

    const loadTagPhotos = useCallback(async (tagId) => {
        try {
            const data = await loadUnifiedData('tag', 
                { query: tagId.toString() }, 
                { operation: 'tag photos', tagId });
            
            // Handle both array and object formats
            const tagPhotosData = data.photos || data;

            // Convert to Photo entities and then to JSON for state storage
            const photosAsJSON = convertPhotosToEntities(tagPhotosData, false, true);

            // Set tagPhotos with JSON for React state
            setTagPhotos(photosAsJSON);
            setPhotosList({ photos: photosAsJSON });
        } catch (error) {
            // Error already handled by loadUnifiedData
        }
    }, [loadUnifiedData, setTagPhotos, setPhotosList, convertPhotosToEntities]);

    // Load trash photos
    const loadTrashPhotos = useCallback(async () => {
        try {
            const photosData = await loadUnifiedData('trash', {}, { 
                operation: 'trash photos',
                hasConfig: !!appConfig,
                configTrashPath: appConfig?.trash_path,
                configThumbnailStore: appConfig?.thumbnail_store
            });

            // Handle both array and object formats
            let photos = [];
            if (Array.isArray(photosData)) {
                photos = photosData;
            } else if (photosData && photosData.photos) {
                photos = photosData.photos;
            }

            // Convert to Photo entities and then to JSON for state storage
            const photosAsJSON = convertPhotosToEntities(photos, true, true); // isFromTrash = true
            setTrashPhotos(photosAsJSON);
        } catch (error) {
            // Error already handled by loadUnifiedData
        }
    }, [loadUnifiedData, appConfig, convertPhotosToEntities, setTrashPhotos]);

    // Filter options caching function  
    const loadFilterOptions = useCallback(async () => {
        if (filterOptions || isFilterOptionsLoading) return filterOptions;

        setIsFilterOptionsLoading(true);
        try {
            const [cameras, lenses, extensions] = await Promise.all([
                invoke('get_filter_options', { filterType: 'cameras' }),
                invoke('get_filter_options', { filterType: 'lenses' }),
                invoke('get_filter_options', { filterType: 'extensions' })
            ]);

            const options = {
                cameras: JSON.parse(cameras),
                lenses: JSON.parse(lenses),
                extensions: JSON.parse(extensions)
            };
            setFilterOptions(options);
            return options;
        } catch (error) {
            handleError(error, 'Load filter options');
            return null;
        } finally {
            setIsFilterOptionsLoading(false);
        }
    }, [filterOptions, isFilterOptionsLoading, setIsFilterOptionsLoading, setFilterOptions, handleError]);

    return {
        // Core loading function
        loadUnifiedData,
        
        // Album operations
        loadAlbums,
        loadAlbumPhotos,
        handleAlbumClick,
        
        // Tag operations  
        loadTags,
        loadTagPhotos,
        
        // Trash operations
        loadTrashPhotos,
        
        // Filter options
        loadFilterOptions,
        
        // Logging utilities
        logOperation
    };
}

export default usePhotoDataLoader;