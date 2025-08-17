// TODO: This file is too large (2033 lines) and should be refactored into smaller modules:
// - hooks/usePhotoSelection.js: Photo selection and multi-select functionality
// - hooks/usePhotoFetch.js: Data fetching and loading logic for different modes
// - hooks/useInfiniteScroll.js: Infinite scroll handling (already exists)
// - components/PhotoGrid.jsx: Photo grid rendering (already exists)  
// - components/PhotoActions.jsx: Action buttons and toolbars
// - PhotosList/PhotosListCore.jsx: Main component orchestrator
// - PhotosList/PhotosListViewModel.js: State management and business logic

import { useState, useEffect, useMemo, useCallback } from "react";
import PhotosListMini from "./PhotosList/PhotosListMini.jsx";
import PhotoOption from "./PhotosList/PhotoOption.jsx";
import { invoke } from "@tauri-apps/api/core";
import PhotoLoading from "./PhotosList/PhotoLoading.jsx";
import DirectoryMenu from "./PhotosList/DirectoryMenu.jsx";
import { ImgCacheContext, AllPhotosContext } from "./ImgCacheContext.jsx";
import Scrollable from "../Scrollable.jsx";
import '../scrollable.css';
import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useSearchAndFilters } from "../hooks/useSearchAndFilters.jsx";
import { usePhotoOperations } from "../hooks/usePhotoOperations.js";
import { usePhotoDataLoader } from "../hooks/usePhotoDataLoader.js";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll.js";
import { useError } from "../context/ErrorContext.jsx";
import { VIEW_MODES } from "../constants/viewModes.js";
import { ViewMode } from "../domain/ViewMode.js";
import { PhotoCollection } from "../domain/PhotoCollection.js";
import { Photo } from "../domain/Photo.js";
import { ImportState } from "../domain/ImportState.js";
import SearchTools from "../components/SearchTools.jsx";
import TagChip from "../components/TagChip.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import AlbumCreationModal from "../components/AlbumCreationModal.jsx";
import FilterPopover from "../components/FilterPopover.jsx";
import BackNavigationLink from "../components/BackNavigationLink.jsx";
import VerticalTabBar from "../components/VerticalTabBar.jsx";
import { logger } from "../services/LoggerService.js";
import { unifiedCollectionService } from "../services/UnifiedCollectionService.js";
// New separated components
import GenericListView from "./PhotosList/GenericListView.jsx";
import PhotoGrid from "./PhotosList/PhotoGrid.jsx";
import PhotosToolbar from "./PhotosList/PhotosToolbar.jsx";
import StatusBar from "./PhotosList/StatusBar.jsx";
import ListViewHeader from "./PhotosList/ListViewHeader.jsx";
import { usePhotosState } from "../hooks/usePhotosState.js";
import { convertPhotosToEntities, applyFrontendFilters, convertJSONToPhotoEntities } from "../utils/PhotoProcessingUtils.js";
import { hasActiveFilters, getFilterSummary, getSortConfig, getCurrentSortConfig } from "../utils/UIStateUtils.js";

function PhotosList(props) {
    const { config: appConfig } = props; // Extract config from props
    const {
        dateList,
        datePage,
        updateDatePage,
        currentDate,
        updateCurrentDate,
        dateNum,
        updateDateNum,
        updateDateList,
        showPhotoDisplay,
        updateShowPhotoDisplay,
        setCurrentDateNum,
        recentPhotosMode,
        albumsList,
        currentAlbum,
        albumPhotos,
        updateAlbumsList,
        updateCurrentAlbum,
        updateAlbumPhotos,
        togglePhotoDisplay
    } = usePhoto();

    logger.debug('PhotosList', 'component_render', 'PhotosList rendering', {
        recentPhotosMode,
        currentDate,
        propsCount: Object.keys(props).length
    });
    const {
        addFooterMessage,
        toggleSearchPage,
        searchInitialQuery,
        showAlbumsList,
        currentAlbumId,
        currentTagId,
        viewMode,
        modeData,
        openAlbum,
        toggleAlbumListMode,
        openTag,
        openTagsList,
        toggleHome,
    } = useUI();

    const { handleTauriError, addError } = useError();

    // Log viewMode changes
    useEffect(() => {
        logger.info('PhotosList', 'mode_change', 'View mode changed', { viewMode });
    }, [viewMode]);

    // Use new search and filters hook
    const {
        searchFilters,
        setSearchFilters,
        currentSearchParams,
        setCurrentSearchParams,
        searchResults,
        searchQuery,
        isSearching,
        performSearch,
        clearSearch: clearSearchHook,
        clearAllSearchFilters,
        updateSearchParams,
        executeSearch
    } = useSearchAndFilters();

    // Custom clear search function that also navigates back to home
    const clearSearch = useCallback(() => {
        clearSearchHook();
        updateSearchParams(null);
        // Navigate back to home by toggling search page off
        toggleSearchPage(false);
    }, [clearSearchHook, updateSearchParams, toggleSearchPage]);

    // ViewMode now handles all configuration - fetchConfig deprecated

    // Create props compatibility layer for gradual migration
    const compatProps = {
        dateList: dateList || [],
        datePage: datePage || {},
        currentDate: currentDate || "",
        dateNum: dateNum || {},
        showPhotoDisplay: showPhotoDisplay || {},
        setDatePage: updateDatePage,
        setCurrentDate: updateCurrentDate,
        setShowPhotoDisplay: updateShowPhotoDisplay,
        setDateNum: updateDateNum,
        setDateList: updateDateList,
        togglePhotoDisplay: togglePhotoDisplay,
        setCurrentDateNum: setCurrentDateNum,
        addFooterMessage: addFooterMessage,
        ...props
    };
    // Replace all individual useState calls with centralized state management hook
    const {
        // Core photo data
        photos, setPhotosList,
        photoCollection, setPhotoCollection,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        currentPhotoPath, setCurrentPhotoPath,
        currentPhotoIndex, setCurrentPhotoIndex,
        
        // UI state
        iconSize, setIconSize,
        numOfPhoto, setNumOfPhoto,
        photoLoading, setPhotoLoading,
        showSideMenu, setShowSideMenu,
        
        // Selection state
        photoSelection, setPhotoSelection,
        photoSelectionDict, setPhotoSelectionDict,
        
        // Infinite scroll - now handled by useInfiniteScroll hook
        
        // Configuration limits
        isLimitedByConfig, setIsLimitedByConfig,
        configLimit, setConfigLimit,
        
        // Filter state
        star, setStar,
        starFilter, setStarFilter,
        hasCommentFilter, setHasCommentFilter,
        hasTagFilter, setHasTagFilter,
        extensionFilter, setExtensionFilter,
        
        // PhotosListMini
        photosListMiniAllPhotos, setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex,
        photosListMiniReread, setPhotosListMiniReread,
        
        // Cache and performance
        photosListImgSrc, setPhotosListImgSrc,
        imgCacheMap, setImgCacheMap,
        thumbnailStore, setThumbnailStore,
        
        // Debug and misc
        debugMessage, setDebugMessage,
        currentPhotoLoadingController, setCurrentPhotoLoadingController,
        
        // Sorting
        sortOfPhotos, setSort,
        sortInitialized,
        
        // Filter options
        filterOptions, setFilterOptions,
        isFilterOptionsLoading, setIsFilterOptionsLoading,
        
        // Import
        importState, setImportState,
        
        // Albums
        filteredAlbums, setFilteredAlbums,
        albumSearchTerm, setAlbumSearchTerm,
        currentAlbumName, setCurrentAlbumName,
        showAlbumCreationModal, setShowAlbumCreationModal,
        selectedAlbums, setSelectedAlbums,
        
        // Tags
        tagsList, setTagsList,
        filteredTags, setFilteredTags,
        tagSearchTerm, setTagSearchTerm,
        currentTagName, setCurrentTagName,
        tagPhotos, setTagPhotos,
        trashPhotos, setTrashPhotos,
        selectedTags, setSelectedTags,
        
        // Filter popover
        showFilterPopover, setShowFilterPopover,
        filterButtonRef
    } = usePhotosState();

    // Create ViewMode object from global state - single source of truth
    const viewModeObj = useMemo(() => {
        // Defensive programming: ensure viewMode is valid
        const safeViewMode = viewMode || VIEW_MODES.HOME;
        logger.debug('PhotosList', 'viewmode_creation', 'Creating ViewMode object', {
            viewMode: safeViewMode,
            albumId: currentAlbumId,
            tagId: currentTagId,
            date: currentDate
        });

        try {
            return new ViewMode(safeViewMode, {
                albumId: currentAlbumId,
                albumName: currentAlbumName,
                tagId: currentTagId,
                tagName: currentTagName,
                searchQuery: searchInitialQuery,
                date: currentDate
            });
        } catch (error) {
            logger.error('PhotosList', 'viewmode_creation_error', 'Failed to create ViewMode', {
                viewMode: safeViewMode,
                error: error.message
            });
            // Fallback to HOME mode
            return new ViewMode(VIEW_MODES.HOME, {});
        }
    }, [viewMode, currentAlbumId, currentAlbumName, currentTagId, currentTagName, searchInitialQuery, currentDate]);

    // Mode detection using ViewMode value object
    // ViewMode object is the single source of truth for mode state
    const isSearchMode = viewModeObj.isSearchMode();
    const isAdvancedSearchMode = viewModeObj.isAdvancedSearchMode();

    // Extract boolean mode checks from ViewMode object (method calls)
    const isAlbumMode = viewModeObj.isAlbumMode();
    const isAlbumListMode = viewModeObj.isAlbumListMode();
    const isTagMode = viewModeObj.isTagMode();
    const isTagListMode = viewModeObj.isTagListMode();
    const isTrashMode = viewModeObj.isTrashMode();

    // Convert photos function wrapper to maintain callback behavior
    const convertPhotosWithConfig = useCallback((photosData, isFromTrash = false, toJSON = true) => {
        return convertPhotosToEntities(photosData, appConfig, isFromTrash, toJSON);
    }, [appConfig]);

    // Unified error handler for consistent error logging and handling
    const handleError = useCallback((error, operation, context = {}) => {
        const logContext = {
            error: error.message,
            ...context
        };
        
        logger.error('PhotosList', `${operation.toLowerCase().replace(/\s+/g, '_')}_failed`, 
            `Failed to ${operation.toLowerCase()}`, logContext);
        
        handleTauriError(error, operation);
    }, [handleTauriError]);

    // Use photo data loader hook
    const {
        loadUnifiedData,
        loadAlbums,
        loadAlbumPhotos,
        handleAlbumClick,
        loadTags,
        loadTagPhotos,
        loadTrashPhotos,
        loadFilterOptions,
        logOperation
    } = usePhotoDataLoader({
        handleError,
        convertPhotosToEntities: convertPhotosWithConfig,
        updateAlbumsList,
        setFilteredAlbums,
        updateAlbumPhotos,
        setPhotosList,
        setTagsList,
        setFilteredTags,
        setTagPhotos,
        setTrashPhotos,
        setCurrentAlbumName,
        openAlbum,
        setFilterOptions,
        setIsFilterOptionsLoading,
        filterOptions,
        isFilterOptionsLoading,
        appConfig
    });

    // Photo operations hook - handles photo-related actions
    const {
        handleAddToAlbum,
        removePhotoFromAlbum,
        deletePhoto,
        restorePhoto,
        permanentlyDeletePhoto: hookPermanentlyDeletePhoto,
        handleAlbumSelection,
        clearAlbumSelection,
        deleteSelectedAlbums,
        handleAlbumDelete,
        handleTagSelection,
        clearTagSelection,
        deleteSelectedTags
    } = usePhotoOperations({
        selectedAlbums,
        setSelectedAlbums,
        selectedTags,
        setSelectedTags,
        tagsList,
        albumsList,
        appConfig,
        currentViewMode: viewMode,
        currentDate,
        currentAlbumName,
        currentTagName,
        searchQuery,
        handleError,
        addFooterMessage: compatProps.addFooterMessage,
        loadAlbums,
        loadTags,
        currentAlbumId,
        toggleAlbumListMode,
        isTrashMode
    });

    // Clear all active filters
    const clearAllFilters = useCallback(() => {
        setStarFilter(0);
        setHasCommentFilter(false);
        setHasTagFilter(false);
        setExtensionFilter('all');
    }, [setStarFilter, setHasCommentFilter, setHasTagFilter, setExtensionFilter]);


    // Frontend filtering function wrapper
    const applyFiltersWithConfig = useCallback((photos) => {
        return applyFrontendFilters(photos, {
            starFilter,
            hasCommentFilter,
            hasTagFilter,
            extensionFilter
        });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);


    // Initialize showSideMenu based on view mode
    useEffect(() => {
        setShowSideMenu(isSearchMode || viewMode === VIEW_MODES.IMPORT);
    }, [isSearchMode, viewMode, setShowSideMenu]);

    // Album loading functions


    // Handle tag click to switch to tag view
    const handleTagClick = useCallback((tag) => {
        logOperation.click('tag', {
            tagId: tag.id,
            tagName: tag.name
        });

        // Switch to tag view mode
        openTag(tag.id);
        setCurrentTagName(tag.name);

        // Load tag photos
        loadTagPhotos(tag.id);
    }, [openTag, loadTagPhotos, logOperation]);

    // Handle new tag creation
    const handleNewTagClick = useCallback(async () => {
        try {
            const tagName = prompt("Enter tag name:");
            if (!tagName || tagName.trim() === '') {
                return;
            }

            const tagColor = prompt("Enter tag color (hex code, e.g., #ff0000) or leave empty:");
            const color = tagColor && tagColor.trim() !== '' ? tagColor.trim() : null;

            logger.info('PhotosList', 'create_tag_start', 'Creating new tag via unified collection service', {
                tagName: tagName.trim(),
                color
            });

            const newTag = await unifiedCollectionService.createCollection('tag', {
                name: tagName.trim(),
                color
            });

            logger.info('PhotosList', 'create_tag_success', 'Tag created successfully', {
                tagId: newTag.id,
                tagName: newTag.name
            });

            // Reload tags to show the new tag
            loadTags();

        } catch (error) {
            handleError(error, 'Create tag');
        }
    }, [handleError, loadTags]);

    // Handle new album creation
    const handleNewAlbumClick = useCallback(() => {
        logger.info('PhotosList', 'new_album_click', 'Opening album creation modal from grid', {
            currentMode: viewMode
        });
        setShowAlbumCreationModal(true);
    }, [viewMode]);

    // Handle album creation from modal
    const createEmptyAlbum = useCallback(async (albumData) => {
        try {
            logger.info('PhotosList', 'create_empty_album_start', 'Creating empty album via unified collection service', {
                albumName: albumData.name,
                hasDescription: !!albumData.description
            });

            const newAlbum = await unifiedCollectionService.createCollection('album', {
                name: albumData.name,
                description: albumData.description || ''
            });

            logger.info('PhotosList', 'create_empty_album_success', 'Empty album created successfully', {
                albumId: newAlbum.id,
                albumName: newAlbum.name
            });

            // Close modal
            setShowAlbumCreationModal(false);

            // Reload albums to show the new album
            loadAlbums();

            // Navigate to the new album
            openAlbum(newAlbum.id);
            setCurrentAlbumName(newAlbum.name);

        } catch (error) {
            handleError(error, 'Create album', { albumName: albumData.name });
        }
    }, [handleError, loadAlbums, openAlbum]);


    // Mode-to-loader function mapping
    const modeLoaders = useMemo(() => ({
        [VIEW_MODES.ALBUM_LIST]: () => loadAlbums(),
        [VIEW_MODES.TAG_LIST]: () => loadTags(),
        [VIEW_MODES.TRASH]: async () => {
            // Wait for config to be loaded
            if (!appConfig) {
                logger.warn('PhotosList', 'trash_mode_config_not_ready', 'Config not loaded yet, skipping trash load');
                return;
            }

            const trashCollection = PhotoCollection.createTrashCollection([], appConfig, parseInt(sortOfPhotos || 0));
            setPhotoCollection(trashCollection);

            // Fetch trash photos
            try {
                const updatedCollection = await trashCollection.fetchPhotos(1, 1000, {
                    star: -1,
                    hasComment: false,
                    extension: 'all'
                });

                logger.info('PhotosList', 'trash_mode_loader_success', 'Trash collection loaded', {
                    photoCount: updatedCollection.photos.length
                });

                setPhotoCollection(updatedCollection);
            } catch (error) {
                handleError(error, 'Load trash collection');
            }
        },
        [VIEW_MODES.ALBUM]: () => {
            if (currentAlbumId) {
                loadAlbumPhotos(currentAlbumId);
            }
        },
        [VIEW_MODES.TAG]: () => {
            if (currentTagId) {
                loadTagPhotos(currentTagId);
            }
        }
    }), [loadAlbums, loadTags, appConfig, sortOfPhotos, loadAlbumPhotos, loadTagPhotos, currentAlbumId, currentTagId]);

    // Execute mode-specific loader functions
    useEffect(() => {
        const loader = modeLoaders[viewMode];
        if (loader) {
            loader();
        }

        // Clear names when not in specific modes
        if (viewMode !== VIEW_MODES.ALBUM) {
            setCurrentAlbumName('');
        }
        if (viewMode !== VIEW_MODES.TAG) {
            setCurrentTagName('');
        }
    }, [viewMode, modeLoaders]);

    // Set album/tag names based on current selection
    useEffect(() => {
        if (viewMode === VIEW_MODES.ALBUM && currentAlbumId && albumsList.length > 0) {
            const currentAlbum = albumsList.find(album => album.id === currentAlbumId);
            if (currentAlbum) {
                setCurrentAlbumName(currentAlbum.name);
            }
        }
    }, [viewMode, currentAlbumId, albumsList, setCurrentAlbumName]);

    useEffect(() => {
        if (viewMode === VIEW_MODES.TAG && currentTagId && tagsList.length > 0) {
            const currentTag = tagsList.find(tag => tag.id === currentTagId);
            if (currentTag) {
                setCurrentTagName(currentTag.name);
            }
        }
    }, [viewMode, currentTagId, tagsList, setCurrentTagName]);

    // Filter albums by search term
    useEffect(() => {
        if (albumsList.length === 0) {
            setFilteredAlbums([]);
            return;
        }

        if (!albumSearchTerm.trim()) {
            setFilteredAlbums(albumsList);
            return;
        }

        const filtered = albumsList.filter(album =>
            album.name.toLowerCase().includes(albumSearchTerm.toLowerCase())
        );
        setFilteredAlbums(filtered);
    }, [albumsList, albumSearchTerm]);

    // Filter tags by search term
    useEffect(() => {
        if (tagsList.length === 0) {
            setFilteredTags([]);
            return;
        }

        if (!tagSearchTerm.trim()) {
            setFilteredTags(tagsList);
            return;
        }

        const filtered = tagsList.filter(tag =>
            tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase())
        );
        setFilteredTags(filtered);
    }, [tagsList, tagSearchTerm]);


    // Search handlers (defined after state to ensure sortOfPhotos is available)
    const handleSearch = useCallback(async (query, type, filters) => {
        const params = { query, searchType: type, filters };
        logger.info('PhotosList', 'handle_search', 'Search triggered from UI', {
            query,
            type,
            filters,
            isSearchMode,
            searchResultsLength: searchResults.length
        });
        updateSearchParams(params);

        // Map sortOfPhotos to backend sort field names with order
        const config = getCurrentSortConfig(sortOfPhotos);
        const sortField = config.field;
        const sortOrder = config.order;

        await performSearch(query, type, filters, sortField, sortOrder);
    }, [performSearch, sortOfPhotos]);

    // Auto-execute search when coming from HOME with initial query
    useEffect(() => {
        if (isSearchMode && searchInitialQuery && searchInitialQuery.trim() && !searchQuery) {
            logger.info('PhotosList', 'auto_search_from_home', 'Executing auto-search from HOME', {
                searchInitialQuery,
                isSearchMode
            });
            handleSearch(searchInitialQuery, 'all', {});
        }
    }, [isSearchMode, searchInitialQuery, searchQuery, handleSearch]);


    const handleSavedSearchSelect = useCallback((searchParams) => {
        updateSearchParams(searchParams);

        // Map sortOfPhotos to backend sort field names with order
        const config = getCurrentSortConfig(sortOfPhotos);
        const sortField = config.field;
        const sortOrder = config.order;

        performSearch(searchParams.query, searchParams.searchType, searchParams.filters, sortField, sortOrder);
    }, [performSearch, sortOfPhotos]);


    // Use filtered photos based on current view mode (compatible with existing data flow)
    const filteredPhotos = useMemo(() => {
        // Use appropriate photo source based on current mode
        const sourcePhotos = viewModeObj.isAlbumMode() ? albumPhotos :
            (viewModeObj.isTagMode() ? tagPhotos :
                (viewModeObj.isTrashMode() ? (photoCollection?.photos || []) :
                    allPhotosForCurrentFetch));

        logger.debug('PhotosList', 'filtered_photos_source', 'Using photo source for filtering', {
            mode: viewModeObj.mode,
            sourceCount: sourcePhotos.length,
            isAlbumMode: viewModeObj.isAlbumMode(),
            isTagMode: viewModeObj.isTagMode(),
            isTrashMode: viewModeObj.isTrashMode(),
            sourceType: sourcePhotos.length > 0 ? typeof sourcePhotos[0] : 'empty',
            firstPhotoIsEntity: sourcePhotos.length > 0 ? sourcePhotos[0].constructor.name : 'none'
        });

        // Convert source photos to Photo entities if they're plain objects
        const photosWithMethods = convertJSONToPhotoEntities(sourcePhotos, appConfig);

        // Apply frontend filters
        const result = applyFiltersWithConfig(photosWithMethods);

        logger.debug('PhotosList', 'filtered_photos_result', 'Filtering completed', {
            inputCount: sourcePhotos.length,
            outputCount: result.length,
            resultType: result.length > 0 ? typeof result[0] : 'empty'
        });

        return result;
    }, [viewModeObj, albumPhotos, tagPhotos, photoCollection?.photos, allPhotosForCurrentFetch, applyFiltersWithConfig]);

    // Use infinite scroll hook
    const {
        infiniteScrollEnabled,
        setInfiniteScrollEnabled,
        displayedPhotoCount,
        setDisplayedPhotoCount,
        isLoadingMore,
        setIsLoadingMore,
        displayedPhotos,
        hasMorePhotos,
        allPhotosLoaded,
        loadMorePhotos,
        handleInfiniteScroll,
        totalPhotos,
        displayedCount
    } = useInfiniteScroll(filteredPhotos);

    // Check if any filters are active using utility function
    const hasActiveFiltersState = useMemo(() => {
        return hasActiveFilters({ starFilter, hasCommentFilter, hasTagFilter, extensionFilter });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    // Get filter summary using utility function
    const getFilterSummaryText = useMemo(() => {
        return getFilterSummary({ starFilter, hasCommentFilter, hasTagFilter, extensionFilter });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    // Render filter clearing UI component
    const renderFilterClearingUI = useCallback(() => {
        if (!hasActiveFiltersState) return null;
        
        return (
            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                {getFilterSummaryText}
                <button
                    style={{ marginLeft: "10px", fontSize: "11px", padding: "2px 6px", cursor: "pointer" }}
                    onClick={clearAllFilters}
                >
                    Clear Filters
                </button>
            </div>
        );
    }, [hasActiveFiltersState, getFilterSummaryText, clearAllFilters]);


    // Notify parent when menu state changes
    useEffect(() => {
        if (props.onRightMenuToggle) {
            props.onRightMenuToggle(showSideMenu);
        }
    }, [showSideMenu, props.onRightMenuToggle]);

    // Close side menu when transitioning from search mode to non-search mode
    useEffect(() => {
        if (!isSearchMode && showSideMenu) {
            // Only close if we were previously in search mode
            setShowSideMenu(false);
        }
    }, [isSearchMode]);

    // Re-execute search when sort changes (only if we have active search)
    useEffect(() => {
        // Skip initial render to avoid infinite loop
        if (!sortInitialized.current) {
            sortInitialized.current = true;
            return;
        }

        // Only re-execute if we're in search mode, have search params, and there are search results
        if (isSearchMode && currentSearchParams && searchResults.length > 0) {
            logger.info('PhotosList', 'sort_changed_reexecute', 'Re-executing search due to sort change', {
                sortOfPhotos,
                currentSearchParams
            });

            // Call performSearch directly to avoid dependency cycle
            const sortConfig = {
                0: { field: 'exif_date_time_original', order: 'desc' },
                1: { field: 'exif_date_time_original', order: 'asc' },
                2: { field: 'photo_date', order: 'desc' },
                3: { field: 'photo_date', order: 'asc' },
                4: { field: 'star', order: 'desc' },
                5: { field: 'star', order: 'asc' },
                6: { field: 'path', order: 'desc' },
                7: { field: 'path', order: 'asc' }
            };
            const config = sortConfig[sortOfPhotos] || sortConfig[0];

            performSearch(
                currentSearchParams.query,
                currentSearchParams.searchType,
                currentSearchParams.filters,
                config.field,
                config.order
            );
        }
    }, [sortOfPhotos, isSearchMode, currentSearchParams, performSearch]);


    const handleFiltersChange = useCallback((newFilters) => {
        updateSearchParams({ filters: newFilters });
    }, []); // Removed dependencies for manual execution only

    // Infinite scroll handlers

    // Notify parent when menu state changes

    // Create enhanced setStar function that updates photosListMiniAllPhotos
    const setStarWithUpdate = (newStar) => {
        setStar(newStar);

        // Calculate star value from array
        let starValue = 0;
        for (let i = 0; i < 5; i++) {
            if (newStar[i]) {
                starValue = i + 1;
            } else {
                break;
            }
        }

        // Update the star value in photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === currentPhotoPath) {
                return { ...photoJSON, star: starValue };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === currentPhotoPath) {
                return { ...photo, star: starValue };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    };

    // Create function to update comment in photo lists
    const updatePhotoComment = (photoPath, hasComment) => {
        // Update photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === photoPath) {
                return { ...photoJSON, comment: hasComment ? "has comment" : null };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === photoPath) {
                return { ...photo, comment: hasComment ? "has comment" : null };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    };

    // Album management handlers
    const handleAlbumUpdate = () => {
        // Refresh album list and current album after update
        if (viewMode === VIEW_MODES.ALBUM_LIST) {
            loadAlbums();
        }
        if (currentAlbumId) {
            loadAlbumPhotos(currentAlbumId);
        }
        logger.info('PhotosList', 'album_updated', 'Album refreshed after update', { currentAlbumId });
    };



    useEffect((e) => {
        if (appConfig) {
            setThumbnailStore(appConfig.thumbnail_store);
        }

        // Cleanup function to cancel any pending photo loading on component unmount
        return () => {
            if (currentPhotoLoadingController) {
                currentPhotoLoadingController.abort();
            }
        };
    }, [appConfig])

    useEffect(() => {
        // Set CSS custom property for grid column sizing based on icon size
        // Use a more appropriate calculation for grid sizing
        const gridSize = Math.max(120, parseInt(iconSize) + 41);
        document.documentElement.style.setProperty('--photo-grid-size', `${gridSize}px`);

        // Cleanup function
        return () => {
            // Cancel any pending requests when component unmounts
            if (currentPhotoLoadingController) {
                currentPhotoLoadingController.abort();
            }
        };
    }, [iconSize])

    // Load photos when ViewMode changes
    useEffect(() => {
        if (!viewMode) {
            logger.debug('PhotosList', 'useEffect_skip_no_viewmode', 'Skipping photo reload - no viewMode');
            return;
        }

        setShowSideMenu(isSearchMode);

        // Cancel current photo loading if in progress
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }

        // Create ViewMode object
        const viewModeObj = new ViewMode(viewMode, {
            date: currentDate,
            albumId: currentAlbumId,
            tagId: currentTagId,
            searchQuery: searchQuery,
            searchParams: currentSearchParams
        });

        // Skip photo loading if in album or tag mode - these photos are managed separately
        if (viewModeObj.isAlbumMode()) {
            logger.debug('PhotosList', 'useEffect_skip_album', 'Skipping photo reload - in album mode');
            return;
        }
        if (viewModeObj.isTagMode()) {
            logger.debug('PhotosList', 'useEffect_skip_tag', 'Skipping photo reload - in tag mode');
            return;
        }

        // Reset photo list state and clear currentPhotoPath when changing modes
        setPhotosList({ "photos": [] });
        setCurrentPhotoIndex(0);
        setPhotosListMiniCurrentIndex(0);
        setCurrentPhotoPath("");

        // Skip if already loading to prevent race conditions
        if (photoLoading) {
            return;
        }

        // Load all photos based on ViewMode
        logger.debug('PhotosList', 'useEffect_load', 'Calling loadPhotosWithCollection (ViewMode approach)');
        loadPhotosWithCollection(viewModeObj);

    }, [viewMode, currentDate, currentAlbumId, currentTagId, searchQuery, currentSearchParams, appConfig]);

    // Handle import state changes  
    useEffect(() => {
        if (viewMode === VIEW_MODES.IMPORT && importState) {
            logger.info('PhotosList', 'import_state_changed', 'Import state changed, reloading photos', {
                currentPath: importState.currentImportPath,
                filter: importState.importFilter,
                importStateId: importState._stateId // Add unique identifier to track state changes
            });
            
            const viewModeObj = new ViewMode(VIEW_MODES.IMPORT, {
                currentImportPath: importState.currentImportPath,
                importFilter: importState.importFilter
            });
            loadPhotosWithCollection(viewModeObj);
        }
    }, [importState, viewMode]);



    // Load filter options for Advanced Search mode
    useEffect(() => {
        if (isAdvancedSearchMode && !filterOptions && !isFilterOptionsLoading) {
            logger.info('PhotosList', 'advanced_search_init', 'Loading filter options for Advanced Search mode');
            loadFilterOptions();
        }
    }, [isAdvancedSearchMode, filterOptions, isFilterOptionsLoading, loadFilterOptions]);

    // Apply filters when filter settings change (infinite scroll version)
    useEffect(() => {
        if (filteredPhotos.length > 0 || allPhotosForCurrentFetch.length > 0) {
            // Convert Photo entities to JSON for PhotosListMini (with safety check)
            const photosAsJSON = filteredPhotos
                .filter(photo => photo && typeof photo.toJSON === 'function')
                .map(photo => photo.toJSON());
            
            logger.debug('PhotosList', 'photos_json_conversion', 'Converting photos to JSON', {
                totalPhotos: filteredPhotos.length,
                validPhotos: photosAsJSON.length,
                skippedPhotos: filteredPhotos.length - photosAsJSON.length,
                firstPhotoType: filteredPhotos.length > 0 ? filteredPhotos[0].constructor.name : 'none',
                hasToJSONMethod: filteredPhotos.length > 0 ? typeof filteredPhotos[0].toJSON : 'none'
            });
            
            setPhotosListMiniAllPhotos(photosAsJSON);

            // Reset display count for infinite scroll when filters change
            if (infiniteScrollEnabled) {
                setDisplayedPhotoCount(Math.min(50, filteredPhotos.length));
            }
        }
    }, [filteredPhotos, infiniteScrollEnabled, allPhotosForCurrentFetch]);

    // Update photos list when displayedPhotos changes (for infinite scroll)
    useEffect(() => {
        if (displayedPhotos.length > 0) {
            setPhotosList({ photos: displayedPhotos, has_next: false, has_prev: false });
        }
    }, [displayedPhotos]);

    function displayPhoto(f, i) {
        const photoToFind = photosListMiniAllPhotos[i];
        const displayPath = photoToFind ? (photoToFind.file?.path || photoToFind.path || f) : f;

        // Calculate the correct key for showPhotoDisplay based on current mode
        const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();


        setCurrentPhotoPath(displayPath);
        setCurrentPhotoIndex(i);

        // Find the global index in the all photos array
        const globalIndex = photosListMiniAllPhotos.findIndex(photo => photo.originalPath === f);
        if (globalIndex !== -1) {
            setPhotosListMiniCurrentIndex(globalIndex);
        } else {
            // Fallback: use the provided index if photo not found in all photos
            setPhotosListMiniCurrentIndex(i);
        }

        // Force a re-read to ensure thumbnails are properly initialized
        setPhotosListMiniReread(!photosListMiniReread);

        // Use togglePhotoDisplay with the correct key
        compatProps.togglePhotoDisplay(displayKey, true);

    }

    function addSelection(t, f) {
        const selection = photoSelection.concat();
        if (t) {
            if (!photoSelectionDict[f]) {
                selection.push(f);
                photoSelectionDict[f] = true;
            }
            changeTab(undefined, "#tab-selection");
        } else {
            delete photoSelectionDict[f];
            const i = selection.indexOf(f)
            if (i >= 0) {
                selection.splice(i, 1);
            }
        }
        setPhotoSelectionDict(photoSelectionDict);
        setPhotoSelection(selection);
    }

    function toggleSelection(f) {
        let t = true;
        if (photoSelectionDict[f]) {
            t = false;
        }
        addSelection(t, f);
        return t;
    }

    function isSelected(f) {
        return photoSelectionDict[f];
    }

    function clearPhotoSelection() {
        setPhotoSelectionDict({});
        setPhotoSelection([]);
    }

    function selectAllPhotoToSelection() {
        const selection = photoSelection.concat();
        const newSelectionDict = { ...photoSelectionDict };

        // For infinite scroll, select only displayed photos to avoid confusion
        const targetPhotos = infiniteScrollEnabled ? displayedPhotos : filteredPhotos;

        targetPhotos.forEach((photo) => {
            const path = photo.originalPath;
            if (!newSelectionDict[path]) {
                selection.push(path);
                newSelectionDict[path] = true;
            }
        });

        setPhotoSelectionDict(newSelectionDict);
        setPhotoSelection(selection);
    }

    const [tabClass, setTabClass] = useState(() => {
        // Initialize tabs based on current view mode
        if (viewMode === VIEW_MODES.IMPORT) {
            return {
                'directory': true,  // Default to directory tab in import mode
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': false,
            };
        } else {
            return {
                'maintenance': false,
                'selection': false,
                'search': isSearchMode,
                'filter': false,
                'directory': false,
            };
        }
    });

    function changeTab(e, t) {
        if (e) e.preventDefault();
        const c = {
            'filter': false,
            'maintenance': false,
            'selection': false,
            'search': false,
            'directory': false,
        };
        c[t.replace(/^.*#tab-/, '')] = true;
        setTabClass(c);
    }

    // Update tab state when view mode changes
    useEffect(() => {
        if (viewMode === VIEW_MODES.IMPORT) {
            setTabClass({
                'directory': true,  // Default to directory tab in import mode
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': false,
            });
            setShowSideMenu(true);  // Automatically open side menu in import mode

            // Clear existing photo data when entering import mode
            logger.info('PhotosList', 'import_mode_entered', 'Clearing existing photo data for import mode');
            setAllPhotosForCurrentFetch([]);
            setPhotosListMiniAllPhotos([]);
            setPhotosList({ photos: [], has_next: false, has_prev: false });
            setPhotoSelection([]);
            setPhotoSelectionDict({});

            // Initialize ImportState if not already initialized
            if (!importState) {
                ImportState.create().then((newImportState) => {
                    // Set up callbacks
                    newImportState.onDirectoryChange = (updatedState) => {
                        logger.info('PhotosList', 'import_directory_changed', 'Directory changed in import mode', {
                            currentPath: updatedState.currentImportPath,
                            importPaths: updatedState.importPaths
                        });
                        // Create a new object with updated timestamp to ensure React detects change
                        const newState = Object.assign(Object.create(Object.getPrototypeOf(updatedState)), updatedState);
                        newState._stateId = Date.now(); // Add unique identifier
                        setImportState(newState);
                    };

                    newImportState.onImportFilterChange = (updatedState) => {
                        logger.info('PhotosList', 'import_filter_changed', 'Filter changed in import mode', {
                            filter: updatedState.importFilter
                        });
                        // Create a new object with updated timestamp to ensure React detects change
                        const newState = Object.assign(Object.create(Object.getPrototypeOf(updatedState)), updatedState);
                        newState._stateId = Date.now(); // Add unique identifier
                        setImportState(newState);
                    };

                    newImportState._stateId = Date.now(); // Add initial state ID
                    setImportState(newImportState);
                }).catch((error) => {
                    logger.error('PhotosList', 'import_state_init_failed', 'Failed to initialize ImportState', {
                        error: error.message
                    });
                });
            }
        } else if (isSearchMode) {
            setTabClass({
                'directory': false,
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': true,
            });
            setShowSideMenu(true);  // Automatically open side menu in search mode
        } else {
            // For other modes, default to no active tab (or maintenance/selection as needed)
            setTabClass({
                'directory': false,
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': false,
            });
            setShowSideMenu(false);  // Close side menu for other modes

            // Clean up ImportState when leaving import mode
            if (importState && viewMode !== VIEW_MODES.IMPORT) {
                logger.info('PhotosList', 'import_mode_exited', 'Cleaning up ImportState');
                importState.cleanup();
                setImportState(null);
            }
        }
    }, [viewMode, isSearchMode, importState]);

    // Remove photo from current view (for album removal)
    const removePhotoFromList = (indexToRemove) => {
        logger.info('PhotosList', 'remove_photo_from_list', 'Removing photo from current view', {
            index: indexToRemove,
            totalPhotos: photosListMiniAllPhotos.length
        });

        // Remove from photosListMiniAllPhotos
        const newAllPhotos = [...photosListMiniAllPhotos];
        newAllPhotos.splice(indexToRemove, 1);
        setPhotosListMiniAllPhotos(newAllPhotos);

        // Also remove from allPhotosForCurrentFetch and filteredPhotos
        const removedPath = photosListMiniAllPhotos[indexToRemove]?.file?.path;
        if (removedPath) {
            const newAllPhotosForFetch = allPhotosForCurrentFetch.filter(photo => photo.originalPath !== removedPath);
            setAllPhotosForCurrentFetch(newAllPhotosForFetch);
        }

        // Adjust current index if needed
        if (indexToRemove >= newAllPhotos.length && newAllPhotos.length > 0) {
            // Last photo was removed, go to previous
            const newIndex = newAllPhotos.length - 1;
            setPhotosListMiniCurrentIndex(newIndex);
            setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
            setCurrentPhotoIndex(newIndex);
        } else if (newAllPhotos.length > 0) {
            // Stay at same index (now showing next photo)
            const newIndex = Math.min(indexToRemove, newAllPhotos.length - 1);
            setPhotosListMiniCurrentIndex(newIndex);
            setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
            setCurrentPhotoIndex(newIndex);
        } else {
            // No photos left
            closePhotoDisplay();
        }
    };

    function moveToTrashCan(f) {

        // If in trash mode, permanently delete instead of moving to trash
        if (isTrashMode) {
            permanentlyDeletePhoto(f);
            return;
        }

        invoke("move_to_trash", { pathStr: f, sortValue: parseInt(sortOfPhotos) }).then((d) => {
            if (d) {
                const date = d
                if (compatProps.dateNum[date] > 0) {
                    compatProps.dateNum[date] -= 1;
                    compatProps.setDateNum(compatProps.dateNum);
                    compatProps.setDateList(compatProps.dateList.concat());
                }

                // Always update thumbnail list when photo is deleted from current view
                if (photosListMiniAllPhotos.length > 0) {
                    const allPhotos = photosListMiniAllPhotos
                    // Create a new array instead of mutating the existing one to trigger React state update
                    const newAllPhotos = [...allPhotos];
                    newAllPhotos.splice(currentPhotoIndex, 1);
                    setPhotosListMiniAllPhotos(newAllPhotos);
                    // no photos are remaining after the deleted photo
                    // last photo
                    if (currentPhotoIndex >= newAllPhotos.length) {
                        const ci = currentPhotoIndex - 1;
                        if (newAllPhotos[ci]) {
                            setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                            setCurrentPhotoPath(newAllPhotos[ci].file.path);
                            setCurrentPhotoIndex(ci);
                        }
                    }
                    // not last photo
                    else {
                        const ci = currentPhotoIndex;
                        setPhotosListMiniReread(!photosListMiniReread);
                        setCurrentPhotoPath(newAllPhotos[ci].file.path);
                    }
                    if (newAllPhotos.length == 0) {
                        closePhotoDisplay();
                    }
                }
            }
        });
    }

    function permanentlyDeletePhoto(f) {
        invoke("delete_permanently", { pathStr: f }).then((result) => {
            logger.info('PhotosList', 'permanent_delete_success', 'Photo permanently deleted', { path: f, result });

            // Remove from trash photos list
            setTrashPhotos(prevPhotos => prevPhotos.filter(photo => photo.path !== f));

            // Update thumbnail list when photo is deleted from current view
            if (photosListMiniAllPhotos.length > 0) {
                const allPhotos = photosListMiniAllPhotos
                // Create a new array instead of mutating the existing one to trigger React state update
                const newAllPhotos = [...allPhotos];
                newAllPhotos.splice(currentPhotoIndex, 1);
                setPhotosListMiniAllPhotos(newAllPhotos);
                // no photos are remaining after the deleted photo
                // last photo
                if (currentPhotoIndex >= newAllPhotos.length) {
                    const ci = currentPhotoIndex - 1;
                    if (newAllPhotos[ci]) {
                        setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                        setCurrentPhotoPath(newAllPhotos[ci].file.path);
                        setCurrentPhotoIndex(ci);
                    }
                }
                // not last photo
                else {
                    const ci = currentPhotoIndex;
                    setPhotosListMiniReread(!photosListMiniReread);
                    setCurrentPhotoPath(newAllPhotos[ci].file.path);
                }
                if (newAllPhotos.length == 0) {
                    closePhotoDisplay();
                }
            }
        }).catch((error) => {
            logger.error('PhotosList', 'permanent_delete_error', 'Failed to permanently delete photo', { path: f, error });
        });
    }

    /**
     * Load photos using PhotoCollection (new approach)
     */
    async function loadPhotosWithCollection(viewModeObj) {
        if (!viewModeObj) {
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
            viewMode: viewModeObj.mode,
            viewModeData: viewModeObj.data,
            hasAppConfig: !!appConfig
        });

        setPhotoLoading(true);

        try {
            let collection;

            // Create appropriate PhotoCollection based on view mode
            if (viewModeObj.isDateMode()) {
                logger.info('PhotosList', 'creating_date_collection', 'Creating date collection', {
                    date: viewModeObj.getCurrentDate(),
                    sortOfPhotos: sortOfPhotos
                });
                collection = PhotoCollection.createDateCollection([], viewModeObj.getCurrentDate(), appConfig, parseInt(sortOfPhotos));
            } else if (viewModeObj.isRecentMode()) {
                logger.info('PhotosList', 'creating_recent_collection', 'Creating recent collection', {
                    sortOfPhotos: parseInt(sortOfPhotos)
                });
                collection = PhotoCollection.createRecentCollection([], appConfig, parseInt(sortOfPhotos));
            } else if (viewModeObj.isSearchMode()) {
                // For search, use searchResults if available
                collection = PhotoCollection.createSearchCollection([], viewModeObj.getSearchQuery(), appConfig, searchResults.length > 0 ? searchResults : null, parseInt(sortOfPhotos));
            } else if (viewModeObj.isImportMode()) {
                // For import mode, need to get values from importState
                if (!importState) {
                    logger.warn('PhotosList', 'import_state_missing', 'Import state not initialized, skipping photo load');
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
            } else if (viewModeObj.isTrashMode()) {
                logger.info('PhotosList', 'creating_trash_collection', 'Creating trash collection', {
                    sortOfPhotos: parseInt(sortOfPhotos)
                });
                collection = PhotoCollection.createTrashCollection([], appConfig, parseInt(sortOfPhotos));
            } else {
                logger.warn('PhotosList', 'unsupported_view_mode', 'View mode not yet supported in PhotoCollection', {
                    mode: viewModeObj.mode
                });
                // Fallback to new unified method
                return await loadAllPhotosBasedOnViewMode(viewModeObj, appConfig);
            }

            // いらんのでは？ Set config in collection metadata for Photo entity creation
            // collection = collection.withMetadata({ appConfig });

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

            // Clear photo selection and related states
            setPhotoSelection([]);
            setPhotosListImgSrc({});
            setCurrentPhotoPath("");
            setCurrentPhotoIndex(undefined);

            logger.info('PhotosList', 'load_photos_collection_success', 'Successfully loaded photos with PhotoCollection', {
                photoCount: updatedCollection.photos.length,
                hasNext: updatedCollection.metadata.hasNext
            });

        } catch (error) {
            handleError(error, 'Load photos collection', {
                viewMode: viewModeObj.mode,
                viewModeData: viewModeObj.data
            });
            // Fallback to unified method on error
            return await loadAllPhotosBasedOnViewMode(viewModeObj, appConfig);
        } finally {
            setPhotoLoading(false);
        }
    }

    async function loadAllPhotosBasedOnViewMode(viewModeObj, appConfig) {
        logger.info('PhotosList', 'load_photos_viewmode', 'loadAllPhotosBasedOnViewMode called', {
            viewMode: viewModeObj.mode,
            viewModeData: viewModeObj.data,
            hasConfig: !!appConfig
        });
        if (!viewModeObj || !appConfig) {
            logger.error("PhotosList", "error", "no viewModeObj or appConfig", {
                viewModeObj: viewModeObj,
                config: appConfig
            })
            return
        }


        // Prevent duplicate loading
        if (photoLoading) {
            logger.info('PhotosList', 'loading_already_in_progress', 'Photo loading already in progress, skipping');
            return;
        }

        // Some view modes don't require a value (e.g., search with filters only, recent)
        if (!viewModeObj.isSearchMode() && !viewModeObj.isRecentMode() && !viewModeObj.getCurrentDate() && !viewModeObj.getCurrentAlbumId() && !viewModeObj.getCurrentTagId()) return;

        logger.info('PhotosList', 'load_all_start', 'Loading all photos', {
            viewMode: viewModeObj.mode,
            viewModeData: viewModeObj.data,
            appConfig,
            isSearchMode,
            searchResultsLength: searchResults.length
        });

        // Show loading indicator
        setPhotoLoading(true);

        try {
            let result;

            logger.debug('PhotosList', 'load_all_viewmode', 'Using ViewMode to generate parameters', {
                mode: viewModeObj.mode,
                viewModeData: viewModeObj.data
            });

            try {
                // Handle special case for search mode with existing results
                if (isSearchMode && searchResults.length > 0) {
                    logger.info('PhotosList', 'using_search_results', 'Using search results from hook');
                    result = JSON.stringify({ photos: searchResults });
                } else {
                    // Generate parameters using ViewMode
                    const photoParams = viewModeObj.getUnifiedPhotoParams(appConfig, {
                        sort_value: parseInt(sortOfPhotos),
                        star: starFilter || -1,
                        has_comment: hasCommentFilter || false,
                        extension: extensionFilter || "all"
                    });
                    
                    logger.info('PhotosList', 'viewmode_params_generated', 'Generated parameters using ViewMode', {
                        mode: viewModeObj.mode,
                        params: photoParams
                    });
                    
                    result = await invoke("get_photos_unified", {
                        request: photoParams
                    });
                    
                    logger.info('PhotosList', 'viewmode_result', 'Unified get_photos result from ViewMode', {
                        resultType: typeof result,
                        hasResult: !!result,
                        mode: viewModeObj.mode
                    });
                }
            } catch (error) {
                handleError(error, `Unsupported mode ${viewModeObj.mode}`, { mode: viewModeObj.mode });
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
                viewMode: viewModeObj.mode,
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

                // Check different possible metadata locations
                if (data.photos[0].meta) {
                }
                if (data.photos[0].metadata) {
                }
            }

            // Check if we hit the configuration limit
            const effectiveLimit = appConfig?.max_photos_per_fetch || 1000;
            const isLimited = data.photos.length >= effectiveLimit && (data.has_next || data.photos.length === effectiveLimit);
            setIsLimitedByConfig(isLimited);
            setConfigLimit(effectiveLimit);

            // Store all photos unfiltered - convert to Photo entities then to JSON for React state
            logger.info('PhotosList', 'setting_photos', 'Setting allPhotosForCurrentFetch', {
                photoCount: data.photos.length,
                firstPhotoPath: data.photos[0]?.file?.path || 'no photos'
            });

            // Convert backend data to Photo entities and store directly
            const photoEntities = convertPhotosToEntities(data.photos, appConfig, false, false);
            setAllPhotosForCurrentFetch(photoEntities);
            logger.info('PhotosList', 'photos_set', 'allPhotosForCurrentFetch state updated');

            // Don't apply filters here - let the memoized filteredPhotos handle it
            // This ensures consistency between all components

            // Hide loading indicator
            setPhotoLoading(false);

        } catch (error) {
            // Reset to safe state
            setAllPhotosForCurrentFetch([]);
            setPhotosListMiniAllPhotos([]);
            setPhotosList({ photos: [], has_next: false, has_prev: false });
            setIsLimitedByConfig(false);
            setConfigLimit(null);

            // Hide loading indicator on error
            setPhotoLoading(false);

            // Use enhanced error handling
            handleError(error, 'Load photos', { appConfig });

            // Fallback footer message
            compatProps.addFooterMessage && compatProps.addFooterMessage(`Failed to load photos: ${error.message || error}`);
        }
    }

    // Initialize search parameters when in search mode (moved after function definitions)
    useEffect(() => {
        if (isSearchMode && searchQuery && !currentSearchParams) {
            updateSearchParams({
                query: searchQuery,
                searchType: "all",
                filters: searchFilters
            });
        }
    }, [isSearchMode, searchQuery, currentSearchParams, searchFilters]);

    // Perform initial search when component mounts with searchInitialQuery (moved after function definitions)
    useEffect(() => {
        if (isSearchMode && searchInitialQuery && !currentSearchParams) {
            handleSearch(searchInitialQuery, "all", {});
        }
    }, [isSearchMode, searchInitialQuery, currentSearchParams, handleSearch]);

    // Trigger photo loading when search results are available (moved after function definitions)
    useEffect(() => {
        // Only load search results if we're in search mode 
        // This prevents search results from overriding date-based loading when user switches from search to date
        if (isSearchMode && searchResults.length > 0) {
            logger.info('PhotosList', 'search_results_loading', 'Search results available, loading photos');
            const searchViewMode = new ViewMode(VIEW_MODES.SEARCH, {
                searchQuery: searchQuery,
                searchResults: searchResults
            });
            loadAllPhotosBasedOnViewMode(searchViewMode, appConfig);
        }
    }, [isSearchMode, searchResults, searchQuery]);

    function closePhotoDisplay() {
        setShowSideMenu(false);

        // Calculate the correct key for showPhotoDisplay based on current mode
        const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();

        // Use togglePhotoDisplay with the correct key
        compatProps.togglePhotoDisplay(displayKey, false);
        setCurrentPhotoPath("");

        // Cancel any existing photo loading before starting new request
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }

        const fetchPhotos = async () => getPhotos();
        fetchPhotos().catch(error => handleError(error, 'Refresh photos after closing display'))
    }

    function closeRightColumn() {
        setShowSideMenu(false);

        // Calculate the correct key for showPhotoDisplay based on current mode
        const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();

        // Use togglePhotoDisplay with the correct key
        compatProps.togglePhotoDisplay(displayKey, false);
    }

    async function getPhotos(e, isForward) {
        // For paginated display, use memoized filtered data
        if (filteredPhotos.length === 0) {
            setPhotoLoading(false);
            return;
        }

        setPhotoLoading(true);

        let date = recentPhotosMode ? "recent" : (isSearchMode ? "search_results" : viewModeObj.getDataAttribute());
        let page = compatProps.datePage[date] || 1;

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
            compatProps.datePage[date] = page;
        }

        compatProps.datePage[date] = page;
        compatProps.setDatePage(compatProps.datePage);
        setPhotoLoading(false);
        // Removed scrollLock for infinite scroll
    };

    // Component functions have been moved to separate files for better organization

    return (
        <ErrorBoundary name="PhotosList" level="component">
            <>
                {photoLoading ?
                    <div className="photoLoadingOnParent" style={{ display: photoLoading ? "block" : "none" }}>
                        <PhotoLoading />
                    </div>
                    :
                    <>
                        <div id="photos-display-wrapper" style={{
                            display: (() => {
                                const displayKey = viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute();
                                const shouldDisplay = !photoLoading && compatProps.showPhotoDisplay[displayKey] && currentPhotoPath;

                                return shouldDisplay ? "block" : "none";
                            })()
                        }}>
                            <AllPhotosContext.Provider value={{ photosListMiniAllPhotos, setPhotosListMiniAllPhotos }}>
                                <ImgCacheContext.Provider value={{ imgCacheMap, setImgCacheMap }}>
                                    <div className="photo-display">
                                        <PhotosListMini
                                            moveToTrashCan={moveToTrashCan}
                                            closePhotoDisplay={closePhotoDisplay}
                                            toggleSelection={toggleSelection}
                                            isSelected={isSelected}

                                            setShortCutNavigation={props.setShortCutNavigation}
                                            setShowPhotoDisplay={compatProps.setShowPhotoDisplay}
                                            shortCutNavigation={props.shortCutNavigation}
                                            getPhotos={getPhotos}
                                            currentPhotoPath={currentPhotoPath}
                                            setCurrentPhotoPath={setCurrentPhotoPath}
                                            sortOfPhotos={sortOfPhotos}
                                            currentDate={compatProps.currentDate}
                                            datePage={compatProps.datePage}
                                            num={numOfPhoto}
                                            currentPhotoIndex={currentPhotoIndex}
                                            setCurrentPhotoIndex={setCurrentPhotoIndex}
                                            setStar={setStarWithUpdate}
                                            hasCommentFilter={hasCommentFilter}
                                            starFilter={starFilter}
                                            extensionFilter={extensionFilter}
                                            hasNext={photos.has_next}

                                            reread={photosListMiniReread}
                                            currentIndex={photosListMiniCurrentIndex}
                                            isTrashMode={isTrashMode}
                                            config={appConfig}
                                            setCurrentIndex={setPhotosListMiniCurrentIndex}
                                            setShowSideMenu={setShowSideMenu}
                                            showSideMenu={showSideMenu}
                                            centerDisplayClass={showSideMenu ? "centerDisplay" : "centerDisplayMax"}

                                            // Search mode props
                                            searchMode={isSearchMode}
                                            searchQuery={searchQuery}
                                            onClearSearch={clearSearch}
                                            recentPhotosMode={recentPhotosMode}

                                            // Album mode props
                                            albumId={currentAlbumId}
                                            albumName={currentAlbumName}
                                            removePhotoFromList={removePhotoFromList}
                                            addFooterMessage={compatProps.addFooterMessage}
                                            handleTauriError={handleTauriError}
                                        />
                                    </div>
                                </ImgCacheContext.Provider>
                            </AllPhotosContext.Provider>
                        </div>
                        <div className={(props.showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"} id="photoList"
                            style={{ display: (!photoLoading && (!compatProps.showPhotoDisplay[viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()] || !currentPhotoPath)) ? "block" : "none" }}
                            data-date={viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()}
                            data-page={recentPhotosMode ? (compatProps.datePage["recent"] || 1) : (isSearchMode ? (compatProps.datePage["search_results"] || 1) : 1)}>
                            <div>
                                {/* List Mode (Albums or Tags) */}
                                {(viewMode === VIEW_MODES.ALBUM_LIST || isTagListMode) && (() => {
                                    const isAlbumList = viewMode === VIEW_MODES.ALBUM_LIST;
                                    const listConfig = {
                                        title: isAlbumList ? "Albums" : "Tags",
                                        count: isAlbumList ? filteredAlbums.length : filteredTags.length,
                                        itemType: isAlbumList ? "albums" : "tags",
                                        itemTypeSingular: isAlbumList ? "album" : "tag",
                                        items: isAlbumList ? filteredAlbums : filteredTags,
                                        selectedItems: isAlbumList ? selectedAlbums : selectedTags,
                                        onItemSelection: isAlbumList ? handleAlbumSelection : handleTagSelection,
                                        onItemClick: isAlbumList ? handleAlbumClick : handleTagClick,
                                        onNewItemClick: isAlbumList ? handleNewAlbumClick : handleNewTagClick,
                                        searchTerm: isAlbumList ? albumSearchTerm : tagSearchTerm,
                                        onSearchChange: isAlbumList ? setAlbumSearchTerm : setTagSearchTerm
                                    };

                                    return (
                                        <>
                                            <ListViewHeader
                                                title={listConfig.title}
                                                count={listConfig.count}
                                                itemType={listConfig.itemType}
                                                iconSize={iconSize}
                                                onIconSizeChange={setIconSize}
                                            />
                                            <GenericListView
                                                items={listConfig.items}
                                                itemType={listConfig.itemTypeSingular}
                                                iconSize={iconSize}
                                                selectedItems={listConfig.selectedItems}
                                                onItemSelection={listConfig.onItemSelection}
                                                onItemClick={listConfig.onItemClick}
                                                onNewItemClick={listConfig.onNewItemClick}
                                                searchTerm={listConfig.searchTerm}
                                                onSearchChange={listConfig.onSearchChange}
                                            />
                                        </>
                                    );
                                })()}

                                {/* Regular Photo Display Mode */}
                                {viewMode !== VIEW_MODES.ALBUM_LIST && viewMode !== VIEW_MODES.TAG_LIST && (
                                    <>
                                        {displayedPhotos.length == 0 && (
                                            <BackNavigationLink
                                                viewModeObj={viewModeObj}
                                                clearSearch={clearSearch}
                                                toggleAlbumListMode={toggleAlbumListMode}
                                                openTagsList={openTagsList}
                                                toggleHome={toggleHome}
                                            />
                                        )}
                                        {displayedPhotos.length > 0 ?
                                            <div className="photo-list-header">
                                                <StatusBar
                                                    viewMode={viewMode}
                                                    currentDate={currentDate}
                                                    currentAlbumName={currentAlbumName}
                                                    currentTagName={currentTagName}
                                                    searchQuery={searchQuery}
                                                    isSearchMode={isSearchMode}
                                                    clearSearch={clearSearch}
                                                    toggleAlbumListMode={toggleAlbumListMode}
                                                    openTagsList={openTagsList}
                                                    toggleHome={toggleHome}
                                                    filteredPhotos={filteredPhotos}
                                                    infiniteScrollEnabled={infiniteScrollEnabled}
                                                    displayedPhotoCount={displayedPhotoCount}
                                                    isLimitedByConfig={isLimitedByConfig}
                                                />
                                                {/* Removed navigation - replaced by infinite scroll */}
                                                <PhotosToolbar
                                                    iconSize={iconSize}
                                                    setIconSize={setIconSize}
                                                    sortOfPhotos={sortOfPhotos}
                                                    setSort={setSort}
                                                    showFilterPopover={showFilterPopover}
                                                    setShowFilterPopover={setShowFilterPopover}
                                                    filterButtonRef={filterButtonRef}
                                                    starFilter={starFilter}
                                                    hasCommentFilter={hasCommentFilter}
                                                    hasTagFilter={hasTagFilter}
                                                    extensionFilter={extensionFilter}
                                                    hasActiveFilters={hasActiveFiltersState}
                                                />
                                            </div>
                                            : <div>
                                                <>
                                                    <div>{viewModeObj.getEmptyStateMessage()}</div>
                                                    {renderFilterClearingUI()}
                                                </>
                                            </div>
                                        }
                                        <PhotoGrid
                                            displayedPhotos={displayedPhotos}
                                            totalPhotosCount={filteredPhotos.length}
                                            iconSize={iconSize}
                                            photoSelectionDict={photoSelectionDict}
                                            onAddSelection={addSelection}
                                            onDisplayPhoto={displayPhoto}
                                            onInfiniteScroll={handleInfiniteScroll}
                                            isLimitedByConfig={isLimitedByConfig}
                                            configLimit={configLimit}
                                            starFilter={starFilter}
                                            hasCommentFilter={hasCommentFilter}
                                            hasTagFilter={hasTagFilter}
                                            extensionFilter={extensionFilter}
                                            onClearFilters={() => {
                                                setStarFilter(0);
                                                setHasCommentFilter(false);
                                                setHasTagFilter(false);
                                                setExtensionFilter('all');
                                            }}
                                            showSideMenu={showSideMenu}
                                            setShowSideMenu={setShowSideMenu}
                                        />
                                        {/* Replaced photo grid with PhotoGrid component */}

                                        <div className="debug" style={{ display: (debugMessage == "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                                            {debugMessage}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                }
                {/* Tabs positioned independently - only show when NOT in photo display mode */}
                {(!compatProps.showPhotoDisplay || !currentPhotoPath) && (
                    <VerticalTabBar
                        viewMode={viewMode}
                        isSearchMode={isSearchMode}
                        showSideMenu={showSideMenu}
                        tabClass={tabClass}
                        changeTab={changeTab}
                        setShowSideMenu={setShowSideMenu}
                        closeRightColumn={closeRightColumn}
                    />
                )}

                {/* PhotoOption tabs - always visible in photo display mode */}
                {(compatProps.showPhotoDisplay && currentPhotoPath) && (
                    <PhotoOption
                        setShowSideMenu={setShowSideMenu}
                        showSideMenu={showSideMenu}
                        currentPhotoPath={currentPhotoPath}
                        closePhotoDisplay={closePhotoDisplay}
                        path={currentPhotoPath}

                        // Search mode props
                        searchMode={isSearchMode}
                        searchQuery={searchQuery}
                        searchResultsCount={displayedPhotos.length}
                        onClearSearch={clearSearch}
                        searchTools={props.searchTools}
                        addFooterMessage={compatProps.addFooterMessage}
                        imgCacheMap={imgCacheMap}
                        setStar={setStarWithUpdate}
                        star={star}
                        onPhotosRefresh={getPhotos}
                        onCommentUpdate={updatePhotoComment}
                        onAlbumUpdate={handleAlbumUpdate}
                        onAlbumDelete={handleAlbumDelete}
                    />
                )}

                {showSideMenu && (
                    <div className="rightMenu">
                        <div style={{ display: (!compatProps.showPhotoDisplay[viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()] || !currentPhotoPath) ? "block" : "none" }}>
                            <DirectoryMenu
                                viewModeObj={viewModeObj}
                                addFooterMessage={compatProps.addFooterMessage}
                                tabClass={tabClass}
                                setTabClass={setTabClass}
                                changeTab={changeTab}
                                currentDate={compatProps.currentDate}
                                closeRightColumn={closeRightColumn}
                                photoSelection={photoSelection}
                                clearPhotoSelection={clearPhotoSelection}
                                selectAllPhotoToSelection={selectAllPhotoToSelection}
                                dateNum={compatProps.dateNum}
                                setCurrentDateNum={compatProps.setCurrentDateNum}
                                moveToTrashCan={moveToTrashCan}
                                setStarFilter={setStarFilter}
                                setHasCommentFilter={setHasCommentFilter}
                                starFilter={starFilter}
                                setExtensionFilter={setExtensionFilter}
                                extensionFilter={extensionFilter}
                                setShowSideMenu={setShowSideMenu}

                                // Job Queue integration
                                setShowJobQueue={(show) => props.setShowJobQueueModal(show)}

                                // Search mode props
                                searchMode={isSearchMode}
                                searchTools={isSearchMode ? (
                                    <SearchTools
                                        onSearch={handleSearch}
                                        onClear={clearSearch}
                                        searchResults={searchResults}
                                        initialQuery={searchQuery}
                                        onFiltersChange={handleFiltersChange}
                                        initialFilters={searchFilters}
                                        onSearchSelect={handleSavedSearchSelect}
                                        currentSearch={currentSearchParams}
                                        filterOptions={filterOptions}
                                        onLoadFilterOptions={loadFilterOptions}
                                        isFilterOptionsLoading={isFilterOptionsLoading}
                                        isAdvancedSearchMode={isAdvancedSearchMode}
                                    />
                                ) : null}

                                // Import mode props
                                importState={importState}

                                // Album and Tag selection props
                                selectedAlbums={selectedAlbums}
                                selectedTags={selectedTags}
                                albumsList={albumsList}
                                tagsList={tagsList}
                                clearAlbumSelection={clearAlbumSelection}
                                clearTagSelection={clearTagSelection}
                                deleteSelectedAlbums={deleteSelectedAlbums}
                                deleteSelectedTags={deleteSelectedTags}
                            />
                        </div>
                    </div>
                )}
                {/* Album Creation Modal */}
                <AlbumCreationModal
                    isOpen={showAlbumCreationModal}
                    onClose={() => setShowAlbumCreationModal(false)}
                    onConfirm={createEmptyAlbum}
                    selectedPhotosCount={0}
                />

                {/* Filter Popover */}
                <FilterPopover
                    isOpen={showFilterPopover}
                    onClose={() => setShowFilterPopover(false)}
                    anchorRef={filterButtonRef}
                    starFilter={starFilter}
                    setStarFilter={setStarFilter}
                    hasCommentFilter={hasCommentFilter}
                    setHasCommentFilter={setHasCommentFilter}
                    hasTagFilter={hasTagFilter}
                    setHasTagFilter={setHasTagFilter}
                    extensionFilter={extensionFilter}
                    setExtensionFilter={setExtensionFilter}
                />
            </>
        </ErrorBoundary>
    );
}

export default PhotosList;
