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
 * @param {boolean} params.recentPhotosMode - Recent photos mode flag
 * @param {boolean} params.isSearchMode - Search mode flag
 * @param {Array} params.searchResults - Search results array
 * @param {Object} params.importState - Import state object
 * @param {Function} params.setPhotosList - Set photos list function
 * @param {Function} params.setAllPhotosForCurrentFetch - Set all photos function
 * @param {Function} params.setIsLimitedByConfig - Set limited flag function
 * @param {Function} params.setConfigLimit - Set config limit function
 * @param {Function} params.setPhotosListMiniAllPhotos - Set mini photos function
 * @param {Function} params.setPhotoCollection - Set photo collection function
 * @param {Function} params.setPhotosListImgSrc - Set image source function
 * @param {Function} params.setCurrentPhotoPath - Set current photo path function
 * @param {Function} params.setCurrentPhotoIndex - Set current photo index function
 * @param {Function} params.convertPhotosToEntities - Convert photos function
 * @param {Function} params.handleError - Error handler function
 * @param {Object} params.datePage - Page number mapping by mode
 * @param {Function} params.updateDatePage - Update datePage function
 * @param {Function} params.addFooterMessage - Footer message function
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
    recentPhotosMode,
    isSearchMode,
    searchResults,
    importState,
    setPhotosList,
    setAllPhotosForCurrentFetch,
    setIsLimitedByConfig,
    setConfigLimit,
    setPhotosListMiniAllPhotos,
    setPhotoCollection,
    setPhotosListImgSrc,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    convertPhotosToEntities,
    handleError,
    datePage,
    updateDatePage,
    addFooterMessage
}) {
    // Loading state
    const [photoLoading, setPhotoLoading] = useState(false);
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);

    /**
     * Load all photos based on current view mode
     * @param {Object} viewMode - ViewMode object
     * @param {Object} config - App configuration
     * @param {boolean} silent - If true, don't show loading indicator (for metadata-only updates)
     */
    const loadAllPhotosBasedOnViewMode = useCallback(async (viewMode, config, silent = false) => {
        const callStack = new Error().stack;
        logger.info('PhotosList', 'load_photos_viewmode', 'loadAllPhotosBasedOnViewMode called', {
            viewMode: viewMode.mode,
            viewModeData: viewMode.data,
            hasConfig: !!config,
            silent,
            photoLoading,
            callStack: callStack.split('\n').slice(1, 4).join('\n')
        });

        if (!viewMode || !config) {
            logger.error("PhotosList", "error", "no viewModeObj or appConfig", {
                viewModeObj: viewMode,
                config: config
            });
            return;
        }

        // Prevent duplicate loading (but allow silent updates)
        if (photoLoading && !silent) {
            logger.info('PhotosList', 'loading_already_in_progress', 'Photo loading already in progress, skipping');
            return;
        }

        // IMPORT mode uses separate loading mechanism (ImportState + show_importer)
        if (viewMode.isImportMode()) {
            logger.info('PhotosList', 'import_mode_skip', 'Import mode uses ImportState, skipping get_photos_unified');
            return;
        }

        // Some view modes don't require a value (e.g., search with filters only, recent, trash)
        if (!viewMode.isSearchMode() && !viewMode.isRecentMode() && !viewMode.isTrashMode() && !viewMode.getCurrentDate() && !viewMode.getCurrentAlbumId() && !viewMode.getCurrentTagId()) {
            return;
        }

        logger.info('PhotosList', 'load_all_start', 'Loading all photos', {
            viewMode: viewMode.mode,
            viewModeData: viewMode.data,
            appConfig: config,
            silent,
            isSearchMode,
            searchResultsLength: searchResults.length
        });

        // Show loading indicator (unless silent mode)
        if (!silent) {
            setPhotoLoading(true);
        }

        try {
            let result;

            logger.debug('PhotosList', 'load_all_viewmode', 'Using ViewMode to generate parameters', {
                mode: viewMode.mode,
                viewModeData: viewMode.data
            });

            try {
                // Generate parameters using ViewMode
                const photoParams = viewMode.getUnifiedPhotoParams(config, {
                    sort_value: parseInt(sortOfPhotos),
                    star: starFilter || -1,
                    has_comment: hasCommentFilter || false,
                    extension: extensionFilter || "all"
                });

                logger.info('PhotosList', 'viewmode_params_generated', 'Generated parameters using ViewMode', {
                    mode: viewMode.mode,
                    params: photoParams
                });

                result = await invoke("get_photos_unified", {
                    request: photoParams
                });

                logger.info('PhotosList', 'viewmode_result', 'Unified get_photos result from ViewMode', {
                    resultType: typeof result,
                    hasResult: !!result,
                    mode: viewMode.mode
                });
            } catch (error) {
                handleError(error, `Unsupported mode ${viewMode.mode}`, { mode: viewMode.mode });
                return;
            }

            logger.info('PhotosList', 'about_to_parse', 'About to parse result', {
                resultType: typeof result,
                resultLength: result ? result.length : 'null',
                hasResult: !!result
            });

            const data = JSON.parse(result);

            logger.info('PhotosList', 'parse_success', 'JSON parse successful', {
                hasPhotos: !!(data && data.photos),
                photoCount: data && data.photos ? data.photos.length : 'no photos key'
            });

            // Validate data structure before proceeding
            if (!data || !data.photos || !Array.isArray(data.photos)) {
                logger.error('PhotosList', 'invalid_data_structure', 'Invalid data structure from backend', {
                    hasData: !!data,
                    hasPhotos: !!(data && data.photos),
                    photosType: data && data.photos ? typeof data.photos : 'undefined',
                    isArray: data && data.photos ? Array.isArray(data.photos) : false
                });
                return;
            }

            logger.info('PhotosList', 'load_all_parsed', 'Photos loaded and parsed', {
                photoCount: data.photos.length,
                viewMode: viewMode.mode,
                hasNext: data.has_next,
                hasPrev: data.has_prev
            });

            // Debug: Check if metadata is included
            if (data.photos.length > 0) {
                const firstPhoto = data.photos[0];
                logger.info('PhotosList', 'backend_data_sample', 'First photo from backend', {
                    path: firstPhoto?.file?.path || firstPhoto?.path,
                    hasTags: !!firstPhoto.tags,
                    tagsType: typeof firstPhoto.tags,
                    tagsLength: Array.isArray(firstPhoto.tags) ? firstPhoto.tags.length : 'not array',
                    tagsContent: firstPhoto.tags,
                    fullPhotoKeys: Object.keys(firstPhoto || {})
                });
            }

            // Check if we hit the configuration limit
            const effectiveLimit = config?.max_photos_per_fetch || 1000;
            const isLimited = data.photos.length >= effectiveLimit && (data.has_next || data.photos.length === effectiveLimit);
            setIsLimitedByConfig(isLimited);
            setConfigLimit(effectiveLimit);

            // Store all photos unfiltered - convert to Photo entities then to JSON for React state
            logger.info('PhotosList', 'setting_photos', 'Setting allPhotosForCurrentFetch', {
                photoCount: data.photos.length,
                firstPhotoPath: data.photos[0]?.file?.path || 'no photos'
            });

            // Convert backend data to Photo entities and store directly
            const photoEntities = convertPhotosToEntities(data.photos, config, false, false);
            logger.info('PhotosList', 'before_set_photos', 'About to update allPhotosForCurrentFetch', {
                photoCount: photoEntities.length
            });
            setAllPhotosForCurrentFetch(photoEntities);
            logger.info('PhotosList', 'photos_set', 'allPhotosForCurrentFetch state updated');

            // Don't apply filters here - let the memoized filteredPhotos handle it
            // This ensures consistency between all components

            // Hide loading indicator (unless in silent mode where it was never shown)
            if (!silent) {
                setPhotoLoading(false);
            }

        } catch (error) {
            // Reset to safe state
            setAllPhotosForCurrentFetch([]);
            setPhotosListMiniAllPhotos([]);
            setPhotosList({ photos: [], has_next: false, has_prev: false });
            setIsLimitedByConfig(false);
            setConfigLimit(null);

            // Hide loading indicator on error (unless in silent mode)
            if (!silent) {
                setPhotoLoading(false);
            }

            // Use enhanced error handling
            handleError(error, 'Load photos', { appConfig: config });

            // Fallback footer message
            const errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
            addFooterMessage && addFooterMessage(`Failed to load photos: ${errorMsg}`);
        }
    }, [
        // photoLoading removed - causes infinite loop when state changes
        sortOfPhotos,
        starFilter,
        hasCommentFilter,
        extensionFilter,
        isSearchMode,
        // searchResults removed - only used for logging, causes infinite loop in search mode
        setPhotoLoading,
        setAllPhotosForCurrentFetch,
        setIsLimitedByConfig,
        setConfigLimit,
        setPhotosListMiniAllPhotos,
        setPhotosList,
        convertPhotosToEntities,
        handleError,
        addFooterMessage
    ]);

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

        let date = recentPhotosMode ? "recent" : (isSearchMode ? "search_results" : viewModeObj.getDataAttribute());
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
        // Removed scrollLock for infinite scroll
    }, [
        filteredPhotos,
        numOfPhoto,
        recentPhotosMode,
        isSearchMode,
        viewModeObj,
        datePage,
        updateDatePage,
        setPhotosList,
        setPhotoLoading
    ]);

    /**
     * Load photos using PhotoCollection (supports Date, Recent, Search, Import, Trash modes)
     */
    const loadPhotosWithCollection = useCallback(async (viewMode) => {
        if (!viewMode) {
            logger.warn('PhotosList', 'load_photos_collection_no_viewmode', 'ViewMode not provided, skipping photo loading');
            return;
        }

        if (!appConfig) {
            logger.warn('PhotosList', 'load_photos_collection_no_config', 'Config not loaded yet, skipping photo loading');
            return;
        }

        if (photoLoading) {
            logger.info('PhotosList', 'loading_already_in_progress', 'Photo loading already in progress, skipping');
            return;
        }

        logger.info('PhotosList', 'load_photos_collection', 'Loading photos with PhotoCollection', {
            viewMode: viewMode.mode,
            viewModeData: viewMode.data,
            hasAppConfig: !!appConfig
        });

        setPhotoLoading(true);

        try {
            let collection;

            // Create appropriate PhotoCollection based on view mode
            if (viewMode.isDateMode()) {
                logger.info('PhotosList', 'creating_date_collection', 'Creating date collection', {
                    date: viewMode.getCurrentDate(),
                    sortOfPhotos: sortOfPhotos
                });
                collection = PhotoCollection.createDateCollection([], viewMode.getCurrentDate(), appConfig, parseInt(sortOfPhotos));
            } else if (viewMode.isRecentMode()) {
                logger.info('PhotosList', 'creating_recent_collection', 'Creating recent collection', {
                    sortOfPhotos: parseInt(sortOfPhotos)
                });
                collection = PhotoCollection.createRecentCollection([], appConfig, parseInt(sortOfPhotos));
            } else if (viewMode.isSearchMode()) {
                // For search, pass searchParams from viewMode
                const searchParams = viewMode.data.searchParams;
                logger.info('PhotosList', 'creating_search_collection', 'Creating search collection', {
                    searchQuery: viewMode.getSearchQuery(),
                    hasSearchParams: !!searchParams,
                    searchParams: searchParams,
                    sortOfPhotos: parseInt(sortOfPhotos)
                });
                collection = PhotoCollection.createSearchCollection([], viewMode.getSearchQuery(), appConfig, searchParams, parseInt(sortOfPhotos));
            } else if (viewMode.isImportMode()) {
                // For import mode, need to get values from importState
                if (!importState) {
                    logger.warn('PhotosList', 'import_state_missing', 'Import state not initialized, skipping photo load');
                    setPhotoLoading(false);
                    return;
                }
                logger.info('PhotosList', 'creating_import_collection', 'Creating import collection', {
                    currentImportPath: importState.currentImportPath,
                    importPaths: importState.importPaths,
                    importFilter: importState.importFilter,
                    sortOfPhotos: parseInt(sortOfPhotos)
                });
                collection = PhotoCollection.createImportCollection(
                    [],
                    importState.currentImportPath || '',
                    importState.importPaths || [],
                    importState.importFilter || '',
                    appConfig,
                    parseInt(sortOfPhotos)
                );
            } else if (viewMode.isTrashMode()) {
                logger.info('PhotosList', 'creating_trash_collection', 'Creating trash collection', {
                    sortOfPhotos: parseInt(sortOfPhotos)
                });
                collection = PhotoCollection.createTrashCollection([], appConfig, parseInt(sortOfPhotos));
            } else {
                logger.warn('PhotosList', 'unsupported_view_mode', 'View mode not yet supported in PhotoCollection', {
                    mode: viewMode.mode
                });
                // Fallback to new unified method
                setPhotoLoading(false);
                return await loadAllPhotosBasedOnViewMode(viewMode, appConfig);
            }

            // Fetch photos using PhotoCollection
            const filters = {
                star: -1,
                hasComment: false,
                extension: "all"
            };

            logger.info('PhotosList', 'fetching_photos', 'About to fetch photos using PhotoCollection', {
                mode: collection.mode,
                pageSize: Math.min(9999, appConfig?.max_photos_per_fetch || 1000),
                filters
            });
            const updatedCollection = await collection.fetchPhotos(1, Math.min(9999, appConfig?.max_photos_per_fetch || 1000), filters);
            logger.info('PhotosList', 'fetch_photos_result', 'Photos fetched from PhotoCollection', {
                mode: collection.mode,
                photoCount: updatedCollection.photos.length,
                hasNext: updatedCollection.metadata.hasNext,
                hasPrev: updatedCollection.metadata.hasPrev
            });

            // Update states
            setPhotoCollection(updatedCollection);
            setPhotosList({
                photos: updatedCollection.photos,
                has_next: updatedCollection.metadata.hasNext,
                has_prev: updatedCollection.metadata.hasPrev
            });

            // CRITICAL: Set allPhotosForCurrentFetch to enable filtering
            // Store Photo entities directly to preserve methods
            const photoEntities = updatedCollection.photos
                .filter(photo => photo !== null);
            setAllPhotosForCurrentFetch(photoEntities);

            // Clear related states (but NOT selection - it should persist across mode changes)
            setPhotosListImgSrc({});
            setCurrentPhotoPath("");
            setCurrentPhotoIndex(undefined);

            logger.info('PhotosList', 'load_photos_collection_success', 'Successfully loaded photos with PhotoCollection', {
                photoCount: updatedCollection.photos.length,
                hasNext: updatedCollection.metadata.hasNext
            });

        } catch (error) {
            handleError(error, 'Load photos collection', {
                viewMode: viewMode.mode,
                viewModeData: viewMode.data
            });
            // Fallback to unified method on error
            return await loadAllPhotosBasedOnViewMode(viewMode, appConfig);
        } finally {
            setPhotoLoading(false);
        }
    }, [
        photoLoading,
        appConfig,
        sortOfPhotos,
        searchResults,
        importState,
        setPhotoLoading,
        setPhotoCollection,
        setPhotosList,
        setAllPhotosForCurrentFetch,
        setPhotosListImgSrc,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        handleError,
        loadAllPhotosBasedOnViewMode
    ]);

    return {
        // State
        photoLoading,
        setPhotoLoading,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,

        // Functions
        getPhotos,
        loadAllPhotosBasedOnViewMode,
        loadPhotosWithCollection
    };
}
