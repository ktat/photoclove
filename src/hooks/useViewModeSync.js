/**
 * useViewModeSync Hook
 *
 * Manages photo loading synchronization based on view mode changes.
 * Extracted from PhotosList.jsx to reduce component complexity.
 *
 * Responsibilities:
 * - Monitors view mode changes and triggers photo loading
 * - Handles side menu visibility based on view mode
 * - Cancels in-progress photo loading when view mode changes
 * - Resets photo state when switching between modes
 * - Skips unnecessary reloads for album and tag modes
 */

import { useEffect, useRef } from 'react';
import { ViewMode } from '../domain/ViewMode.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';

export function useViewModeSync({
    viewMode,
    currentDate,
    currentAlbumId,
    currentTagId,
    searchQuery,
    currentSearchParams,
    isSearchMode,
    photoLoading,
    currentPhotoLoadingController,
    setCurrentPhotoLoadingController,
    setShowSideMenu,
    setPhotosList,
    setCurrentPhotoIndex,
    setPhotosListMiniCurrentIndex,
    setCurrentPhotoPath,
    loadPhotosWithCollection,
    appConfig
}) {
    // Track if this is the initial mount
    const isInitialMount = useRef(true);

    useEffect(() => {
        // Skip on initial mount if no viewMode
        if (!viewMode) {
            logger.debug('useViewModeSync', 'skip_no_viewmode', 'Skipping photo reload - no viewMode');
            return;
        }

        // Set side menu visibility based on search mode
        setShowSideMenu(isSearchMode);

        // Create ViewMode object from current state
        const viewModeObj = new ViewMode(viewMode, {
            date: currentDate,
            albumId: currentAlbumId,
            tagId: currentTagId,
            searchQuery: searchQuery,
            searchParams: currentSearchParams
        });

        // Skip photo loading if in album or tag mode - these photos are managed separately
        if (viewModeObj.isAlbumMode()) {
            logger.debug('useViewModeSync', 'skip_album', 'Skipping photo reload - in album mode');
            return;
        }
        if (viewModeObj.isTagMode()) {
            logger.debug('useViewModeSync', 'skip_tag', 'Skipping photo reload - in tag mode');
            return;
        }

        // Load all photos based on ViewMode
        logger.info('useViewModeSync', 'load_photos', 'Loading photos for view mode', {
            viewMode,
            date: currentDate,
            albumId: currentAlbumId,
            tagId: currentTagId,
            hasSearchQuery: !!searchQuery
        });

        loadPhotosWithCollection(viewModeObj);

        // Mark that initial mount has completed
        if (isInitialMount.current) {
            isInitialMount.current = false;
        }

    }, [
        viewMode,
        currentDate,
        currentAlbumId,
        currentTagId,
        searchQuery,
        currentSearchParams,
        appConfig
        // Note: Intentionally excluding setter functions and callbacks to prevent infinite loops
        // These functions are stable and don't need to trigger re-runs
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
    useEffect(() => {
        if (viewMode === VIEW_MODES.IMPORT && importState) {
            logger.info('useImportStateSync', 'import_state_changed', 'Import state changed, reloading photos', {
                currentPath: importState.currentImportPath,
                filter: importState.importFilter,
                importStateId: importState._stateId
            });

            const viewModeObj = new ViewMode(VIEW_MODES.IMPORT, {
                currentImportPath: importState.currentImportPath,
                importFilter: importState.importFilter
            });

            loadPhotosWithCollection(viewModeObj);
        }
    }, [importState, viewMode]);
}

export default useViewModeSync;
