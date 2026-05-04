import { useCallback, useRef } from "react";
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

    // Generation counter so that overlapping refresh calls (e.g. user
    // clicks date → trash while date is still loading) don't clobber each
    // other's photoLoading state. Only the latest call's finally block is
    // allowed to flip photoLoading=false. Previous behavior: an older
    // call's finally cleared photoLoading while the new call was still in
    // flight, briefly exposing the underlying grid (showing the old view's
    // photos) until the new call finished.
    const refreshGenRef = useRef(0);

    // Refresh photos helper with loading state
    const refreshPhotosOnly = useCallback(async () => {
        const myGen = ++refreshGenRef.current;
        logger.info('PhotosList', 'refresh_photos_only', 'Refreshing photos with loading indicator', { viewMode, gen: myGen });
        setPhotoLoading(true);
        try {
            await withMinLoadingTime(() => loadAllPhotosBasedOnViewMode(viewModeObj, appConfig, true));
        } finally {
            if (refreshGenRef.current === myGen) {
                setPhotoLoading(false);
            }
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
