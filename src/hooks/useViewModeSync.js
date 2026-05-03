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
    currentViewKey
}) {
    // Stringify searchParams to use in dependency array (avoid reference changes)
    const searchParamsStr = currentSearchParams ? JSON.stringify(currentSearchParams) : null;

    // useLayoutEffect: minimal synchronous prep — flip photoLoading=true
    // before the browser paints so the user sees the loading overlay
    // immediately (not stale photos / black grid / "Trash is Empty"). This
    // effect must do as little work as possible, otherwise it blocks paint
    // and the loading-overlay CSS animation freezes for a noticeable beat.
    useLayoutEffect(() => {
        if (!viewMode || !viewModeObj) return;
        if (viewModeObj.isSearchMode?.()) return;
        // Cache hit can be checked here too — restoring cached photos is
        // also fast and synchronous.
        if (photosCache && currentViewKey) {
            const cached = photosCache.get(currentViewKey);
            if (cached && cached.length > 0) {
                // Cache hit: don't show loading overlay; restore in main effect.
                return;
            }
        }
        if (setPhotoLoading) setPhotoLoading(true);
    }, [currentViewKey, viewMode, viewModeObj, photosCache, setPhotoLoading]);

    // Main effect: side menu, photo state setup, and the actual fetch.
    // Runs after paint so the loading overlay is already on screen — the
    // backend round-trip and any heavy state updates here don't freeze the
    // overlay's CSS animation.
    useEffect(() => {
        if (!viewMode || !viewModeObj) return;

        setShowSideMenu(viewModeObj.isSearchMode());

        // Search mode is driven by performSearch (user-triggered) + a
        // dedicated commit effect in PhotosList. ViewMode's searchParams
        // are set at factory-creation time and don't reflect the user's
        // live currentSearchParams, so running a load here would query
        // with stale/empty params.
        if (viewModeObj.isSearchMode()) return;

        // Non-loadable modes (HOME, list views) don't fetch photos —
        // mark them as "fetched" up front so the empty-state UI / sidebar
        // can render normally instead of staying blank waiting for a
        // load that will never come.
        const isNonLoadableMode =
            viewMode === VIEW_MODES.HOME ||
            viewMode === VIEW_MODES.ALBUM_LIST ||
            viewMode === VIEW_MODES.TAG_LIST ||
            viewMode === VIEW_MODES.FACE_LIST;
        if (isNonLoadableMode) {
            if (setIsFetched) setIsFetched(true);
            return;
        }

        // View cache lookup: synchronous restore on hit.
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

        // Cache miss. Clear the previous view's photos so the grid behind
        // the loading overlay doesn't briefly show stale data.
        if (setAllPhotosForCurrentFetch) setAllPhotosForCurrentFetch([]);
        // isFetched=false suppresses the empty-state UI until the fetch
        // confirms there really is nothing to show.
        if (setIsFetched) setIsFetched(false);

        // refreshPhotosOnly wraps the load with MIN_LOADING_TIME=500ms so
        // the loading overlay is visible long enough to be perceptible.
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
