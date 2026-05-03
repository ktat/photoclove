/**
 * usePhotoLoader Hook
 *
 * Handles photo loading operations for PhotosList component.
 * Extracted from PhotosList.jsx (Phase 1 of refactoring #129)
 *
 * Responsibilities:
 * - Load photos based on view mode
 * - Handle pagination
 * - Manage loading state
 * - Convert backend data to Photo entities
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import { PhotoCollection } from '../domain/PhotoCollection.js';
import { useAsyncCancellation } from './useAsyncCancellation.js';

/**
 * Photo loading hook
 * @param {Object} params
 * @param {Object} params.viewModeObj - ViewMode object
 * @param {Object} params.appConfig - Application configuration
 * @param {number} params.sortOfPhotos - Current sort value
 * @param {number} params.starFilter - Star filter value
 * @param {boolean} params.hasCommentFilter - Comment filter flag
 * @param {string} params.extensionFilter - Extension filter value
 * @param {Array} params.filteredPhotos - Filtered photos array
 * @param {number} params.numOfPhoto - Number of photos per page
 * @param {Object} params.importState - Import state object
 * @param {Function} params.setPhotosList - Set photos list function
 * @param {Function} params.setAllPhotosForCurrentFetch - Set all photos function
 * @param {Function} params.setIsLimitedByConfig - Set limited flag function
 * @param {Function} params.setConfigLimit - Set config limit function
 * @param {Function} params.setPhotosListMiniAllPhotos - Set mini photos function
 * @param {Function} params.setPhotoCollection - Set photo collection function
 * @param {Function} params.setPhotosListImgSrc - Set image source function
 * @param {Function} params.setCurrentPhoto - Set current photo entity function
 * @param {Function} params.setCurrentPhotoIndex - Set current photo index function
 * @param {Function} params.convertPhotosToEntities - Convert photos function
 * @param {Function} params.handleError - Error handler function
 * @param {Object} params.datePage - Page number mapping by mode
 * @param {Function} params.updateDatePage - Update datePage function
 * @param {Function} params.addFooterMessage - Footer message function
 * @param {boolean} params.burstModeEnabled - Burst grouping mode flag
 * @param {Object} params.currentSearchParams - Current search parameters from useSearchAndFilters
 * @returns {Object} Photo loader functions and state
 */
export function usePhotoLoader({
    viewModeObj,
    appConfig,
    sortOfPhotos,
    starFilter,
    hasCommentFilter,
    extensionFilter,
    filteredPhotos,
    numOfPhoto,
    importState,
    setPhotosList,
    setAllPhotosForCurrentFetch,
    setIsLimitedByConfig,
    setConfigLimit,
    setPhotosListMiniAllPhotos,
    setPhotoCollection,
    setPhotosListImgSrc,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    convertPhotosToEntities,
    handleError,
    datePage,
    updateDatePage,
    addFooterMessage,
    burstModeEnabled = false,
    currentSearchParams = null,
    onLoadSuccess = null
}) {
    // Loading state
    const [photoLoading, setPhotoLoading] = useState(false);
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);

    // Async cancellation for stale request handling
    const { startNewRequest, isRequestValid } = useAsyncCancellation();

    /**
     * Internal: Load photos via unified API with filters
     * @param {Object} viewMode - ViewMode object
     * @param {Object} config - App configuration
     * @param {number} requestId - Request ID for cancellation tracking
     * @param {boolean} silent - If true, don't show loading indicator
     */
    const loadViaUnifiedAPI = useCallback(async (viewMode, config, requestId, silent = false) => {
        try {
            // Generate parameters using ViewMode with current filters
            const photoParams = viewMode.getUnifiedPhotoParams(config, {
                sort_value: parseInt(sortOfPhotos),
                star: starFilter || -1,
                has_comment: hasCommentFilter || false,
                extension: extensionFilter || "all",
                burstModeEnabled: burstModeEnabled
            });

            const result = await invoke("get_photos_unified", { request: photoParams });

            if (!isRequestValid(requestId)) {
                return null;
            }

            const data = JSON.parse(result);

            if (!data || !data.photos || !Array.isArray(data.photos)) {
                logger.error('PhotosList', 'invalid_data_structure', 'Invalid data structure from backend');
                return null;
            }

            // Check if we hit the configuration limit
            const effectiveLimit = config?.max_photos_per_fetch || 1000;
            const isLimited = data.photos.length >= effectiveLimit && (data.has_next || data.photos.length === effectiveLimit);
            setIsLimitedByConfig(isLimited);
            setConfigLimit(effectiveLimit);

            // Convert to Photo entities and store. Trash photos need
            // isFromTrash=true so displayPath() resolves to the trash path
            // (otherwise PhotoDisplay shows "No Photo").
            const isFromTrash = viewMode.isTrashMode?.() ?? false;
            const photoEntities = convertPhotosToEntities(data.photos, isFromTrash, false);
            setAllPhotosForCurrentFetch(photoEntities);

            // Save to view cache atomically with the state update.
            // Doing this here (rather than via a generic effect on
            // allPhotosForCurrentFetch) avoids a race where two loads
            // complete in succession and a viewKey-changed render lands
            // before the cache-save effect could distinguish "fresh from
            // load X" vs "stale residual after switching to view Y".
            if (onLoadSuccess) onLoadSuccess(viewMode, photoEntities);

            return photoEntities;
        } catch (error) {
            if (!isRequestValid(requestId)) {
                return null;
            }
            handleError(error, `Load photos mode ${viewMode.mode}`, { mode: viewMode.mode });
            return null;
        }
    }, [
        sortOfPhotos,
        starFilter,
        hasCommentFilter,
        extensionFilter,
        burstModeEnabled,
        setIsLimitedByConfig,
        setConfigLimit,
        setAllPhotosForCurrentFetch,
        convertPhotosToEntities,
        handleError,
        isRequestValid,
        onLoadSuccess
    ]);

    /**
     * Unified photo loading function
     * @param {Object} viewMode - ViewMode object (optional, uses viewModeObj if not provided)
     * @param {Object} options - Loading options
     * @param {boolean} options.silent - If true, don't show loading indicator (for metadata-only updates)
     * @param {boolean} options.applyFilters - If true, apply current star/comment/extension filters
     */
    const loadPhotos = useCallback(async (viewMode, options = {}) => {
        const { silent = false, applyFilters = false } = options;
        const config = appConfig;
        const requestId = startNewRequest();

        if (!viewMode || !config) {
            return;
        }

        // IMPORT mode uses separate loading mechanism
        if (viewMode.isImportMode() && !importState) {
            return;
        }

        // Some view modes require specific data
        if (!viewMode.isSearchMode() && !viewMode.isRecentMode() && !viewMode.isTrashMode() &&
            !viewMode.isInBurstGroupMode() && !viewMode.isImportMode() && !viewMode.isUnknownFacesMode() &&
            !viewMode.getCurrentDate() && !viewMode.getCurrentAlbumId() && !viewMode.getCurrentTagId()) {
            return;
        }

        if (!silent) {
            setPhotoLoading(true);
        }

        try {
            let photoEntities;

            // Modes that need unified API: album, tag, burst group, date with burst enabled
            // IMPORT mode never uses unified API - it has its own loading mechanism
            const needsUnifiedAPI = !viewMode.isImportMode() && (viewMode.isAlbumMode() || viewMode.isTagMode() ||
                viewMode.isInBurstGroupMode() || (viewMode.isDateMode() && burstModeEnabled) ||
                applyFilters);

            if (needsUnifiedAPI) {
                photoEntities = await loadViaUnifiedAPI(viewMode, config, requestId, silent);
                if (photoEntities === null) {
                    // Returned null because either the request was cancelled
                    // (newer request in flight) or actually failed. If
                    // cancelled, the newer request still has photoLoading
                    // set to true and will turn it off when it completes —
                    // we MUST NOT clear it here, otherwise the grid briefly
                    // renders an empty "No Photos" / "Trash is Empty" state
                    // while the active request is still loading.
                    if (!silent && isRequestValid(requestId)) {
                        setPhotoLoading(false);
                    }
                    return;
                }
            } else {
                // Use PhotoCollection for supported modes
                let collection;

                if (viewMode.isDateMode()) {
                    collection = PhotoCollection.createDateCollection([], viewMode.getCurrentDate(), config, parseInt(sortOfPhotos));
                } else if (viewMode.isRecentMode()) {
                    collection = PhotoCollection.createRecentCollection([], config, parseInt(sortOfPhotos));
                } else if (viewMode.isSearchMode()) {
                    // Use currentSearchParams from hook state, fallback to viewMode.data.searchParams
                    const searchParams = currentSearchParams || viewMode.data.searchParams;
                    collection = PhotoCollection.createSearchCollection([], viewMode.getSearchQuery(), config, searchParams, parseInt(sortOfPhotos));
                } else if (viewMode.isImportMode()) {
                    collection = PhotoCollection.createImportCollection(
                        [],
                        importState.currentImportPath || '',
                        importState.importPaths || [],
                        importState.importFilter || '',
                        config,
                        parseInt(sortOfPhotos),
                        importState
                    );
                } else if (viewMode.isTrashMode()) {
                    collection = PhotoCollection.createTrashCollection([], config, parseInt(sortOfPhotos));
                } else {
                    // Fallback to unified API
                    photoEntities = await loadViaUnifiedAPI(viewMode, config, requestId, silent);
                    if (photoEntities === null) {
                        // See comment above (same race condition).
                        if (!silent && isRequestValid(requestId)) {
                            setPhotoLoading(false);
                        }
                        return;
                    }
                }

                if (collection) {
                    const filters = { star: -1, hasComment: false, extension: "all" };
                    const updatedCollection = await collection.fetchPhotos(1, Math.min(9999, config?.max_photos_per_fetch || 1000), filters);

                    if (!isRequestValid(requestId)) {
                        return;
                    }

                    setPhotoCollection(updatedCollection);
                    setPhotosList({
                        photos: updatedCollection.photos,
                        has_next: updatedCollection.metadata.hasNext,
                        has_prev: updatedCollection.metadata.hasPrev
                    });

                    photoEntities = updatedCollection.photos.filter(photo => photo !== null);
                    setAllPhotosForCurrentFetch(photoEntities);

                    // Clear related states
                    setPhotosListImgSrc({});
                    setCurrentPhoto(null);
                    setCurrentPhotoIndex(undefined);
                }
            }

        } catch (error) {
            if (!isRequestValid(requestId)) {
                return;
            }

            // Reset to safe state
            setAllPhotosForCurrentFetch([]);
            setPhotosListMiniAllPhotos([]);
            setPhotosList({ photos: [], has_next: false, has_prev: false });
            setIsLimitedByConfig(false);
            setConfigLimit(null);

            handleError(error, 'Load photos', { mode: viewMode.mode });
            const errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
            addFooterMessage && addFooterMessage('photo_load', `Failed to load photos: ${errorMsg}`);
        } finally {
            if (isRequestValid(requestId) && !silent) {
                setPhotoLoading(false);
            }
        }
    }, [
        appConfig,
        sortOfPhotos,
        importState,
        burstModeEnabled,
        setPhotoLoading,
        setPhotoCollection,
        setPhotosList,
        setAllPhotosForCurrentFetch,
        setPhotosListMiniAllPhotos,
        setPhotosListImgSrc,
        setCurrentPhoto,
        setCurrentPhotoIndex,
        setIsLimitedByConfig,
        setConfigLimit,
        handleError,
        addFooterMessage,
        loadViaUnifiedAPI,
        startNewRequest,
        isRequestValid
    ]);

    // Legacy aliases for backward compatibility
    const loadAllPhotosBasedOnViewMode = useCallback(async (viewMode, config, silent = false) => {
        return loadPhotos(viewMode, { silent, applyFilters: true });
    }, [loadPhotos]);

    const loadPhotosWithCollection = useCallback(async (viewMode) => {
        return loadPhotos(viewMode, { silent: false, applyFilters: false });
    }, [loadPhotos]);

    /**
     * Get photos for current page (pagination)
     */
    const getPhotos = useCallback(async (e, isForward) => {
        // For paginated display, use memoized filtered data
        if (filteredPhotos.length === 0) {
            setPhotoLoading(false);
            return;
        }

        setPhotoLoading(true);

        // Derive date key from viewModeObj
        let date;
        if (viewModeObj.isRecentMode()) {
            date = "recent";
        } else if (viewModeObj.isSearchMode()) {
            date = "search_results";
        } else {
            date = viewModeObj.getDataAttribute();
        }

        let page = datePage[date] || 1;

        if (!page || page == "NaN") {
            page = 1;
        }
        page = parseInt(page);

        // Calculate page boundaries
        const pageStart = (page - 1) * numOfPhoto;
        const pageEnd = pageStart + parseInt(numOfPhoto);

        // Get photos for current page from filtered data
        const pagePhotos = filteredPhotos.slice(pageStart, pageEnd);

        if (pagePhotos.length > 0) {
            setPhotosList({
                photos: pagePhotos,
                has_next: pageEnd < filteredPhotos.length,
                has_prev: pageStart > 0
            });
        } else {
            // If no photos on this page, go back one page
            page -= 1;
            const newDatePage = { ...datePage, [date]: page };
            updateDatePage(newDatePage);
        }

        const newDatePage = { ...datePage, [date]: page };
        updateDatePage(newDatePage);
        setPhotoLoading(false);
    }, [
        filteredPhotos,
        numOfPhoto,
        viewModeObj,
        datePage,
        updateDatePage,
        setPhotosList,
        setPhotoLoading
    ]);

    return {
        // State
        photoLoading,
        setPhotoLoading,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,

        // Functions
        getPhotos,
        loadPhotos,
        // Legacy aliases (for backward compatibility)
        loadAllPhotosBasedOnViewMode,
        loadPhotosWithCollection
    };
}
