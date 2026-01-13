import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { invoke } from "@tauri-apps/api/core";

import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useError } from "../context/ErrorContext.jsx";

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
import { useViewModeFactory } from "../hooks/useViewModeFactory.js";
import { useFilteredPhotos } from "../hooks/useFilteredPhotos.js";
import { usePhotosListHandlers } from "../hooks/usePhotosListHandlers.js";
import {
    useViewModeChangeEffect,
    usePhotoSyncEffect,
    useSelectionTabEffect,
    useSortChangeEffect,
    useAutoClosePhotoDisplayEffect,
    useConfigAndCleanupEffect,
    useSideMenuToggleEffect,
    useViewModeSideMenuEffect
} from "../hooks/usePhotosListEffects.js";

import PhotoDisplayWrapper from "./PhotosList/PhotoDisplayWrapper.jsx";
import PhotoListContent from "./PhotosList/PhotoListContent.jsx";
import SideMenuWrapper from "./PhotosList/SideMenuWrapper.jsx";
import PhotoLoading from "./PhotosList/PhotoLoading.jsx";
import PhotoOption from "./PhotosList/PhotoOption.jsx";

import AlbumCreationModal from "../components/AlbumCreationModal.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import FilterPopover from "../components/FilterPopover.jsx";
import VerticalTabBar from "../components/VerticalTabBar.jsx";

import { convertPhotosToEntities } from "../utils/PhotoProcessingUtils.js";
import { hasActiveFilters, getFilterSummary } from "../utils/UIStateUtils.js";

import { logger } from "../services/LoggerService.js";

import './PhotosList.css';
import '../scrollable.css';
import '../utils/debugStorage.js';

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
    // Context hooks
    const {
        dateList, datePage, updateDatePage, currentDate, updateCurrentDate,
        dateNum, updateDateNum, updateDateList, setCurrentDateNum,
        recentPhotosMode, albumsList, currentAlbum, albumPhotos,
        updateAlbumsList, updateCurrentAlbum, updateAlbumPhotos
    } = usePhoto();

    const {
        toggleSearchPage, searchInitialQuery, currentAlbumId, currentTagId,
        viewMode, openAlbum, toggleAlbumListMode, openTag, openTagsList, toggleHome
    } = useUI();

    const { handleTauriError, addError } = useError();

    // Search and filters
    const {
        searchFilters, setSearchFilters, currentSearchParams, setCurrentSearchParams,
        searchResults, searchQuery, isSearching, performSearch,
        clearSearch: clearSearchHook, clearAllSearchFilters, updateSearchParams, executeSearch
    } = useSearchAndFilters();

    // Photo selection
    const {
        photoSelection, photoSelectionDict, togglePhotoSelection, isPhotoSelected,
        clearSelection: clearPhotoSelection, selectAllPhotos, setSelection, getSelectionStats
    } = usePhotoSelection(viewMode);

    // Photos state
    const {
        photos, setPhotosList, photoCollection, setPhotoCollection,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        currentPhotoPath, setCurrentPhotoPath, currentPhotoIndex, setCurrentPhotoIndex,
        iconSize, setIconSize, numOfPhoto, setNumOfPhoto,
        showSideMenu, setShowSideMenu, isLimitedByConfig, setIsLimitedByConfig,
        configLimit, setConfigLimit, star, setStar,
        starFilter, setStarFilter, hasCommentFilter, setHasCommentFilter,
        hasTagFilter, setHasTagFilter, extensionFilter, setExtensionFilter,
        importExtensionFilter, setImportExtensionFilter,
        importSortOfPhotos, setImportSort,
        photosListMiniAllPhotos, setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex,
        photosListMiniReread, setPhotosListMiniReread, setPhotosListImgSrc,
        imgCacheMap, setImgCacheMap, thumbnailStore, setThumbnailStore,
        debugMessage, sortOfPhotos, setSort, sortInitialized,
        filterOptions, setFilterOptions, isFilterOptionsLoading, setIsFilterOptionsLoading,
        importState, setImportState, filteredAlbums, setFilteredAlbums,
        albumSearchTerm, setAlbumSearchTerm, currentAlbumName, setCurrentAlbumName,
        showAlbumCreationModal, setShowAlbumCreationModal, selectedAlbums, setSelectedAlbums,
        tagsList, setTagsList, filteredTags, setFilteredTags,
        tagSearchTerm, setTagSearchTerm, currentTagName, setCurrentTagName,
        tagPhotos, setTagPhotos, trashPhotos, setTrashPhotos,
        selectedTags, setSelectedTags, showFilterPopover, setShowFilterPopover,
        filterButtonRef
    } = usePhotosState();

    const { savePageState, loadPageState } = usePageState();

    // Create ViewMode object using factory hook
    const { viewModeObj, isSearchMode, isAlbumMode, isAlbumListMode, isTagMode, isTagListMode, isTrashMode } = useViewModeFactory({
        viewMode, currentAlbumId, currentAlbumName, currentTagId, currentTagName, searchInitialQuery, currentDate
    });

    // View mode change effect
    useViewModeChangeEffect({ viewMode, setShowFilterPopover });

    // Photo conversion helper
    const convertPhotosWithConfig = useCallback((photosData, isFromTrash = false, toJSON = true) => {
        return convertPhotosToEntities(photosData, appConfig, isFromTrash, toJSON);
    }, [appConfig]);

    // Error handler
    const handleError = useCallback((error, operation, context = {}) => {
        const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
        logger.error('PhotosList', `${operation.toLowerCase().replace(/\s+/g, '_')}_failed`,
            `Failed to ${operation.toLowerCase()}`, { error: errorMessage, ...context });
        handleTauriError(error, operation);
    }, [handleTauriError]);

    // Photo data loader
    const {
        loadUnifiedData, loadAlbums,
        loadAlbumPhotos: loadAlbumPhotosOriginal,
        handleAlbumClick: handleAlbumClickOriginal,
        loadTags, loadTagPhotos: loadTagPhotosOriginal,
        loadTrashPhotos, loadFilterOptions, logOperation
    } = usePhotoDataLoader({
        handleError, convertPhotosToEntities: convertPhotosWithConfig,
        updateAlbumsList, setFilteredAlbums, updateAlbumPhotos, setPhotosList,
        setTagsList, setFilteredTags, setTagPhotos, setTrashPhotos, setCurrentAlbumName,
        openAlbum, setFilterOptions, setIsFilterOptionsLoading,
        filterOptions, isFilterOptionsLoading, appConfig
    });

    // Filter state computations
    const hasActiveFiltersState = useMemo(() => {
        return hasActiveFilters({ starFilter, hasCommentFilter, hasTagFilter, extensionFilter });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    const getFilterSummaryText = useMemo(() => {
        return getFilterSummary({ starFilter, hasCommentFilter, hasTagFilter, extensionFilter });
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    // Search and filter management
    const {
        handleSearch, clearSearch, handleSavedSearchSelect, handleFiltersChange,
        clearAllFilters, applyFiltersWithConfig, renderFilterClearingUI
    } = useSearchAndFilterManagement({
        viewModeObj, isSearchMode, searchQuery, searchInitialQuery,
        currentSearchParams, searchResults, sortOfPhotos,
        starFilter, hasCommentFilter, hasTagFilter, extensionFilter, importExtensionFilter,
        setStarFilter, setHasCommentFilter, setHasTagFilter, setExtensionFilter, setImportExtensionFilter,
        performSearch, updateSearchParams, clearSearchHook, toggleSearchPage,
        hasActiveFiltersState, getFilterSummaryText
    });

    // Filtered photos using extracted hook
    const filteredPhotos = useFilteredPhotos({
        viewModeObj, albumPhotos, tagPhotos, photoCollection,
        allPhotosForCurrentFetch, applyFiltersWithConfig,
        importSortOfPhotos, sortOfPhotos, appConfig
    });

    // Photo loader hook
    const {
        photoLoading, setPhotoLoading,
        currentPhotoLoadingController, setCurrentPhotoLoadingController,
        getPhotos, loadAllPhotosBasedOnViewMode, loadPhotosWithCollection
    } = usePhotoLoader({
        viewModeObj, appConfig, sortOfPhotos, starFilter, hasCommentFilter,
        extensionFilter, filteredPhotos, numOfPhoto, recentPhotosMode, isSearchMode,
        searchResults, importState, setPhotosList, setAllPhotosForCurrentFetch,
        setIsLimitedByConfig, setConfigLimit, setPhotosListMiniAllPhotos,
        setPhotoCollection, setPhotosListImgSrc, setCurrentPhotoPath, setCurrentPhotoIndex,
        convertPhotosToEntities: convertPhotosWithConfig, handleError,
        datePage: datePage || {}, updateDatePage, addFooterMessage
    });

    // Album/Tag photo loading wrappers
    const loadAlbumPhotos = useCallback(async (albumId) => {
        setPhotoLoading(true);
        try { await loadAlbumPhotosOriginal(albumId); }
        finally { setPhotoLoading(false); }
    }, [loadAlbumPhotosOriginal, setPhotoLoading]);

    const handleAlbumClick = useCallback((album) => {
        handleAlbumClickOriginal(album);
    }, [handleAlbumClickOriginal]);

    const loadTagPhotos = useCallback(async (tagId) => {
        setPhotoLoading(true);
        try { await loadTagPhotosOriginal(tagId); }
        finally { setPhotoLoading(false); }
    }, [loadTagPhotosOriginal, setPhotoLoading]);

    // Photo sync effect
    usePhotoSyncEffect({
        viewModeObj, allPhotosForCurrentFetch, updateAlbumPhotos, setTagPhotos
    });

    // Refresh photos helper
    const refreshPhotosOnly = useCallback(async () => {
        logger.info('PhotosList', 'refresh_photos_only', 'Refreshing photos silently', { viewMode });
        await loadAllPhotosBasedOnViewMode(viewModeObj, appConfig, true);
    }, [loadAllPhotosBasedOnViewMode, viewModeObj, appConfig, viewMode]);

    // Photo display hook
    const { displayPhoto, closePhotoDisplay, closeRightColumn } = usePhotoDisplay({
        photosListMiniAllPhotos, viewModeObj, setCurrentPhotoPath, setCurrentPhotoIndex,
        setPhotosListMiniCurrentIndex, setPhotosListMiniReread, setShowSideMenu,
        currentPhotoLoadingController, setCurrentPhotoLoadingController,
        handleError, refreshPhotos: refreshPhotosOnly, photosListMiniReread
    });

    // Photo operations hook
    const {
        handleAddToAlbum, removePhotoFromAlbum, deletePhoto, restorePhoto,
        permanentlyDeletePhoto, moveToTrash, handleAlbumSelection, clearAlbumSelection,
        deleteSelectedAlbums, handleAlbumDelete, handleTagSelection, clearTagSelection,
        deleteSelectedTags, removePhotoFromList
    } = usePhotoOperations({
        selectedAlbums, setSelectedAlbums, selectedTags, setSelectedTags,
        tagsList, albumsList, appConfig, currentViewMode: viewMode,
        currentDate, currentAlbumName, currentTagName, searchQuery, handleError,
        addFooterMessage, loadAlbums, loadTags, currentAlbumId, toggleAlbumListMode,
        isTrashMode, photosListMiniAllPhotos, setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex,
        setCurrentPhotoPath, setCurrentPhotoIndex, currentPhotoIndex, closePhotoDisplay,
        setTrashPhotos, setPhotosListMiniReread, photosListMiniReread,
        dateNum, setDateNum: updateDateNum, dateList, setDateList: updateDateList, sortOfPhotos
    });

    // Side menu visibility effect
    useViewModeSideMenuEffect({ viewModeObj, setShowSideMenu });

    // Sort change effect
    useSortChangeEffect({
        sortOfPhotos, importSortOfPhotos, viewModeObj, appConfig,
        sortInitialized, loadAllPhotosBasedOnViewMode, handleError
    });

    // Infinite scroll
    const {
        infiniteScrollEnabled, displayedPhotoCount, setDisplayedPhotoCount,
        displayedPhotos, hasMorePhotos, loadMorePhotos, handleInfiniteScroll
    } = useInfiniteScroll(filteredPhotos);

    // Collection management
    const {
        handleTagClick, handleNewTagClick, handleNewAlbumClick, createEmptyAlbum, modeLoaders
    } = useCollectionManagement({
        appConfig, viewMode, currentAlbumId, currentTagId, albumsList, tagsList,
        albumSearchTerm, tagSearchTerm, sortOfPhotos, setCurrentAlbumName, setCurrentTagName,
        setFilteredAlbums, setFilteredTags, setShowAlbumCreationModal, setPhotoCollection,
        loadAlbums, loadAlbumPhotos, loadTags, loadTagPhotos,
        openTag, openAlbum, logOperation, handleError
    });

    // Tab management
    const { tabClass, setTabClass, changeTab, clearAllTabs } = useTabManagement({ viewMode, isSearchMode });

    // Selection tab auto-open effect
    useSelectionTabEffect({
        photoSelection, selectedAlbums, selectedTags, changeTab, setShowSideMenu
    });

    // Data synchronization
    const { reloadCurrentModeData, updatePhotosAfterTrashOperation } = useDataSynchronization({
        modeLoaders, viewMode, getDatesNum, photoCollection, setPhotoCollection
    });

    // Search initialization
    useSearchInitialization({
        isSearchMode, isAdvancedSearchMode, searchQuery, searchInitialQuery,
        currentSearchParams, searchFilters, updateSearchParams, handleSearch,
        filterOptions, isFilterOptionsLoading, loadFilterOptions
    });

    // Trash operations
    const { deletePhotos: deletePhotosHandler, restorePhotos: restorePhotosHandler } = useTrashOperations({
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch, photoSelection,
        clearPhotoSelection, dateNum, updateDateNum, dateList, updateDateList,
        reloadCurrentModeData, updatePhotosAfterTrashOperation, handleError, addFooterMessage
    });

    // Photo list helpers
    const {
        setStarWithUpdate, updatePhotoComment, handleAlbumUpdate,
        addSelection, toggleSelection, selectAllPhotoToSelection
    } = usePhotoListHelpers({
        setStar, photosListMiniAllPhotos, setPhotosListMiniAllPhotos, currentPhotoPath,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch, viewMode,
        loadAlbums, currentAlbumId, loadAlbumPhotos, photoSelectionDict,
        togglePhotoSelection, changeTab, infiniteScrollEnabled, displayedPhotos,
        filteredPhotos, selectAllPhotos
    });

    // Side menu toggle notification effect
    useSideMenuToggleEffect({ showSideMenu, onRightMenuToggle });

    // Config and cleanup effect
    useConfigAndCleanupEffect({
        appConfig, iconSize, currentPhotoLoadingController, setThumbnailStore
    });

    // View mode sync hooks
    useViewModeSync({
        viewMode, currentDate, currentAlbumId, currentTagId, searchQuery,
        currentSearchParams, isSearchMode, photoLoading, currentPhotoLoadingController,
        setCurrentPhotoLoadingController, setShowSideMenu, setPhotosList,
        setCurrentPhotoIndex, setPhotosListMiniCurrentIndex, setCurrentPhotoPath,
        loadPhotosWithCollection, appConfig, sortOfPhotos
    });

    useImportStateSync({ viewMode, importState, loadPhotosWithCollection });

    usePhotoDataSync({
        filteredPhotos, displayedPhotos, allPhotosForCurrentFetch, infiniteScrollEnabled,
        setPhotosListMiniAllPhotos, setDisplayedPhotoCount, setPhotosList
    });

    useImportModeLifecycle({
        viewMode, isSearchMode, importState, setImportState, setTabClass,
        setShowSideMenu, setAllPhotosForCurrentFetch, setPhotosListMiniAllPhotos, setPhotosList
    });

    // Alias for backward compatibility
    const moveToTrashCan = (photoPath) => moveToTrash(photoPath, parseInt(sortOfPhotos));

    // State groups
    const {
        viewState, filterState, selectionState, displayState, searchState,
        photoDataState, photoListMiniState, cacheState, navigationState, configState, listState
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

    // Handlers object using extracted hook
    const handlers = usePhotosListHandlers({
        closePhotoDisplay, displayPhoto, toggleSelection, isPhotoSelected, addSelection,
        clearPhotoSelection, selectAllPhotoToSelection, getPhotos, handleInfiniteScroll,
        reloadCurrentModeData, refreshPhotosOnly, moveToTrashCan, updatePhotosAfterTrashOperation,
        deletePhotosHandler, restorePhotosHandler, permanentlyDeletePhoto,
        setStarWithUpdate, updatePhotoComment, removePhotoFromList,
        handleAlbumClick, handleAlbumSelection, handleNewAlbumClick, handleAlbumUpdate,
        handleAlbumDelete, clearAlbumSelection, deleteSelectedAlbums,
        handleTagClick, handleTagSelection, handleNewTagClick, clearTagSelection, deleteSelectedTags,
        handleSearch, clearSearch, handleFiltersChange, handleSavedSearchSelect, clearAllFilters,
        setShowSideMenu, setIconSize, setSort, setImportSort, setCurrentPhotoPath, setCurrentPhotoIndex,
        setShowFilterPopover, setAlbumSearchTerm, setTagSearchTerm,
        changeTab, closeRightColumn, toggleAlbumListMode, openTagsList, toggleHome,
        addFooterMessage, handleTauriError
    });

    // Auto-close photo display effect
    useAutoClosePhotoDisplayEffect({ viewMode, currentPhotoPath, closePhotoDisplay });

    return (
        <ErrorBoundary name="PhotosList" level="component">
            <>
                {photoLoading ? (
                    <div className="photoLoadingOnParent" style={{ display: photoLoading ? "block" : "none" }}>
                        <PhotoLoading viewModeObj={viewModeObj} />
                    </div>
                ) : (
                    <>
                        <PhotoDisplayWrapper
                            photoLoading={photoLoading} viewState={viewState} filterState={filterState}
                            displayState={displayState} searchState={searchState} handlers={handlers}
                            photoListMiniState={photoListMiniState} cacheState={cacheState}
                            navigationState={navigationState} configState={configState}
                        />
                        <PhotoListContent
                            photoLoading={photoLoading} viewState={viewState} filterState={filterState}
                            selectionState={selectionState} displayState={displayState} searchState={searchState}
                            photoDataState={photoDataState} handlers={handlers} listState={listState}
                            configState={configState} isLimitedByConfig={isLimitedByConfig}
                            configLimit={configLimit} debugMessage={debugMessage}
                            infiniteScrollEnabled={infiniteScrollEnabled}
                            renderFilterClearingUI={renderFilterClearingUI} filterButtonRef={filterButtonRef}
                        />
                    </>
                )}

                {!currentPhotoPath && (
                    <VerticalTabBar
                        viewMode={viewMode} isSearchMode={isSearchMode} showSideMenu={showSideMenu}
                        tabClass={tabClass} changeTab={changeTab} setShowSideMenu={setShowSideMenu}
                        closeRightColumn={closeRightColumn} clearAllTabs={clearAllTabs} viewModeObj={viewModeObj}
                        photoSelectionCount={photoSelection.length}
                        selectedAlbumsCount={selectedAlbums.length} selectedTagsCount={selectedTags.length}
                    />
                )}

                {currentPhotoPath && (
                    <PhotoOption
                        setShowSideMenu={setShowSideMenu} showSideMenu={showSideMenu}
                        currentPhotoPath={currentPhotoPath} closePhotoDisplay={closePhotoDisplay}
                        path={currentPhotoPath} searchMode={isSearchMode} searchQuery={searchQuery}
                        searchResultsCount={displayedPhotos.length} onClearSearch={clearSearch}
                        searchTools={searchTools} addFooterMessage={handlers.addFooterMessage}
                        imgCacheMap={imgCacheMap} setStar={setStarWithUpdate} star={star}
                        onPhotosRefresh={refreshPhotosOnly} onCommentUpdate={updatePhotoComment}
                        onAlbumUpdate={handleAlbumUpdate} onAlbumDelete={handleAlbumDelete}
                        isImportMode={viewModeObj.isImportMode()} isTrashMode={viewModeObj.isTrashMode()}
                        viewModeObj={viewModeObj} photoSelection={photoSelection}
                        selectedAlbums={selectedAlbums} selectedTags={selectedTags}
                        selectAllPhotoToSelection={selectAllPhotoToSelection}
                        clearPhotoSelection={clearPhotoSelection} deleteSelectedAlbums={deleteSelectedAlbums}
                        clearAlbumSelection={clearAlbumSelection} deleteSelectedTags={deleteSelectedTags}
                        clearTagSelection={clearTagSelection} importState={importState}
                        albumsList={albumsList} tagsList={tagsList}
                    />
                )}

                <SideMenuWrapper
                    viewState={viewState} filterState={filterState} selectionState={selectionState}
                    displayState={displayState} searchState={searchState} photoDataState={photoDataState}
                    handlers={handlers} tabClass={tabClass} setTabClass={setTabClass}
                    dateNum={dateNum || {}} updateDateNum={updateDateNum}
                    dateList={dateList || []} updateDateList={updateDateList}
                    setShowJobQueueModal={setShowJobQueueModal} filterOptions={filterOptions}
                    loadFilterOptions={loadFilterOptions} isFilterOptionsLoading={isFilterOptionsLoading}
                    importState={importState} albumsList={albumsList} tagsList={tagsList}
                />

                <AlbumCreationModal
                    isOpen={showAlbumCreationModal}
                    onClose={() => setShowAlbumCreationModal(false)}
                    onConfirm={createEmptyAlbum}
                    selectedPhotosCount={0}
                />

                <FilterPopover
                    isOpen={showFilterPopover} onClose={() => setShowFilterPopover(false)}
                    anchorRef={filterButtonRef} starFilter={starFilter} setStarFilter={setStarFilter}
                    hasCommentFilter={hasCommentFilter} setHasCommentFilter={setHasCommentFilter}
                    hasTagFilter={hasTagFilter} setHasTagFilter={setHasTagFilter}
                    extensionFilter={viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter}
                    setExtensionFilter={viewModeObj.isImportMode() ? setImportExtensionFilter : setExtensionFilter}
                    isImportMode={viewModeObj.isImportMode()}
                />
            </>
        </ErrorBoundary>
    );
}

export default PhotosList;
