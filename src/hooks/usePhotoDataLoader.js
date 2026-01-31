import { useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';
import { useAsyncCancellation } from './useAsyncCancellation.js';

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
    setAllPhotosForCurrentFetch,
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
    appConfig,
    burstModeEnabled = false
}) {
    // Async cancellation for stale request handling
    const { startNewRequest, isRequestValid } = useAsyncCancellation();

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
        // Start new request, invalidating any previous pending requests
        const requestId = startNewRequest();

        // Use burst_album search type when burst mode is enabled
        const searchType = burstModeEnabled ? 'burst_album' : 'album_photos';

        try {
            const data = await loadUnifiedData(searchType,
                { params: { album_id: albumId } },
                { operation: 'album photos', albumId, requestId, burstModeEnabled });

            // Check if this request was cancelled while waiting
            if (!isRequestValid(requestId)) {
                logger.debug('PhotosList', 'album_request_cancelled', 'Ignoring stale album photos response', {
                    requestId,
                    albumId
                });
                return;
            }

            // Handle both array and object formats
            const albumPhotosData = data.photos || data;

            // Wrapper signature: (photosData, isFromTrash, toJSON) - appConfig via closure
            const photosAsJSON = convertPhotosToEntities(albumPhotosData, false, true);
            updateAlbumPhotos(photosAsJSON);
            setPhotosList({ photos: photosAsJSON });
        } catch (error) {
            // Ignore errors from cancelled requests
            if (!isRequestValid(requestId)) {
                return;
            }
            // Error already handled by loadUnifiedData
        }
    }, [updateAlbumPhotos, loadUnifiedData, setPhotosList, convertPhotosToEntities, startNewRequest, isRequestValid, burstModeEnabled]);

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
        // Start new request, invalidating any previous pending requests
        const requestId = startNewRequest();

        // Use burst_tag search type when burst mode is enabled
        const searchType = burstModeEnabled ? 'burst_tag' : 'tag';

        try {
            const data = await loadUnifiedData(searchType,
                { query: tagId.toString() },
                { operation: 'tag photos', tagId, requestId, burstModeEnabled });

            // Check if this request was cancelled while waiting
            if (!isRequestValid(requestId)) {
                logger.debug('PhotosList', 'tag_request_cancelled', 'Ignoring stale tag photos response', {
                    requestId,
                    tagId
                });
                return;
            }

            // Handle both array and object formats
            const tagPhotosData = data.photos || data;

            // Wrapper signature: (photosData, isFromTrash, toJSON) - appConfig via closure
            const photosAsJSON = convertPhotosToEntities(tagPhotosData, false, true);

            // Set tagPhotos with JSON for React state
            setTagPhotos(photosAsJSON);
            setPhotosList({ photos: photosAsJSON });
        } catch (error) {
            // Ignore errors from cancelled requests
            if (!isRequestValid(requestId)) {
                return;
            }
            // Error already handled by loadUnifiedData
        }
    }, [loadUnifiedData, setTagPhotos, setPhotosList, convertPhotosToEntities, startNewRequest, isRequestValid, burstModeEnabled]);

    const loadPersonPhotos = useCallback(async (personId) => {
        // Start new request, invalidating any previous pending requests
        const requestId = startNewRequest();

        try {
            const data = await loadUnifiedData('person',
                { query: personId.toString() },
                { operation: 'person photos', personId, requestId });

            // Check if this request was cancelled while waiting
            if (!isRequestValid(requestId)) {
                logger.debug('PhotosList', 'person_request_cancelled', 'Ignoring stale person photos response', {
                    requestId,
                    personId
                });
                return;
            }

            // Handle both array and object formats
            const personPhotosData = data.photos || data;

            // Wrapper signature: (photosData, isFromTrash, toJSON) - appConfig via closure
            const photosAsJSON = convertPhotosToEntities(personPhotosData, false, true);

            // Set photos for display (both photosList and allPhotosForCurrentFetch for filtering)
            setPhotosList({ photos: photosAsJSON });
            setAllPhotosForCurrentFetch(photosAsJSON);
        } catch (error) {
            // Ignore errors from cancelled requests
            if (!isRequestValid(requestId)) {
                return;
            }
            // Error already handled by loadUnifiedData
        }
    }, [loadUnifiedData, setPhotosList, setAllPhotosForCurrentFetch, convertPhotosToEntities, startNewRequest, isRequestValid]);

    const loadUnknownFacesPhotos = useCallback(async () => {
        // Start new request, invalidating any previous pending requests
        const requestId = startNewRequest();

        try {
            const data = await loadUnifiedData('unknown_faces',
                {},
                { operation: 'unknown faces photos', requestId });

            // Check if this request was cancelled while waiting
            if (!isRequestValid(requestId)) {
                logger.debug('PhotosList', 'unknown_faces_request_cancelled', 'Ignoring stale unknown faces photos response', {
                    requestId
                });
                return;
            }

            // Handle both array and object formats
            const unknownFacesPhotosData = data.photos || data;

            // Wrapper signature: (photosData, isFromTrash, toJSON) - appConfig via closure
            const photosAsJSON = convertPhotosToEntities(unknownFacesPhotosData, false, true);

            // Set photos for display (both photosList and allPhotosForCurrentFetch for filtering)
            setPhotosList({ photos: photosAsJSON });
            setAllPhotosForCurrentFetch(photosAsJSON);
        } catch (error) {
            // Ignore errors from cancelled requests
            if (!isRequestValid(requestId)) {
                return;
            }
            // Error already handled by loadUnifiedData
        }
    }, [loadUnifiedData, setPhotosList, setAllPhotosForCurrentFetch, convertPhotosToEntities, startNewRequest, isRequestValid]);

    // Load trash photos
    const loadTrashPhotos = useCallback(async () => {
        // Start new request, invalidating any previous pending requests
        const requestId = startNewRequest();

        try {
            const photosData = await loadUnifiedData('trash', {}, {
                operation: 'trash photos',
                hasConfig: !!appConfig,
                configTrashPath: appConfig?.trash_path,
                configThumbnailStore: appConfig?.thumbnail_store,
                requestId
            });

            // Check if this request was cancelled while waiting
            if (!isRequestValid(requestId)) {
                logger.debug('PhotosList', 'trash_request_cancelled', 'Ignoring stale trash photos response', {
                    requestId
                });
                return;
            }

            // Handle both array and object formats
            let photos = [];
            if (Array.isArray(photosData)) {
                photos = photosData;
            } else if (photosData && photosData.photos) {
                photos = photosData.photos;
            }

            // Wrapper signature: (photosData, isFromTrash, toJSON) - appConfig via closure
            const photosAsJSON = convertPhotosToEntities(photos, true, true);
            setTrashPhotos(photosAsJSON);
        } catch (error) {
            // Ignore errors from cancelled requests
            if (!isRequestValid(requestId)) {
                return;
            }
            // Error already handled by loadUnifiedData
        }
    }, [loadUnifiedData, appConfig, convertPhotosToEntities, setTrashPhotos, startNewRequest, isRequestValid]);

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

        // Person operations
        loadPersonPhotos,

        // Unknown faces operations
        loadUnknownFacesPhotos,

        // Trash operations
        loadTrashPhotos,
        
        // Filter options
        loadFilterOptions,
        
        // Logging utilities
        logOperation
    };
}

export default usePhotoDataLoader;