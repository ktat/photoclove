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

import { useEffect } from 'react';
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
    refreshPhotosOnly,
    appConfig,
    sortOfPhotos,
    photosCache,
    currentViewKey
}) {
    // Stringify searchParams to use in dependency array (avoid reference changes)
    const searchParamsStr = currentSearchParams ? JSON.stringify(currentSearchParams) : null;

    // The empty-state UI is gated by displayState.isFetched (set true only
    // after a successful load completes). That eliminates the
    // viewMode-changed-but-fetch-not-started flash, so a regular useEffect
    // is sufficient here.
    useEffect(() => {
        if (!viewMode || !viewModeObj) {
            return;
        }

        // Set side menu visibility based on search mode
        setShowSideMenu(viewModeObj.isSearchMode());

        // Search mode is driven by performSearch (user-triggered) + a dedicated
        // commit effect in PhotosList. We must NOT auto-load here, because
        // ViewMode's searchParams come from the factory's initial value and
        // don't reflect the user's live `currentSearchParams` — running a load
        // would either query with stale/empty params (returning "everything")
        // or never react to search-condition changes.
        if (viewModeObj.isSearchMode()) {
            return;
        }

        // View cache lookup: if we have a snapshot for this view, restore
        // it synchronously and skip the backend round-trip.
        if (photosCache && currentViewKey && setAllPhotosForCurrentFetch) {
            const cached = photosCache.get(currentViewKey);
            if (cached && cached.length > 0) {
                logger.debug('useViewModeSync', 'cache_hit', 'Restoring photos from view cache', {
                    viewKey: currentViewKey,
                    count: cached.length,
                });
                setAllPhotosForCurrentFetch(cached);
                if (setIsFetched) setIsFetched(true);
                return;
            }
        }

        // Cache miss. Clear the previous view's photos right away so the grid
        // doesn't flash old data while the backend load is in flight.
        if (setAllPhotosForCurrentFetch) {
            setAllPhotosForCurrentFetch([]);
        }
        // Reset isFetched: until the fetch completes, the empty-state UI
        // ("No Photos", "Trash is Empty") must not render — there is no
        // confirmed "empty" answer yet, just a pending load.
        if (setIsFetched) setIsFetched(false);

        // Use refreshPhotosOnly which wraps loadAllPhotosBasedOnViewMode with
        // a MIN_LOADING_TIME (~500ms) guard. Without this the loading screen
        // can be invisibly brief when the backend responds quickly, leading
        // to confusing instant view-mode swaps with no visual feedback.
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
