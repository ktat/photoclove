/**
 * useViewModeSync Hook
 *
 * Manages photo loading synchronization based on view mode changes.
 *
 * Responsibilities:
 * - Monitors view mode changes and triggers photo loading
 * - Looks up the view cache before backend load; restores synchronously on hit
 * - Sets side menu visibility based on view mode
 */

import { useEffect, useLayoutEffect } from 'react';
import { ViewMode } from '../domain/ViewMode.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';

export function useViewModeSync({
    viewMode,
    viewModeObj,
    currentDate,
    currentAlbumId,
    currentTagId,
    currentBurstGroupId,
    searchQuery,
    currentSearchParams,
    photoLoading,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    setShowSideMenu,
    setPhotosList,
    setCurrentPhotoIndex,
    setPhotosListMiniCurrentIndex,
    setCurrentPhoto,
    setAllPhotosForCurrentFetch,
    setIsFetched,
    setPhotoLoading,
    refreshPhotosOnly,
    appConfig,
    sortOfPhotos,
    photosCache,
    currentViewKey,
    cancelInFlightLoad
}) {
    // Stringify searchParams to use in dependency array (avoid reference changes)
    const searchParamsStr = currentSearchParams ? JSON.stringify(currentSearchParams) : null;

    // useLayoutEffect: synchronous photo-state setup before the browser
    // paints. Doing this in useEffect (post-paint) leaves a one-frame
    // window where the previous view's photos are visible under the new
    // view's header. Doing it here keeps the underlying allPhotos /
    // isFetched / photoLoading aligned with the new viewKey before the
    // browser ever shows the new mode.
    //
    // Heavy / async work (refreshPhotosOnly) stays in the post-paint
    // useEffect below, otherwise the loading-overlay CSS animation
    // freezes during the synchronous render cascade.
    useLayoutEffect(() => {
        if (!viewMode || !viewModeObj) return;
        if (viewModeObj.isSearchMode?.()) return;

        // Non-loadable modes (HOME / list views) don't fetch photos.
        // Also drop any in-flight previous load — otherwise its eventual
        // response would silently overwrite allPhotosForCurrentFetch even
        // though the user has navigated away from any photo view.
        const isNonLoadableMode =
            viewMode === VIEW_MODES.HOME ||
            viewMode === VIEW_MODES.ALBUM_LIST ||
            viewMode === VIEW_MODES.TAG_LIST ||
            viewMode === VIEW_MODES.FACE_LIST;
        if (isNonLoadableMode) {
            if (cancelInFlightLoad) cancelInFlightLoad();
            if (setPhotoLoading) setPhotoLoading(false);
            return;
        }

        // Cache hit: restore the cached photos synchronously so the new
        // view's grid renders immediately with its own data — no flash
        // of the previous view's photos.
        if (photosCache && currentViewKey && setAllPhotosForCurrentFetch) {
            const cached = photosCache.get(currentViewKey);
            if (cached && cached.length > 0) {
                // Invalidate any in-flight backend load from a previous
                // view. Without this, picking view A (no cache, slow load)
                // then view B (cache hit) shows B immediately, but A's
                // load eventually resolves and overwrites B's photos with
                // A's. cancelInFlightLoad bumps the request-id counter so
                // A's response gets dropped on arrival.
                if (cancelInFlightLoad) cancelInFlightLoad();
                setAllPhotosForCurrentFetch(cached);
                if (setIsFetched) setIsFetched(true);
                if (setPhotoLoading) setPhotoLoading(false);
                return;
            }
        }

        // Cache miss: clear any stale photos and show the loading overlay
        // before paint. The actual fetch fires in the useEffect below.
        if (setAllPhotosForCurrentFetch) setAllPhotosForCurrentFetch([]);
        if (setIsFetched) setIsFetched(false);
        if (setPhotoLoading) setPhotoLoading(true);
    }, [currentViewKey, viewMode, viewModeObj, photosCache, setPhotoLoading, setAllPhotosForCurrentFetch, setIsFetched, cancelInFlightLoad]);

    // Main effect: side menu + actual fetch. Runs after paint so the
    // loading overlay is already on screen — the backend round-trip
    // doesn't freeze the overlay's CSS animation.
    //
    // Note: photo state (allPhotos, isFetched, photoLoading) is set up
    // synchronously in the useLayoutEffect above before paint. This
    // effect just kicks off the fetch (and handles search-mode-skip,
    // non-loadable-mode-skip, side-menu visibility).
    useEffect(() => {
        if (!viewMode || !viewModeObj) return;

        setShowSideMenu(viewModeObj.isSearchMode());

        // Search mode is driven by performSearch (user-triggered) + a
        // dedicated commit effect in PhotosList. ViewMode's searchParams
        // are set at factory-creation time and don't reflect the user's
        // live currentSearchParams, so running a load here would query
        // with stale/empty params.
        if (viewModeObj.isSearchMode()) return;

        // Non-loadable modes don't fetch but still need isFetched=true so
        // the empty-state / sidebar UI can render rather than waiting on
        // a load that won't happen.
        const isNonLoadableMode =
            viewMode === VIEW_MODES.HOME ||
            viewMode === VIEW_MODES.ALBUM_LIST ||
            viewMode === VIEW_MODES.TAG_LIST ||
            viewMode === VIEW_MODES.FACE_LIST;
        if (isNonLoadableMode) {
            if (setIsFetched) setIsFetched(true);
            return;
        }

        // Cache hit was already handled in useLayoutEffect (photos
        // restored, isFetched=true, photoLoading=false). Skip fetching.
        if (photosCache && currentViewKey) {
            const cached = photosCache.get(currentViewKey);
            if (cached && cached.length > 0) {
                logger.debug('useViewModeSync', 'cache_hit', 'Photos restored from view cache (in layout effect)', {
                    viewKey: currentViewKey,
                    count: cached.length,
                });
                return;
            }
        }

        // Cache miss: kick off the fetch. refreshPhotosOnly wraps the
        // load with MIN_LOADING_TIME=500ms so the overlay is visible
        // long enough to be perceptible.
        refreshPhotosOnly();
    }, [
        viewMode,
        viewModeObj,
        currentDate,
        currentAlbumId,
        currentTagId,
        currentBurstGroupId,
        searchQuery,
        searchParamsStr,
        appConfig,
        sortOfPhotos,
        currentViewKey
        // Note: Intentionally excluding setter functions and callbacks to prevent infinite loops
    ]);
}

/**
 * useImportStateSync Hook
 *
 * Handles photo loading when import state changes.
 * Separate from main view mode sync to avoid dependency complexity.
 */
export function useImportStateSync({
    viewMode,
    importState,
    loadPhotosWithCollection
}) {
    const isImportLike = viewMode === VIEW_MODES.IMPORT || viewMode === VIEW_MODES.QUICK_VIEW;

    useEffect(() => {
        if (isImportLike && importState) {
            logger.info('useImportStateSync', 'import_state_changed', 'Import state changed, reloading photos', {
                currentPath: importState.currentImportPath,
                filter: importState.importFilter,
                importStateId: importState._stateId
            });

            const viewModeObj = new ViewMode(viewMode, {
                currentImportPath: importState.currentImportPath,
                importFilter: importState.importFilter
            });

            loadPhotosWithCollection(viewModeObj);
        }
    }, [importState, viewMode, isImportLike]);
}

export default useViewModeSync;
