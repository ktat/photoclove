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
    loadPhotosWithCollection,
    appConfig,
    sortOfPhotos,
    photosCache,
    currentViewKey
}) {
    // Stringify searchParams to use in dependency array (avoid reference changes)
    const searchParamsStr = currentSearchParams ? JSON.stringify(currentSearchParams) : null;

    useEffect(() => {
        if (!viewMode || !viewModeObj) {
            return;
        }

        // Set side menu visibility based on search mode
        setShowSideMenu(viewModeObj.isSearchMode());

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
                return;
            }
        }

        // Load all photos based on ViewMode (Phase 1: unified for all view modes)
        loadPhotosWithCollection(viewModeObj);
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
