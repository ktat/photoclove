/**
 * usePhotosListEffects - Hook for PhotosList side effects
 */
import { useEffect, useRef, useCallback } from 'react';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';

/**
 * Hook for managing view mode change effects
 */
export function useViewModeChangeEffect({
    viewMode,
    setShowFilterPopover
}) {
    useEffect(() => {
        logger.info('usePhotosListEffects', 'mode_change', 'View mode changed', { viewMode });
        setShowFilterPopover(false);
    }, [viewMode, setShowFilterPopover]);
}

/**
 * Hook for syncing photos to album/tag mode state
 */
export function usePhotoSyncEffect({
    viewModeObj,
    allPhotosForCurrentFetch,
    updateAlbumPhotos,
    setTagPhotos
}) {
    useEffect(() => {
        if (viewModeObj.isAlbumMode() && allPhotosForCurrentFetch.length > 0) {
            updateAlbumPhotos(allPhotosForCurrentFetch);
            logger.debug('usePhotosListEffects', 'sync_album', 'Synced to albumPhotos', {
                photoCount: allPhotosForCurrentFetch.length
            });
        } else if (viewModeObj.isTagMode() && allPhotosForCurrentFetch.length > 0) {
            setTagPhotos(allPhotosForCurrentFetch);
            logger.debug('usePhotosListEffects', 'sync_tag', 'Synced to tagPhotos', {
                photoCount: allPhotosForCurrentFetch.length
            });
        }
    }, [allPhotosForCurrentFetch, viewModeObj, updateAlbumPhotos, setTagPhotos]);
}

/**
 * Hook for auto-opening selection tab when items are selected
 */
export function useSelectionTabEffect({
    photoSelection,
    selectedAlbums,
    selectedTags,
    changeTab,
    setShowSideMenu
}) {
    const prevSelectionCount = useRef(0);

    useEffect(() => {
        const totalSelectionCount = photoSelection.length + selectedAlbums.length + selectedTags.length;

        // Auto-open Selection tab when selection goes from 0 to 1+
        if (prevSelectionCount.current === 0 && totalSelectionCount > 0) {
            changeTab(undefined, "#tab-selection");
            setShowSideMenu(true);
            logger.info('usePhotosListEffects', 'auto_open_selection', 'Auto-opening Selection tab', {
                photoCount: photoSelection.length,
                albumCount: selectedAlbums.length,
                tagCount: selectedTags.length
            });
        }
        prevSelectionCount.current = totalSelectionCount;
    }, [photoSelection.length, selectedAlbums.length, selectedTags.length, changeTab, setShowSideMenu]);
}

/**
 * Hook for sort change effects
 */
export function useSortChangeEffect({
    sortOfPhotos,
    importSortOfPhotos,
    viewModeObj,
    appConfig,
    sortInitialized,
    loadAllPhotosBasedOnViewMode,
    handleError
}) {
    useEffect(() => {
        if (!viewModeObj || !appConfig || !sortInitialized.current) return;

        // For import mode, sorting is done in frontend via filteredPhotos useMemo
        if (viewModeObj.isImportMode()) {
            logger.debug('usePhotosListEffects', 'sort_import', 'Import mode: frontend sorting', {
                importSortOfPhotos
            });
            return;
        }

        // For other modes, need to re-fetch from backend with new sort value
        logger.info('usePhotosListEffects', 'sort_reload', 'Sort changed, reloading', {
            viewMode: viewModeObj.mode,
            sortOfPhotos
        });

        loadAllPhotosBasedOnViewMode(viewModeObj, appConfig).catch(error => {
            handleError(error, 'Reload photos after sort change');
        });
    }, [sortOfPhotos, viewModeObj, appConfig, importSortOfPhotos, loadAllPhotosBasedOnViewMode, handleError, sortInitialized]);
}

/**
 * Hook for auto-closing photo display in list modes
 */
export function useAutoClosePhotoDisplayEffect({
    viewMode,
    currentPhotoPath,
    closePhotoDisplay
}) {
    useEffect(() => {
        // Close photo display when switching to modes that show lists instead of photos
        if (viewMode === VIEW_MODES.ALBUM_LIST || viewMode === VIEW_MODES.TAG_LIST || viewMode === VIEW_MODES.HOME) {
            if (currentPhotoPath) {
                logger.info('usePhotosListEffects', 'auto_close', 'Auto-closing photo display for list mode', { viewMode });
                closePhotoDisplay();
            }
        }
    }, [viewMode, currentPhotoPath, closePhotoDisplay]);
}

/**
 * Hook for config and cleanup effects
 */
export function useConfigAndCleanupEffect({
    appConfig,
    iconSize,
    currentPhotoLoadingController,
    setThumbnailStore
}) {
    useEffect(() => {
        if (appConfig) {
            setThumbnailStore(appConfig.thumbnail_store);
        }

        const gridSize = Math.max(120, parseInt(iconSize) + 41);
        document.documentElement.style.setProperty('--photo-grid-size', `${gridSize}px`);

        return () => {
            if (currentPhotoLoadingController) {
                currentPhotoLoadingController.abort();
            }
        };
    }, [appConfig, iconSize, currentPhotoLoadingController, setThumbnailStore]);
}

/**
 * Hook for side menu toggle notification
 */
export function useSideMenuToggleEffect({
    showSideMenu,
    onRightMenuToggle
}) {
    useEffect(() => {
        if (onRightMenuToggle) {
            onRightMenuToggle(showSideMenu);
        }
    }, [showSideMenu, onRightMenuToggle]);
}

/**
 * Hook for side menu visibility based on view mode
 */
export function useViewModeSideMenuEffect({
    viewModeObj,
    setShowSideMenu
}) {
    useEffect(() => {
        if (viewModeObj) {
            setShowSideMenu(viewModeObj.shouldShowSideMenuByDefault());
        }
    }, [viewModeObj, setShowSideMenu]);
}

export default {
    useViewModeChangeEffect,
    usePhotoSyncEffect,
    useSelectionTabEffect,
    useSortChangeEffect,
    useAutoClosePhotoDisplayEffect,
    useConfigAndCleanupEffect,
    useSideMenuToggleEffect,
    useViewModeSideMenuEffect
};
