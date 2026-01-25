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

import { FaceDetectionProvider } from "../context/FaceDetectionContext.jsx";
import { getAllPersonsForList } from "../services/FaceDetectionService.js";
import {
    useViewModeChangeEffect,
    usePhotoSyncEffect,
    useSelectionTabEffect,
    useSortChangeEffect,
    useBurstModeChangeEffect,
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
import { unifiedCollectionService } from "../services/UnifiedCollectionService.js";

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
        viewMode, openAlbum, toggleAlbumListMode, openTag, openTagsList, toggleHome,
        openPerson, openFacesList,
        openBurstGroup, goBackFromBurstGroup, currentBurstGroupId, burstModeEnabled,
        burstReturnMode, burstReturnModeData
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
        filterButtonRef,
        facesList, setFacesList, faceSearchTerm, setFaceSearchTerm,
        currentPersonId, setCurrentPersonId, currentPersonName, setCurrentPersonName
    } = usePhotosState();

    // State to track if PhotoEditor has unsaved changes
    const [editorHasUnsavedChanges, setEditorHasUnsavedChanges] = useState(false);

    // Callback for navigation - checks if PhotoEditor has unsaved changes
    const checkEditorUnsavedChanges = useCallback(() => {
        if (editorHasUnsavedChanges) {
            return window.confirm('You have unsaved changes. Discard and switch to another photo?');
        }
        return true;
    }, [editorHasUnsavedChanges]);

    const { savePageState, loadPageState } = usePageState();

    // Create ViewMode object using factory hook
    const { viewModeObj } = useViewModeFactory({
        viewMode, currentAlbumId, currentAlbumName, currentTagId, currentTagName, currentBurstGroupId, searchInitialQuery, currentDate,
        burstReturnMode, burstReturnModeData
    });

    // View mode change effect
    useViewModeChangeEffect({ viewMode, setShowFilterPopover });

    // Photo conversion helper
    const convertPhotosWithConfig = useCallback((photosData, isFromTrash = false, toJSON = true) => {
        return convertPhotosToEntities(photosData, appConfig, isFromTrash, toJSON);
    }, [appConfig]);

    // Save config with startup images
    const saveConfigWithStartupImages = useCallback(async (startupImages) => {
        const updatedConfig = {
            ...appConfig,
            startup_images: startupImages
        };
        await invoke("save_config", { config: updatedConfig });
        logger.info('PhotosList', 'startup_images_saved', 'Startup images saved to config');
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
        loadPersonPhotos: loadPersonPhotosOriginal,
        loadTrashPhotos, loadFilterOptions, logOperation
    } = usePhotoDataLoader({
        handleError, convertPhotosToEntities: convertPhotosWithConfig,
        updateAlbumsList, setFilteredAlbums, updateAlbumPhotos, setPhotosList,
        setAllPhotosForCurrentFetch,
        setTagsList, setFilteredTags, setTagPhotos, setTrashPhotos, setCurrentAlbumName,
        openAlbum, setFilterOptions, setIsFilterOptionsLoading,
        filterOptions, isFilterOptionsLoading, appConfig,
        burstModeEnabled
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
        viewModeObj, searchQuery, searchInitialQuery,
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
        extensionFilter, filteredPhotos, numOfPhoto, importState,
        setPhotosList, setAllPhotosForCurrentFetch, setIsLimitedByConfig, setConfigLimit,
        setPhotosListMiniAllPhotos, setPhotoCollection, setPhotosListImgSrc,
        setCurrentPhotoPath, setCurrentPhotoIndex,
        convertPhotosToEntities: convertPhotosWithConfig, handleError,
        datePage: datePage || {}, updateDatePage, addFooterMessage,
        burstModeEnabled
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

    const loadPersonPhotos = useCallback(async (personId) => {
        setPhotoLoading(true);
        try { await loadPersonPhotosOriginal(personId); }
        finally { setPhotoLoading(false); }
    }, [loadPersonPhotosOriginal, setPhotoLoading]);

    // Photo sync effect
    usePhotoSyncEffect({
        viewModeObj, allPhotosForCurrentFetch, updateAlbumPhotos, setTagPhotos
    });

    // Minimum loading display time (ms) for better UX
    const MIN_LOADING_TIME = 500;

    // Helper to ensure minimum loading time
    const withMinLoadingTime = useCallback(async (asyncFn) => {
        const startTime = Date.now();
        try {
            await asyncFn();
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < MIN_LOADING_TIME) {
                await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
            }
        }
    }, []);

    // Refresh photos helper with loading state
    const refreshPhotosOnly = useCallback(async () => {
        logger.info('PhotosList', 'refresh_photos_only', 'Refreshing photos with loading indicator', { viewMode });
        setPhotoLoading(true);
        try {
            await withMinLoadingTime(() => loadAllPhotosBasedOnViewMode(viewModeObj, appConfig, true));
        } finally {
            setPhotoLoading(false);
        }
    }, [loadAllPhotosBasedOnViewMode, viewModeObj, appConfig, viewMode, setPhotoLoading, withMinLoadingTime]);

    // Reload albums list with loading state (clears cache first)
    const reloadAlbums = useCallback(async () => {
        logger.info('PhotosList', 'reload_albums', 'Reloading albums list with loading indicator');
        setPhotoLoading(true);
        try {
            unifiedCollectionService.clearCache(); // Clear cache to get fresh data
            await withMinLoadingTime(loadAlbums);
        } finally {
            setPhotoLoading(false);
        }
    }, [loadAlbums, setPhotoLoading, withMinLoadingTime]);

    // Reload tags list with loading state (clears cache first)
    const reloadTags = useCallback(async () => {
        logger.info('PhotosList', 'reload_tags', 'Reloading tags list with loading indicator');
        setPhotoLoading(true);
        try {
            unifiedCollectionService.clearCache(); // Clear cache to get fresh data
            await withMinLoadingTime(loadTags);
        } finally {
            setPhotoLoading(false);
        }
    }, [loadTags, setPhotoLoading, withMinLoadingTime]);

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
        viewModeObj, photosListMiniAllPhotos, setPhotosListMiniAllPhotos,
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

    // Burst mode change effect
    useBurstModeChangeEffect({
        burstModeEnabled, viewModeObj, appConfig,
        loadAllPhotosBasedOnViewMode, handleError
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

    // Face handlers
    const reloadFaces = useCallback(async () => {
        try {
            logger.info('PhotosList', 'reload_faces_start', 'Loading faces list');
            const persons = await getAllPersonsForList();
            setFacesList(persons);
            logger.info('PhotosList', 'reload_faces_complete', 'Faces loaded', { count: persons.length });
        } catch (error) {
            logger.error('PhotosList', 'reload_faces_error', 'Failed to load faces', { error: error.toString() });
        }
    }, [setFacesList]);

    const handlePersonClick = useCallback((person) => {
        logger.info('PhotosList', 'person_click', 'User clicked on person', {
            personId: person.person_id,
            personName: person.person_name
        });
        setCurrentPersonId(person.person_id);
        setCurrentPersonName(person.person_name || 'Unknown');
        openPerson(person.person_id);
        loadPersonPhotos(person.person_id);
    }, [openPerson, setCurrentPersonId, setCurrentPersonName, loadPersonPhotos]);

    // Tab management
    const { tabClass, setTabClass, changeTab, clearAllTabs } = useTabManagement({ viewMode, viewModeObj });

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
        viewModeObj, isAdvancedSearchMode, searchQuery, searchInitialQuery,
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
        viewMode, viewModeObj, currentDate, currentAlbumId, currentTagId, currentBurstGroupId, searchQuery,
        currentSearchParams, photoLoading, currentPhotoLoadingController,
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
        viewMode, viewModeObj, importState, setImportState, setTabClass,
        setShowSideMenu, setAllPhotosForCurrentFetch, setPhotosListMiniAllPhotos, setPhotosList
    });

    // Load faces when switching to FACE_LIST mode
    useEffect(() => {
        if (viewMode === VIEW_MODES.FACE_LIST) {
            reloadFaces();
        }
    }, [viewMode, reloadFaces]);

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
        searchQuery, searchInitialQuery, searchFilters, searchResults, currentSearchParams,
        displayedPhotos, filteredPhotos, displayedPhotoCount, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        photosListMiniAllPhotos, setPhotosListMiniAllPhotos, photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex, photosListMiniReread, setPhotosListMiniReread,
        imgCacheMap, setImgCacheMap, thumbnailStore, setThumbnailStore,
        shortCutNavigation, setShortCutNavigation,
        appConfig, importState, photos,
        filteredAlbums, albumSearchTerm, filteredTags, tagSearchTerm,
        facesList, faceSearchTerm
    });

    // Handlers object using extracted hook
    const handlers = usePhotosListHandlers({
        closePhotoDisplay, displayPhoto, openBurstGroup, goBackFromBurstGroup, toggleSelection, isPhotoSelected, addSelection,
        clearPhotoSelection, selectAllPhotoToSelection, getPhotos, handleInfiniteScroll,
        reloadCurrentModeData, refreshPhotosOnly, reloadAlbums, reloadTags, moveToTrashCan, updatePhotosAfterTrashOperation,
        deletePhotosHandler, restorePhotosHandler, permanentlyDeletePhoto,
        setStarWithUpdate, updatePhotoComment, removePhotoFromList,
        handleAlbumClick, handleAlbumSelection, handleNewAlbumClick, handleAlbumUpdate,
        handleAlbumDelete, clearAlbumSelection, deleteSelectedAlbums,
        handleTagClick, handleTagSelection, handleNewTagClick, clearTagSelection, deleteSelectedTags,
        handlePersonClick, setFaceSearchTerm, openFacesList, reloadFaces,
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
            <FaceDetectionProvider>
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
                            beforeNavigate={checkEditorUnsavedChanges}
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
                        viewMode={viewMode} viewModeObj={viewModeObj} showSideMenu={showSideMenu}
                        tabClass={tabClass} changeTab={changeTab} setShowSideMenu={setShowSideMenu}
                        closeRightColumn={closeRightColumn} clearAllTabs={clearAllTabs}
                        photoSelectionCount={photoSelection.length}
                        selectedAlbumsCount={selectedAlbums.length} selectedTagsCount={selectedTags.length}
                    />
                )}

                {currentPhotoPath && (
                    <PhotoOption
                        setShowSideMenu={setShowSideMenu} showSideMenu={showSideMenu}
                        currentPhotoPath={currentPhotoPath} closePhotoDisplay={closePhotoDisplay}
                        currentPhoto={photosListMiniAllPhotos[currentPhotoIndex]}
                        path={currentPhotoPath} viewModeObj={viewModeObj} searchQuery={searchQuery}
                        searchResultsCount={displayedPhotos.length} onClearSearch={clearSearch}
                        searchTools={searchTools} addFooterMessage={handlers.addFooterMessage}
                        imgCacheMap={imgCacheMap} setStar={setStarWithUpdate} star={star}
                        onPhotosRefresh={refreshPhotosOnly} onCommentUpdate={updatePhotoComment}
                        onAlbumUpdate={handleAlbumUpdate} onAlbumDelete={handleAlbumDelete}
                        photoSelection={photoSelection}
                        selectedAlbums={selectedAlbums} selectedTags={selectedTags}
                        selectAllPhotoToSelection={selectAllPhotoToSelection}
                        clearPhotoSelection={clearPhotoSelection} deleteSelectedAlbums={deleteSelectedAlbums}
                        clearAlbumSelection={clearAlbumSelection} deleteSelectedTags={deleteSelectedTags}
                        clearTagSelection={clearTagSelection} importState={importState}
                        albumsList={albumsList} tagsList={tagsList}
                        setEditorHasUnsavedChanges={setEditorHasUnsavedChanges}
                        removePhotoFromList={removePhotoFromList}
                        totalPhotosCount={photosListMiniAllPhotos.length}
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
                    config={appConfig} saveConfigWithStartupImages={saveConfigWithStartupImages}
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
            </FaceDetectionProvider>
        </ErrorBoundary>
    );
}

export default PhotosList;
