import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { invoke } from "@tauri-apps/api/core";

import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useError } from "../context/ErrorContext.jsx";

import { ViewMode } from "../domain/ViewMode.js";

import { VIEW_MODES } from "../constants/viewModes.js";

import { useSearchAndFilters } from "../hooks/useSearchAndFilters.jsx";
import { usePhotoOperations } from "../hooks/usePhotoOperations.js";
import { usePhotoDataLoader } from "../hooks/usePhotoDataLoader.js";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll.js";

import { usePhotosState } from "../hooks/usePhotosState.js";
import { usePhotoSelection } from "../hooks/usePhotoSelection.js";
import { useViewModeSync, useImportStateSync } from "../hooks/useViewModeSync.js";
import { useImportModeLifecycle } from "../hooks/useImportModeLifecycle.js";
import { usePhotoDataSync } from "../hooks/usePhotoDataSync.js";
import { usePageState } from "../hooks/usePageState.js";

import { usePhotoLoader } from "../hooks/usePhotoLoader.js";
import { usePhotoDisplay } from "../hooks/usePhotoDisplay.js";
import { useTabManagement } from "../hooks/useTabManagement.js";
import { useDataSynchronization } from "../hooks/useDataSynchronization.js";
import { useSearchInitialization } from "../hooks/useSearchInitialization.js";
import { useCollectionManagement } from "../hooks/useCollectionManagement.js";
import { useSearchAndFilterManagement } from "../hooks/useSearchAndFilterManagement.jsx";
import { useTrashOperations } from "../hooks/useTrashOperations.js";
import { usePhotoListHelpers } from "../hooks/usePhotoListHelpers.js";
import { usePhotoListStateGroups } from "../hooks/usePhotoListStateGroups.js";

import PhotoDisplayWrapper from "./PhotosList/PhotoDisplayWrapper.jsx";
import PhotoListContent from "./PhotosList/PhotoListContent.jsx";
import SideMenuWrapper from "./PhotosList/SideMenuWrapper.jsx";
import PhotoLoading from "./PhotosList/PhotoLoading.jsx";
import PhotoOption from "./PhotosList/PhotoOption.jsx";

import AlbumCreationModal from "../components/AlbumCreationModal.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import FilterPopover from "../components/FilterPopover.jsx";
import VerticalTabBar from "../components/VerticalTabBar.jsx";

import { convertPhotosToEntities, convertJSONToPhotoEntities } from "../utils/PhotoProcessingUtils.js";
import { hasActiveFilters, getFilterSummary } from "../utils/UIStateUtils.js";
import { getPageIdFromViewMode, getCurrentPageSubId } from "../utils/PhotosListUtils.js";

import { logger } from "../services/LoggerService.js";

import './PhotosList.css';
import '../scrollable.css';
import '../utils/debugStorage.js'; // Initialize debug tools

function PhotosList({
    config: appConfig,
    shortCutNavigation,
    setShortCutNavigation,
    addFooterMessage,
    onRightMenuToggle,
    searchMode,
    isAdvancedSearchMode,
    setShowJobQueueModal,
    getDatesNum,
    searchTools
}) {
    const {
        dateList,
        datePage,
        updateDatePage,
        currentDate,
        updateCurrentDate,
        dateNum,
        updateDateNum,
        updateDateList,
        setCurrentDateNum,
        recentPhotosMode,
        albumsList,
        currentAlbum,
        albumPhotos,
        updateAlbumsList,
        updateCurrentAlbum,
        updateAlbumPhotos
    } = usePhoto();

    logger.debug('PhotosList', 'component_render', 'PhotosList rendering', {
        recentPhotosMode,
        currentDate
    });
    const {
        toggleSearchPage,
        searchInitialQuery,
        currentAlbumId,
        currentTagId,
        viewMode,
        openAlbum,
        toggleAlbumListMode,
        openTag,
        openTagsList,
        toggleHome,
    } = useUI();

    const { handleTauriError, addError } = useError();

    // Log viewMode changes and close filter modal
    useEffect(() => {
        logger.info('PhotosList', 'mode_change', 'View mode changed', { viewMode });
        setShowFilterPopover(false);
    }, [viewMode]);

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

    const {
        photoSelection,
        photoSelectionDict,
        togglePhotoSelection,
        isPhotoSelected,
        clearSelection: clearPhotoSelection,
        selectAllPhotos,
        setSelection,
        getSelectionStats
    } = usePhotoSelection(viewMode);

    const {
        photos, setPhotosList,
        photoCollection, setPhotoCollection,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        currentPhotoPath, setCurrentPhotoPath,
        currentPhotoIndex, setCurrentPhotoIndex,
        iconSize, setIconSize,
        numOfPhoto, setNumOfPhoto,
        showSideMenu, setShowSideMenu,
        isLimitedByConfig, setIsLimitedByConfig,
        configLimit, setConfigLimit,
        star, setStar,
        starFilter, setStarFilter,
        hasCommentFilter, setHasCommentFilter,
        hasTagFilter, setHasTagFilter,
        extensionFilter, setExtensionFilter,
        importExtensionFilter, setImportExtensionFilter,
        importSortOfPhotos, setImportSort,
        photosListMiniAllPhotos, setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex,
        photosListMiniReread, setPhotosListMiniReread,
        setPhotosListImgSrc,
        imgCacheMap, setImgCacheMap,
        thumbnailStore, setThumbnailStore,
        debugMessage,
        sortOfPhotos, setSort,
        sortInitialized,
        filterOptions, setFilterOptions,
        isFilterOptionsLoading, setIsFilterOptionsLoading,
        importState, setImportState,
        filteredAlbums, setFilteredAlbums,
        albumSearchTerm, setAlbumSearchTerm,
        currentAlbumName, setCurrentAlbumName,
        showAlbumCreationModal, setShowAlbumCreationModal,
        selectedAlbums, setSelectedAlbums,
        tagsList, setTagsList,
        filteredTags, setFilteredTags,
        tagSearchTerm, setTagSearchTerm,
        currentTagName, setCurrentTagName,
        tagPhotos, setTagPhotos,
        trashPhotos, setTrashPhotos,
        selectedTags, setSelectedTags,
        showFilterPopover, setShowFilterPopover,
        filterButtonRef
    } = usePhotosState();

    const { savePageState, loadPageState } = usePageState();

    // Create ViewMode object from global state
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

    const isSearchMode = viewModeObj.isSearchMode();
    const isAlbumMode = viewModeObj.isAlbumMode();
    const isAlbumListMode = viewModeObj.isAlbumListMode();
    const isTagMode = viewModeObj.isTagMode();
    const isTagListMode = viewModeObj.isTagListMode();
    const isTrashMode = viewModeObj.isTrashMode();

    const convertPhotosWithConfig = useCallback((photosData, isFromTrash = false, toJSON = true) => {
        return convertPhotosToEntities(photosData, appConfig, isFromTrash, toJSON);
    }, [appConfig]);

    const handleError = useCallback((error, operation, context = {}) => {
        const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
        const logContext = {
            error: errorMessage,
            errorType: typeof error,
            ...context
        };

        logger.error('PhotosList', `${operation.toLowerCase().replace(/\s+/g, '_')}_failed`,
            `Failed to ${operation.toLowerCase()}`, logContext);

        handleTauriError(error, operation);
    }, [handleTauriError]);

    const {
        loadUnifiedData,
        loadAlbums,
        loadAlbumPhotos: loadAlbumPhotosOriginal,
        handleAlbumClick: handleAlbumClickOriginal,
        loadTags,
        loadTagPhotos: loadTagPhotosOriginal,
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

    const hasActiveFiltersState = useMemo(() => {
        return hasActiveFilters({ starFilter, hasCommentFilter, hasTagFilter, extensionFilter });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    const getFilterSummaryText = useMemo(() => {
        return getFilterSummary({ starFilter, hasCommentFilter, hasTagFilter, extensionFilter });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    const {
        handleSearch,
        clearSearch,
        handleSavedSearchSelect,
        handleFiltersChange,
        clearAllFilters,
        applyFiltersWithConfig,
        renderFilterClearingUI
    } = useSearchAndFilterManagement({
        viewModeObj,
        isSearchMode,
        searchQuery,
        searchInitialQuery,
        currentSearchParams,
        searchResults,
        sortOfPhotos,
        starFilter,
        hasCommentFilter,
        hasTagFilter,
        extensionFilter,
        importExtensionFilter,
        setStarFilter,
        setHasCommentFilter,
        setHasTagFilter,
        setExtensionFilter,
        setImportExtensionFilter,
        performSearch,
        updateSearchParams,
        clearSearchHook,
        toggleSearchPage,
        hasActiveFiltersState,
        getFilterSummaryText
    });

    // Use filtered photos based on current view mode (must be before usePhotoLoader)
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
        let result = applyFiltersWithConfig(photosWithMethods);

        // Apply frontend sorting for import mode
        if (viewModeObj.isImportMode()) {
            const sortComparator = {
                2: (a, b) => {
                    // Added Time (desc) - newest first
                    const aTime = a.created_at || '';
                    const bTime = b.created_at || '';
                    return bTime.localeCompare(aTime);
                },
                3: (a, b) => {
                    // Added Time (asc) - oldest first
                    const aTime = a.created_at || '';
                    const bTime = b.created_at || '';
                    return aTime.localeCompare(bTime);
                },
                6: (a, b) => {
                    // File Name (desc) - Z→A
                    return (b.name || '').localeCompare(a.name || '');
                },
                7: (a, b) => {
                    // File Name (asc) - A→Z
                    return (a.name || '').localeCompare(b.name || '');
                }
            }[importSortOfPhotos];

            if (sortComparator) {
                result = [...result].sort(sortComparator);
                logger.debug('PhotosList', 'import_photos_sorted', 'Applied frontend sort to import photos', {
                    sortValue: importSortOfPhotos,
                    photoCount: result.length
                });
            }
        }

        logger.debug('PhotosList', 'filtered_photos_result', 'Filtering completed', {
            inputCount: sourcePhotos.length,
            outputCount: result.length,
            resultType: result.length > 0 ? typeof result[0] : 'empty'
        });

        return result;
    }, [viewModeObj, albumPhotos, tagPhotos, photoCollection?.photos, allPhotosForCurrentFetch, applyFiltersWithConfig, importSortOfPhotos, sortOfPhotos]);

    // Use photo loader hook (Phase 1 refactoring) - Must be before usePhotoDisplay
    const {
        photoLoading,
        setPhotoLoading,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,
        getPhotos,
        loadAllPhotosBasedOnViewMode,
        loadPhotosWithCollection
    } = usePhotoLoader({
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
        convertPhotosToEntities: convertPhotosWithConfig,
        handleError,
        datePage: datePage || {},
        updateDatePage: updateDatePage,
        addFooterMessage: addFooterMessage
    });

    // Wrap album photo loading with loading state management
    const loadAlbumPhotos = useCallback(async (albumId) => {
        setPhotoLoading(true);
        try {
            await loadAlbumPhotosOriginal(albumId);
        } finally {
            setPhotoLoading(false);
        }
    }, [loadAlbumPhotosOriginal, setPhotoLoading]);

    const handleAlbumClick = useCallback((album) => {
        handleAlbumClickOriginal(album);
    }, [handleAlbumClickOriginal]);

    // Wrap tag photo loading with loading state management
    const loadTagPhotos = useCallback(async (tagId) => {
        setPhotoLoading(true);
        try {
            await loadTagPhotosOriginal(tagId);
        } finally {
            setPhotoLoading(false);
        }
    }, [loadTagPhotosOriginal, setPhotoLoading]);

    // Use photo display management hook (Phase 4) - Must be before usePhotoOperations
    const {
        displayPhoto,
        closePhotoDisplay,
        closeRightColumn
    } = usePhotoDisplay({
        photosListMiniAllPhotos,
        viewModeObj,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setPhotosListMiniCurrentIndex,
        setPhotosListMiniReread,
        setShowSideMenu,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,
        handleError,
        getPhotos,
        photosListMiniReread
    });

    const {
        handleAddToAlbum,
        removePhotoFromAlbum,
        deletePhoto,
        restorePhoto,
        permanentlyDeletePhoto,
        moveToTrash,
        handleAlbumSelection,
        clearAlbumSelection,
        deleteSelectedAlbums,
        handleAlbumDelete,
        handleTagSelection,
        clearTagSelection,
        deleteSelectedTags,
        removePhotoFromList
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
        addFooterMessage: addFooterMessage,
        loadAlbums,
        loadTags,
        currentAlbumId,
        toggleAlbumListMode,
        isTrashMode,
        // Photo list state
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        currentPhotoIndex,
        closePhotoDisplay,
        // Trash operations state
        setTrashPhotos,
        setPhotosListMiniReread,
        photosListMiniReread,
        // Date state
        dateNum,
        setDateNum: updateDateNum,
        dateList,
        setDateList: updateDateList,
        sortOfPhotos
    });

    useEffect(() => {
        if (viewModeObj) {
            setShowSideMenu(viewModeObj.shouldShowSideMenuByDefault());
        }
    }, [viewModeObj, setShowSideMenu]);

    // Reload photos when sort changes (for non-import modes)
    // Import mode sorting is handled in filteredPhotos useMemo
    useEffect(() => {
        if (!viewModeObj || !appConfig || !sortInitialized.current) return;

        // For import mode, sorting is done in frontend via filteredPhotos useMemo
        if (viewModeObj.isImportMode()) {
            logger.debug('PhotosList', 'sort_change_import', 'Import mode: sorting handled by filteredPhotos useMemo', {
                importSortOfPhotos
            });
            return;
        }

        // For other modes, need to re-fetch from backend with new sort value
        logger.info('PhotosList', 'sort_change_reload', 'Sort changed, reloading photos from backend', {
            viewMode: viewModeObj.mode,
            sortOfPhotos
        });

        loadAllPhotosBasedOnViewMode(viewModeObj, appConfig).catch(error => {
            handleError(error, 'Reload photos after sort change');
        });
    }, [sortOfPhotos, viewModeObj, appConfig, importSortOfPhotos, loadAllPhotosBasedOnViewMode, handleError]);

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

    const {
        handleTagClick,
        handleNewTagClick,
        handleNewAlbumClick,
        createEmptyAlbum,
        modeLoaders
    } = useCollectionManagement({
        appConfig,
        viewMode,
        currentAlbumId,
        currentTagId,
        albumsList,
        tagsList,
        albumSearchTerm,
        tagSearchTerm,
        sortOfPhotos,
        setCurrentAlbumName,
        setCurrentTagName,
        setFilteredAlbums,
        setFilteredTags,
        setShowAlbumCreationModal,
        setPhotoCollection,
        loadAlbums,
        loadAlbumPhotos,
        loadTags,
        loadTagPhotos,
        openTag,
        openAlbum,
        logOperation,
        handleError
    });

    const {
        tabClass,
        setTabClass,
        changeTab
    } = useTabManagement({
        viewMode,
        isSearchMode
    });

    // Auto-open Selection tab when items are selected (Feature #152)
    const prevSelectionCount = useRef(0);
    useEffect(() => {
        const totalSelectionCount = photoSelection.length + selectedAlbums.length + selectedTags.length;

        // Auto-open Selection tab when selection goes from 0 to 1+
        if (prevSelectionCount.current === 0 && totalSelectionCount > 0) {
            changeTab(undefined, "#tab-selection");
            setShowSideMenu(true);
            logger.info('PhotosList', 'auto_open_selection_tab', 'Auto-opening Selection tab', {
                photoCount: photoSelection.length,
                albumCount: selectedAlbums.length,
                tagCount: selectedTags.length
            });
        }
        prevSelectionCount.current = totalSelectionCount;
    }, [photoSelection.length, selectedAlbums.length, selectedTags.length, changeTab, setShowSideMenu]);

    const {
        reloadCurrentModeData,
        updatePhotosAfterTrashOperation
    } = useDataSynchronization({
        modeLoaders,
        viewMode,
        getDatesNum: getDatesNum,
        photoCollection,
        setPhotoCollection
    });

    useSearchInitialization({
        isSearchMode,
        isAdvancedSearchMode,
        searchQuery,
        searchInitialQuery,
        currentSearchParams,
        searchFilters,
        updateSearchParams,
        handleSearch,
        filterOptions,
        isFilterOptionsLoading,
        loadFilterOptions
    });

    const {
        deletePhotos: deletePhotosHandler,
        restorePhotos: restorePhotosHandler
    } = useTrashOperations({
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        photoSelection,
        clearPhotoSelection,
        dateNum,
        updateDateNum,
        dateList,
        updateDateList,
        reloadCurrentModeData,
        updatePhotosAfterTrashOperation,
        handleError,
        addFooterMessage
    });

    const {
        setStarWithUpdate,
        updatePhotoComment,
        handleAlbumUpdate,
        addSelection,
        toggleSelection,
        selectAllPhotoToSelection
    } = usePhotoListHelpers({
        setStar,
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        currentPhotoPath,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        viewMode,
        loadAlbums,
        currentAlbumId,
        loadAlbumPhotos,
        photoSelectionDict,
        togglePhotoSelection,
        changeTab,
        infiniteScrollEnabled,
        displayedPhotos,
        filteredPhotos,
        selectAllPhotos
    });

    useEffect(() => {
        if (onRightMenuToggle) {
            onRightMenuToggle(showSideMenu);
        }
    }, [showSideMenu, onRightMenuToggle]);

    useEffect(() => {
        if (!isSearchMode && showSideMenu) {
            // Only close if we were previously in search mode
            setShowSideMenu(false);
        }
    }, [isSearchMode]);


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
    }, [appConfig, iconSize, currentPhotoLoadingController])

    useViewModeSync({
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
        appConfig,
        sortOfPhotos
    });

    useImportStateSync({
        viewMode,
        importState,
        loadPhotosWithCollection
    });

    usePhotoDataSync({
        filteredPhotos,
        displayedPhotos,
        allPhotosForCurrentFetch,
        infiniteScrollEnabled,
        setPhotosListMiniAllPhotos,
        setDisplayedPhotoCount,
        setPhotosList
    });


    useImportModeLifecycle({
        viewMode,
        isSearchMode,
        importState,
        setImportState,
        setTabClass,
        setShowSideMenu,
        setAllPhotosForCurrentFetch,
        setPhotosListMiniAllPhotos,
        setPhotosList
    });


    // Alias for backward compatibility with existing code
    const moveToTrashCan = (photoPath) => moveToTrash(photoPath, parseInt(sortOfPhotos));



    // State groups created by usePhotoListStateGroups hook
    const {
        viewState,
        filterState,
        selectionState,
        displayState,
        searchState,
        photoDataState,
        photoListMiniState,
        cacheState,
        navigationState,
        configState,
        listState
    } = usePhotoListStateGroups({
        viewMode, currentDate, viewModeObj,
        starFilter, hasCommentFilter, hasTagFilter, extensionFilter, importExtensionFilter, showFilterPopover, hasActiveFiltersState,
        photoSelectionDict, photoSelection, selectedAlbums, selectedTags,
        currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos, importSortOfPhotos, datePage, numOfPhoto,
        searchQuery, searchFilters, searchResults, currentSearchParams,
        displayedPhotos, filteredPhotos, displayedPhotoCount, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        photosListMiniAllPhotos, setPhotosListMiniAllPhotos, photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex, photosListMiniReread, setPhotosListMiniReread,
        imgCacheMap, setImgCacheMap, thumbnailStore, setThumbnailStore,
        shortCutNavigation, setShortCutNavigation,
        appConfig, importState, photos,
        filteredAlbums, albumSearchTerm, filteredTags, tagSearchTerm
    });

    const handlers = useMemo(() => ({
        closePhotoDisplay,
        displayPhoto,
        toggleSelection,
        isSelected: isPhotoSelected,
        addSelection,
        clearPhotoSelection,
        selectAllPhotoToSelection,
        getPhotos,
        loadMorePhotos: handleInfiniteScroll,
        reloadCurrentModeData,
        moveToTrashCan,
        updatePhotosAfterTrashOperation,
        deletePhotos: deletePhotosHandler,
        restorePhotos: restorePhotosHandler,
        permanentlyDeletePhoto,
        setStarWithUpdate,
        updatePhotoComment,
        removePhotoFromList,
        handleAlbumClick,
        handleAlbumSelection,
        handleNewAlbumClick,
        handleAlbumUpdate,
        handleAlbumDelete,
        clearAlbumSelection,
        deleteSelectedAlbums,
        handleTagClick,
        handleTagSelection,
        handleNewTagClick,
        clearTagSelection,
        deleteSelectedTags,
        handleSearch,
        clearSearch,
        handleFiltersChange,
        handleSavedSearchSelect,
        clearAllFilters,
        setShowSideMenu,
        setIconSize,
        setSort,
        setImportSort,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setShowFilterPopover,
        setAlbumSearchTerm,
        setTagSearchTerm,
        changeTab,
        closeRightColumn,
        toggleAlbumListMode,
        openTagsList,
        toggleHome,
        addFooterMessage,
        handleTauriError
    }), [
        closePhotoDisplay, displayPhoto,
        toggleSelection, isPhotoSelected, addSelection, clearPhotoSelection, selectAllPhotoToSelection,
        getPhotos, handleInfiniteScroll, reloadCurrentModeData,
        moveToTrashCan, updatePhotosAfterTrashOperation, deletePhotosHandler, restorePhotosHandler,
        permanentlyDeletePhoto,
        setStarWithUpdate, updatePhotoComment, removePhotoFromList,
        handleAlbumClick, handleAlbumSelection, handleNewAlbumClick, handleAlbumUpdate, handleAlbumDelete, clearAlbumSelection, deleteSelectedAlbums,
        handleTagClick, handleTagSelection, handleNewTagClick, clearTagSelection, deleteSelectedTags,
        handleSearch, clearSearch, handleFiltersChange, handleSavedSearchSelect,
        clearAllFilters,
        setShowSideMenu, setIconSize, setSort, setImportSort, setCurrentPhotoPath, setCurrentPhotoIndex, setShowFilterPopover, setAlbumSearchTerm, setTagSearchTerm,
        changeTab, closeRightColumn, toggleAlbumListMode, openTagsList, toggleHome,
        addFooterMessage, handleTauriError
    ]);

    // Auto-close photo display when switching to list modes (Albums, Tags, etc.)
    useEffect(() => {
        // Close photo display when switching to modes that show lists instead of photos
        if (viewMode === VIEW_MODES.ALBUM_LIST || viewMode === VIEW_MODES.TAG_LIST || viewMode === VIEW_MODES.HOME) {
            if (currentPhotoPath) {
                logger.info('PhotosList', 'auto_close_photo_display', 'Auto-closing photo display for list mode', { viewMode });
                closePhotoDisplay();
            }
        }
    }, [viewMode, currentPhotoPath, closePhotoDisplay]);

    // localStorage Integration temporarily disabled - See issue for state override bugs

    return (
        <ErrorBoundary name="PhotosList" level="component">
            <>
                {photoLoading ?
                    <div className="photoLoadingOnParent" style={{ display: photoLoading ? "block" : "none" }}>
                        <PhotoLoading />
                    </div>
                    :
                    <>
                        <PhotoDisplayWrapper
                            photoLoading={photoLoading}
                            viewState={viewState}
                            filterState={filterState}
                            displayState={displayState}
                            searchState={searchState}
                            handlers={handlers}
                            photoListMiniState={photoListMiniState}
                            cacheState={cacheState}
                            navigationState={navigationState}
                            configState={configState}
                        />
                        <PhotoListContent
                            photoLoading={photoLoading}
                            viewState={viewState}
                            filterState={filterState}
                            selectionState={selectionState}
                            displayState={displayState}
                            searchState={searchState}
                            photoDataState={photoDataState}
                            handlers={handlers}
                            listState={listState}
                            configState={configState}
                            isLimitedByConfig={isLimitedByConfig}
                            configLimit={configLimit}
                            debugMessage={debugMessage}
                            infiniteScrollEnabled={infiniteScrollEnabled}
                            renderFilterClearingUI={renderFilterClearingUI}
                            filterButtonRef={filterButtonRef}
                        />
                    </>
                }
                {/* Tabs positioned independently - only show when NOT in photo display mode */}
                {!currentPhotoPath && (
                    <VerticalTabBar
                        viewMode={viewMode}
                        isSearchMode={isSearchMode}
                        showSideMenu={showSideMenu}
                        tabClass={tabClass}
                        changeTab={changeTab}
                        setShowSideMenu={setShowSideMenu}
                        closeRightColumn={closeRightColumn}
                        viewModeObj={viewModeObj}
                        photoSelectionCount={photoSelection.length}
                        selectedAlbumsCount={selectedAlbums.length}
                        selectedTagsCount={selectedTags.length}
                    />
                )}

                {/* PhotoOption tabs - always visible in photo display mode */}
                {currentPhotoPath && (
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
                        searchTools={searchTools}
                        addFooterMessage={handlers.addFooterMessage}
                        imgCacheMap={imgCacheMap}
                        setStar={setStarWithUpdate}
                        star={star}
                        onPhotosRefresh={getPhotos}
                        onCommentUpdate={updatePhotoComment}
                        onAlbumUpdate={handleAlbumUpdate}
                        onAlbumDelete={handleAlbumDelete}

                        // Mode flags for PhotoInfo/PhotoOption
                        isImportMode={viewModeObj.isImportMode()}
                        isTrashMode={viewModeObj.isTrashMode()}

                        // Selection tab props (Feature #153)
                        viewModeObj={viewModeObj}
                        photoSelection={photoSelection}
                        selectedAlbums={selectedAlbums}
                        selectedTags={selectedTags}
                        selectAllPhotoToSelection={selectAllPhotoToSelection}
                        clearPhotoSelection={clearPhotoSelection}
                        deleteSelectedAlbums={deleteSelectedAlbums}
                        clearAlbumSelection={clearAlbumSelection}
                        deleteSelectedTags={deleteSelectedTags}
                        clearTagSelection={clearTagSelection}
                        importState={importState}
                        albumsList={albumsList}
                        tagsList={tagsList}
                    />
                )}

                <SideMenuWrapper
                    viewState={viewState}
                    filterState={filterState}
                    selectionState={selectionState}
                    displayState={displayState}
                    searchState={searchState}
                    photoDataState={photoDataState}
                    handlers={handlers}
                    tabClass={tabClass}
                    setTabClass={setTabClass}
                    dateNum={dateNum || {}}
                    updateDateNum={updateDateNum}
                    dateList={dateList || []}
                    updateDateList={updateDateList}
                    setShowJobQueueModal={setShowJobQueueModal}
                    filterOptions={filterOptions}
                    loadFilterOptions={loadFilterOptions}
                    isFilterOptionsLoading={isFilterOptionsLoading}
                    importState={importState}
                    albumsList={albumsList}
                    tagsList={tagsList}
                />
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
                    extensionFilter={viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter}
                    setExtensionFilter={viewModeObj.isImportMode() ? setImportExtensionFilter : setExtensionFilter}
                    isImportMode={viewModeObj.isImportMode()}
                />
            </>
        </ErrorBoundary>
    );
}

export default PhotosList;
