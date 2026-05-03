/**
 * usePhotosListEffects - Hook for PhotosList side effects
 */
import { useEffect, useRef, useCallback } from 'react';
import { VIEW_MODES, supportsBurstGrouping } from '../constants/viewModes.js';
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
 * Hook for auto-opening selection tab when items are selected
 */
export function useSelectionTabEffect({
    photoSelection,
    selectedAlbums,
    selectedTags,
    selectedPersons,
    selectedUnknownFaces,
    faceViewType,
    changeTab,
    setShowSideMenu,
    viewModeObj,
    tabClass,
    currentPhoto
}) {
    const prevSelectionCount = useRef(0);

    useEffect(() => {
        // Skip if PhotoViewer is open - PhotoOption handles tab switching there
        if (currentPhoto) {
            return;
        }

        // Calculate relevant selection count based on current ViewMode
        let relevantSelectionCount = 0;
        if (viewModeObj?.isAlbumListMode()) {
            relevantSelectionCount = selectedAlbums.length;
        } else if (viewModeObj?.isTagListMode()) {
            relevantSelectionCount = selectedTags.length;
        } else if (viewModeObj?.isFaceListMode()) {
            // In face list mode, check which tab is active
            if (faceViewType === 'unknown') {
                relevantSelectionCount = selectedUnknownFaces.length;
            } else {
                relevantSelectionCount = selectedPersons.length;
            }
        } else {
            // All other modes - only photo selections
            relevantSelectionCount = photoSelection.length;
        }

        // Auto-open Selection tab when selection goes from 0 to 1+
        // But don't switch if Share tab is active (user is working on sharing)
        const isShareTabActive = tabClass?.share === true;
        if (prevSelectionCount.current === 0 && relevantSelectionCount > 0 && !isShareTabActive) {
            changeTab(undefined, "#tab-selection");
            setShowSideMenu(true);
            logger.info('usePhotosListEffects', 'auto_open_selection', 'Auto-opening Selection tab', {
                viewMode: viewModeObj?.mode,
                faceViewType,
                photoCount: photoSelection.length,
                albumCount: selectedAlbums.length,
                tagCount: selectedTags.length,
                personCount: selectedPersons.length,
                unknownFaceCount: selectedUnknownFaces.length,
                relevantCount: relevantSelectionCount
            });
        }
        prevSelectionCount.current = relevantSelectionCount;
    }, [photoSelection.length, selectedAlbums.length, selectedTags.length, selectedPersons.length, selectedUnknownFaces.length, faceViewType, viewModeObj, changeTab, setShowSideMenu, tabClass, currentPhoto]);
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
 * Hook for burst mode change effects
 * Reloads photos when burst grouping is toggled
 */
export function useBurstModeChangeEffect({
    burstModeEnabled,
    viewModeObj,
    appConfig,
    loadAllPhotosBasedOnViewMode,
    handleError
}) {
    const prevBurstModeEnabled = useRef(burstModeEnabled);

    useEffect(() => {
        // Skip if no change (initial render)
        if (prevBurstModeEnabled.current === burstModeEnabled) return;
        prevBurstModeEnabled.current = burstModeEnabled;

        if (!viewModeObj || !appConfig) return;

        // Only reload for modes that support burst grouping
        if (!supportsBurstGrouping(viewModeObj.mode)) {
            logger.debug('usePhotosListEffects', 'burst_mode_skip', 'Mode does not support burst grouping', {
                viewMode: viewModeObj.mode
            });
            return;
        }

        logger.info('usePhotosListEffects', 'burst_mode_reload', 'Burst mode changed, reloading', {
            viewMode: viewModeObj.mode,
            burstModeEnabled
        });

        loadAllPhotosBasedOnViewMode(viewModeObj, appConfig).catch(error => {
            handleError(error, 'Reload photos after burst mode change');
        });
    }, [burstModeEnabled, viewModeObj, appConfig, loadAllPhotosBasedOnViewMode, handleError]);
}

/**
 * Hook for auto-closing photo display when the underlying list changes.
 *
 * Closes the PhotoDisplay any time the user switches view mode while a
 * photo is open. The previous behaviour only triggered on list-style modes
 * (ALBUM_LIST/TAG_LIST/FACE_LIST/HOME), but switching to a *different*
 * album/tag/search/trash should also close the display — otherwise the
 * user is left looking at a photo from the new list with the prior view's
 * navigation context.
 */
export function useAutoClosePhotoDisplayEffect({
    viewMode,
    currentPhoto,
    closePhotoDisplay
}) {
    const prevViewModeRef = useRef(viewMode);
    useEffect(() => {
        const prev = prevViewModeRef.current;
        prevViewModeRef.current = viewMode;
        if (prev !== viewMode && currentPhoto) {
            logger.info('usePhotosListEffects', 'auto_close', 'Auto-closing photo display on view-mode change', {
                from: prev,
                to: viewMode,
            });
            closePhotoDisplay();
        }
    }, [viewMode, currentPhoto, closePhotoDisplay]);
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
    useSelectionTabEffect,
    useSortChangeEffect,
    useBurstModeChangeEffect,
    useAutoClosePhotoDisplayEffect,
    useConfigAndCleanupEffect,
    useSideMenuToggleEffect,
    useViewModeSideMenuEffect
};
