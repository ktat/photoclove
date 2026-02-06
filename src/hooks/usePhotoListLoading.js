import { useCallback } from "react";
import { logger } from "../services/LoggerService.js";
import { unifiedCollectionService } from "../services/UnifiedCollectionService.js";

/**
 * Hook for managing photo list loading operations
 * Extracts loading wrappers and refresh/reload functions from PhotosList
 */
export function usePhotoListLoading({
    setPhotoLoading,
    loadAlbumPhotosOriginal,
    loadTagPhotosOriginal,
    loadPersonPhotosOriginal,
    loadUnknownFacesPhotosOriginal,
    loadAlbums,
    loadTags,
    loadAllPhotosBasedOnViewMode,
    viewModeObj,
    appConfig,
    viewMode
}) {
    // Minimum loading display time (ms) for better UX
    const MIN_LOADING_TIME = 500;

    // Helper to ensure minimum loading time
    const withMinLoadingTime = useCallback(async (asyncFn) => {
        const startTime = Date.now();
        try {
            await asyncFn();
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < MIN_LOADING_TIME) {
                await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
            }
        }
    }, []);

    // Album photo loading wrapper
    const loadAlbumPhotos = useCallback(async (albumId) => {
        setPhotoLoading(true);
        try { await loadAlbumPhotosOriginal(albumId); }
        finally { setPhotoLoading(false); }
    }, [loadAlbumPhotosOriginal, setPhotoLoading]);

    // Tag photo loading wrapper
    const loadTagPhotos = useCallback(async (tagId) => {
        setPhotoLoading(true);
        try { await loadTagPhotosOriginal(tagId); }
        finally { setPhotoLoading(false); }
    }, [loadTagPhotosOriginal, setPhotoLoading]);

    // Person photo loading wrapper
    const loadPersonPhotos = useCallback(async (personId) => {
        setPhotoLoading(true);
        try { await loadPersonPhotosOriginal(personId); }
        finally { setPhotoLoading(false); }
    }, [loadPersonPhotosOriginal, setPhotoLoading]);

    // Unknown faces photo loading wrapper
    const loadUnknownFacesPhotos = useCallback(async () => {
        setPhotoLoading(true);
        try { await loadUnknownFacesPhotosOriginal(); }
        finally { setPhotoLoading(false); }
    }, [loadUnknownFacesPhotosOriginal, setPhotoLoading]);

    // Refresh photos helper with loading state
    const refreshPhotosOnly = useCallback(async () => {
        logger.info('PhotosList', 'refresh_photos_only', 'Refreshing photos with loading indicator', { viewMode });
        setPhotoLoading(true);
        try {
            await withMinLoadingTime(() => loadAllPhotosBasedOnViewMode(viewModeObj, appConfig, true));
        } finally {
            setPhotoLoading(false);
        }
    }, [loadAllPhotosBasedOnViewMode, viewModeObj, appConfig, viewMode, setPhotoLoading, withMinLoadingTime]);

    // Reload albums list with loading state (clears cache first)
    const reloadAlbums = useCallback(async () => {
        logger.info('PhotosList', 'reload_albums', 'Reloading albums list with loading indicator');
        setPhotoLoading(true);
        try {
            unifiedCollectionService.clearCache();
            await withMinLoadingTime(loadAlbums);
        } finally {
            setPhotoLoading(false);
        }
    }, [loadAlbums, setPhotoLoading, withMinLoadingTime]);

    // Reload tags list with loading state (clears cache first)
    const reloadTags = useCallback(async () => {
        logger.info('PhotosList', 'reload_tags', 'Reloading tags list with loading indicator');
        setPhotoLoading(true);
        try {
            unifiedCollectionService.clearCache();
            await withMinLoadingTime(loadTags);
        } finally {
            setPhotoLoading(false);
        }
    }, [loadTags, setPhotoLoading, withMinLoadingTime]);

    return {
        loadAlbumPhotos,
        loadTagPhotos,
        loadPersonPhotos,
        loadUnknownFacesPhotos,
        refreshPhotosOnly,
        reloadAlbums,
        reloadTags,
        withMinLoadingTime
    };
}
