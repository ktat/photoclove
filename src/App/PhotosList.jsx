import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { invoke } from "@tauri-apps/api/core";

import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useError } from "../context/ErrorContext.jsx";
import { useDialog } from "../context/DialogContext.jsx";

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
import { usePhotoListLoading } from "../hooks/usePhotoListLoading.js";
import { usePhotoListFaces } from "../hooks/usePhotoListFaces.js";
import { usePhotosCache } from "../hooks/usePhotosCache.js";
import { useSearchModeSync } from "../hooks/useSearchModeSync.js";
import { getViewKey } from "../utils/ViewKey.js";

import { FaceDetectionProvider } from "../context/FaceDetectionContext.jsx";
import {
    useViewModeChangeEffect,
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
import SharedModals from "./PhotosList/SharedModals.jsx";
import VerticalTabBar from "../components/VerticalTabBar.jsx";

// Operation hooks for PhotoOption
import { usePhotoOptionOperations } from "../hooks/usePhotoOptionOperations.js";

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
    searchMode: _searchMode,
    isAdvancedSearchMode,
    setShowJobQueueModal,
    getDatesNum,
    searchTools
}) {
    // Context hooks
    const {
        dateList, datePage, updateDatePage, currentDate, updateCurrentDate,
        dateNum, updateDateNum, updateDateList, setCurrentDateNum,
        recentPhotosMode, albumsList, currentAlbum,
        updateAlbumsList, updateCurrentAlbum
    } = usePhoto();

    const {
        toggleSearchPage, searchInitialQuery, currentAlbumId, currentTagId,
        viewMode, modeData, openAlbum, toggleAlbumListMode, openTag, openTagsList, toggleHome,
        openPerson, openFacesList, openUnknownFaces,
        openBurstGroup, goBackFromBurstGroup, currentBurstGroupId, burstModeEnabled,
        burstReturnMode, burstReturnModeData
    } = useUI();

    const { handleTauriError, addError } = useError();
    const dialog = useDialog();

    // Search and filters
    const {
        searchFilters, setSearchFilters, currentSearchParams, setCurrentSearchParams,
        searchResults, searchQuery, isSearching, performSearch,
        clearSearch: clearSearchHook, clearAllSearchFilters, updateSearchParams, executeSearch
    } = useSearchAndFilters();

    // Photos state (must be before useViewModeFactory which needs currentAlbumName, currentTagName)
    const {
        photos, setPhotosList, photoCollection, setPhotoCollection,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        currentPhoto, setCurrentPhoto, currentPhotoIndex, setCurrentPhotoIndex,
        isFetched, setIsFetched,
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
        selectedTags, setSelectedTags, showFilterPopover, setShowFilterPopover,
        filterButtonRef,
        facesList, setFacesList, faceSearchTerm, setFaceSearchTerm,
        currentPersonId, setCurrentPersonId, currentPersonName, setCurrentPersonName,
        selectedPersons, setSelectedPersons, selectedUnknownFaces, setSelectedUnknownFaces,
        unknownFacesCount, setUnknownFacesCount, faceViewType, setFaceViewType,
        unknownFacesRefreshTrigger, setUnknownFacesRefreshTrigger
    } = usePhotosState();

    // Create ViewMode object using factory hook (must be after usePhotosState, before usePhotoSelection)
    const { viewModeObj } = useViewModeFactory({
        viewMode, currentAlbumId, currentAlbumName, currentTagId, currentTagName, currentBurstGroupId, searchInitialQuery, currentDate,
        burstReturnMode, burstReturnModeData
    });

    // Photo selection (depends on viewModeObj)
    const {
        photoSelection, photoSelectionDict, togglePhotoSelection, isPhotoSelected,
        clearSelection: clearPhotoSelection, selectAllPhotos, setSelection, getSelectionStats
    } = usePhotoSelection(viewMode, viewModeObj);

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
        loadUnknownFacesPhotos: loadUnknownFacesPhotosOriginal,
        loadTrashPhotos, loadFilterOptions, logOperation
    } = usePhotoDataLoader({
        handleError, convertPhotosToEntities: convertPhotosWithConfig,
        updateAlbumsList, setFilteredAlbums, setPhotosList,
        setAllPhotosForCurrentFetch,
        setTagsList, setFilteredTags, setCurrentAlbumName,
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
        viewModeObj, allPhotosForCurrentFetch, applyFiltersWithConfig,
        importSortOfPhotos, sortOfPhotos, appConfig
    });

    // View Cache (Phase 1): LRU map of view-mode -> photos snapshot.
    // Defined here (before usePhotoLoader) so that the load function can
    // call onLoadSuccess to atomically save loaded photos under their
    // viewKey — avoiding the race where viewKey changes between
    // load completion and a generic save effect.
    const photosCache = usePhotosCache(
        appConfig?.view_cache_max_keys ?? 10,
        appConfig?.view_cache_max_total_photos ?? 50000
    );
    const currentViewKey = useMemo(
        () => getViewKey(viewModeObj, currentSearchParams, importState?.currentImportPath),
        [viewModeObj, currentSearchParams, importState?.currentImportPath]
    );
    const onLoadSuccess = useCallback((viewMode, photoEntities) => {
        // Mark the current view as fetched so the empty-state UI can render
        // when truly empty (vs. "we just haven't fetched yet"). Run even on
        // empty results — that's a confirmed "no photos for this view".
        setIsFetched(true);
        if (!photoEntities || photoEntities.length === 0) return;
        const key = getViewKey(viewMode, currentSearchParams, importState?.currentImportPath);
        if (!key) return;
        photosCache.set(key, photoEntities, key);
    }, [photosCache, currentSearchParams, importState?.currentImportPath, setIsFetched]);

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
        setCurrentPhoto, setCurrentPhotoIndex,
        convertPhotosToEntities: convertPhotosWithConfig, handleError,
        datePage: datePage || {}, updateDatePage, addFooterMessage,
        burstModeEnabled,
        currentSearchParams,
        onLoadSuccess
    });

    // Album/Tag/Person photo loading wrappers and refresh/reload functions
    const {
        loadAlbumPhotos, loadTagPhotos, loadPersonPhotos, loadUnknownFacesPhotos,
        refreshPhotosOnly, reloadAlbums, reloadTags
    } = usePhotoListLoading({
        setPhotoLoading,
        loadAlbumPhotosOriginal,
        loadTagPhotosOriginal,
        loadPersonPhotosOriginal,
        loadUnknownFacesPhotosOriginal,
        loadAlbums,
        loadTags,
        loadAllPhotosBasedOnViewMode,
        viewModeObj,
        appConfig,
        viewMode
    });

    const handleAlbumClick = useCallback((album) => {
        handleAlbumClickOriginal(album);
    }, [handleAlbumClickOriginal]);

    // Photo display hook
    const { displayPhoto, closePhotoDisplay, closeRightColumn } = usePhotoDisplay({
        photosListMiniAllPhotos, viewModeObj, setCurrentPhoto, setCurrentPhotoIndex,
        setPhotosListMiniCurrentIndex, setPhotosListMiniReread, setShowSideMenu,
        currentPhotoLoadingController, setCurrentPhotoLoadingController,
        handleError, refreshPhotos: refreshPhotosOnly, photosListMiniReread
    });

    // Face handlers (defined before usePhotoOperations to avoid initialization error)
    const { reloadFaces, handlePersonClick, handleUnknownFaceClick } = usePhotoListFaces({
        setFacesList,
        setUnknownFacesCount,
        setCurrentPersonId,
        setCurrentPersonName,
        openPerson,
        loadPersonPhotos,
        openUnknownFaces,
        loadUnknownFacesPhotos
    });

    // Photo operations hook
    const {
        handleAddToAlbum, removePhotoFromAlbum, deletePhoto, restorePhoto,
        permanentlyDeletePhoto, moveToTrash, handleAlbumSelection, clearAlbumSelection,
        deleteSelectedAlbums, handleAlbumDelete, handleTagSelection, clearTagSelection,
        deleteSelectedTags, handlePersonSelection, clearPersonSelection,
        deleteSelectedPersons, handleUnknownFaceSelection, clearUnknownFaceSelection,
        deleteUnknownFacesBatch, assignUnknownFacesToPerson, removePhotoFromList
    } = usePhotoOperations({
        selectedAlbums, setSelectedAlbums, selectedTags, setSelectedTags,
        selectedPersons, setSelectedPersons, selectedUnknownFaces, setSelectedUnknownFaces,
        tagsList, albumsList, appConfig, currentViewMode: viewMode,
        currentDate, currentAlbumName, currentTagName, searchQuery, handleError,
        addFooterMessage, loadAlbums, loadTags, loadFaces: reloadFaces, currentAlbumId, toggleAlbumListMode,
        viewModeObj, photosListMiniAllPhotos, setPhotosListMiniAllPhotos,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex,
        setCurrentPhoto, setCurrentPhotoIndex, currentPhotoIndex, closePhotoDisplay,
        setPhotosListMiniReread, photosListMiniReread,
        dateNum, setDateNum: updateDateNum, dateList, setDateList: updateDateList, sortOfPhotos,
        triggerUnknownFacesRefresh: () => setUnknownFacesRefreshTrigger(prev => prev + 1),
        dialog
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

    // Tab management
    const { tabClass, setTabClass, changeTab, clearAllTabs } = useTabManagement({ viewMode, viewModeObj });

    // Selection tab auto-open effect
    useSelectionTabEffect({
        photoSelection, selectedAlbums, selectedTags, selectedPersons, selectedUnknownFaces, faceViewType, changeTab, setShowSideMenu, viewModeObj, tabClass, currentPhoto
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

    // Search-mode glue: commit results, show "Searching..." overlay, and
    // reset state on entry/exit. Extracted to keep this file under the
    // 700-line limit. See useSearchModeSync for details.
    useSearchModeSync({
        viewModeObj, searchResults, isSearching,
        setAllPhotosForCurrentFetch, convertPhotosWithConfig,
        clearSearchHook, updateSearchParams, setSearchFilters,
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
        setStar, photosListMiniAllPhotos, setPhotosListMiniAllPhotos, currentPhoto,
        allPhotosForCurrentFetch, setAllPhotosForCurrentFetch, viewMode,
        loadAlbums, currentAlbumId, loadAlbumPhotos, photoSelectionDict,
        togglePhotoSelection, changeTab, infiniteScrollEnabled, displayedPhotos,
        filteredPhotos, selectAllPhotos, tabClass
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
        setCurrentPhotoIndex, setPhotosListMiniCurrentIndex, setCurrentPhoto,
        setAllPhotosForCurrentFetch, setIsFetched, setPhotoLoading,
        refreshPhotosOnly, appConfig, sortOfPhotos,
        photosCache, currentViewKey
    });

    useImportStateSync({ viewMode, importState, loadPhotosWithCollection });

    usePhotoDataSync({
        filteredPhotos, displayedPhotos, allPhotosForCurrentFetch, infiniteScrollEnabled,
        setPhotosListMiniAllPhotos, setDisplayedPhotoCount, setPhotosList
    });

    useImportModeLifecycle({
        viewMode, modeData, viewModeObj, importState, setImportState, setTabClass,
        setShowSideMenu, setAllPhotosForCurrentFetch, setPhotosListMiniAllPhotos, setPhotosList
    });

    // Quick View: auto-open target file in PhotoViewer after photos load
    const quickViewOpenedRef = useRef(null);
    useEffect(() => {
        if (viewMode !== VIEW_MODES.QUICK_VIEW) {
            quickViewOpenedRef.current = null;
            return;
        }
        const targetPath = importState?.targetFile;
        if (!targetPath || photosListMiniAllPhotos.length === 0 || quickViewOpenedRef.current === targetPath) {
            return;
        }

        // Match by full path or fallback to filename
        let targetIndex = photosListMiniAllPhotos.findIndex(
            photo => photo.originalPath === targetPath
        );
        if (targetIndex === -1) {
            const targetName = targetPath.split('/').pop()?.toLowerCase();
            targetIndex = photosListMiniAllPhotos.findIndex(
                photo => photo.name?.toLowerCase() === targetName
            );
        }

        quickViewOpenedRef.current = targetPath;

        if (targetIndex !== -1) {
            const matchedPhoto = photosListMiniAllPhotos[targetIndex];
            const matchedPath = matchedPhoto.originalPath || targetPath;
            logger.info('PhotosList', 'quickview_auto_open', 'Auto-opening target file in viewer', {
                targetPath, matchedPath, targetIndex
            });
            displayPhoto(matchedPath, targetIndex);
        } else {
            logger.warn('PhotosList', 'quickview_target_not_found', 'Target file not found in loaded photos', {
                targetPath, photoCount: photosListMiniAllPhotos.length
            });
        }
    }, [viewMode, importState, photosListMiniAllPhotos, displayPhoto]);

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
        photoSelectionDict, photoSelection, selectedAlbums, selectedTags, selectedPersons, selectedUnknownFaces,
        currentPhoto, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos, importSortOfPhotos, datePage, numOfPhoto, isFetched,
        searchQuery, searchInitialQuery, searchFilters, searchResults, currentSearchParams, isSearching,
        displayedPhotos, filteredPhotos, displayedPhotoCount, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch,
        photosListMiniAllPhotos, setPhotosListMiniAllPhotos, photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex, photosListMiniReread, setPhotosListMiniReread,
        imgCacheMap, setImgCacheMap, thumbnailStore, setThumbnailStore,
        shortCutNavigation, setShortCutNavigation,
        appConfig, importState, photos,
        filteredAlbums, albumSearchTerm, filteredTags, tagSearchTerm,
        facesList, faceSearchTerm, unknownFacesCount, faceViewType, unknownFacesRefreshTrigger
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
        handlePersonClick, handlePersonSelection, clearPersonSelection, deleteSelectedPersons,
        handleUnknownFaceClick, handleUnknownFaceSelection, clearUnknownFaceSelection,
        deleteUnknownFacesBatch, assignUnknownFacesToPerson,
        setFaceSearchTerm, setFaceViewType, openFacesList, reloadFaces,
        handleSearch, clearSearch, handleFiltersChange, handleSavedSearchSelect, clearAllFilters,
        setShowSideMenu, setIconSize, setSort, setImportSort, setCurrentPhoto, setCurrentPhotoIndex,
        setShowFilterPopover, setAlbumSearchTerm, setTagSearchTerm,
        changeTab, closeRightColumn, toggleAlbumListMode, openTagsList, toggleHome,
        addFooterMessage, handleTauriError
    });

    // PhotoOption operations (shared with DirectoryMenu)
    const { operations: photoOptionOperations, modalState } = usePhotoOptionOperations({
        photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError,
        deletePhotos: deletePhotosHandler, restorePhotos: restorePhotosHandler,
        updatePhotosAfterTrashOperation, reloadCurrentModeData,
        refreshPhotosOnly, viewModeObj, removePhotoFromList,
        appConfig, saveConfigWithStartupImages, setShowJobQueueModal, dialog
    });

    // Auto-close photo display effect
    useAutoClosePhotoDisplayEffect({ viewMode, currentPhoto, closePhotoDisplay });

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

                {!currentPhoto && (
                    <VerticalTabBar
                        viewMode={viewMode} viewModeObj={viewModeObj} showSideMenu={showSideMenu}
                        tabClass={tabClass} changeTab={changeTab} setShowSideMenu={setShowSideMenu}
                        closeRightColumn={closeRightColumn} clearAllTabs={clearAllTabs}
                        photoSelectionCount={photoSelection.length}
                        selectedAlbumsCount={selectedAlbums.length} selectedTagsCount={selectedTags.length}
                        selectedPersonsCount={selectedPersons.length}
                        selectedUnknownFacesCount={selectedUnknownFaces.length}
                        faceViewType={faceViewType}
                    />
                )}

                {currentPhoto && (
                    <PhotoOption
                        setShowSideMenu={setShowSideMenu} showSideMenu={showSideMenu}
                        currentPhoto={currentPhoto} closePhotoDisplay={closePhotoDisplay}
                        viewModeObj={viewModeObj} searchQuery={searchQuery}
                        searchResultsCount={displayedPhotos.length} onClearSearch={clearSearch}
                        searchTools={searchTools} addFooterMessage={handlers.addFooterMessage}
                        imgCacheMap={imgCacheMap} setStar={setStarWithUpdate} star={star}
                        onPhotosRefresh={refreshPhotosOnly} onCommentUpdate={updatePhotoComment}
                        onAlbumUpdate={handleAlbumUpdate} onAlbumDelete={handleAlbumDelete}
                        photoSelection={photoSelection} config={appConfig}
                        selectedAlbums={selectedAlbums} selectedTags={selectedTags} selectedPersons={selectedPersons}
                        selectAllPhotoToSelection={selectAllPhotoToSelection}
                        clearPhotoSelection={clearPhotoSelection} deleteSelectedAlbums={deleteSelectedAlbums}
                        clearAlbumSelection={clearAlbumSelection} deleteSelectedTags={deleteSelectedTags}
                        clearTagSelection={clearTagSelection} deleteSelectedPersons={deleteSelectedPersons}
                        clearPersonSelection={clearPersonSelection} importState={importState}
                        albumsList={albumsList} tagsList={tagsList} facesList={facesList}
                        setEditorHasUnsavedChanges={setEditorHasUnsavedChanges}
                        removePhotoFromList={removePhotoFromList}
                        totalPhotosCount={photosListMiniAllPhotos.length}
                        operations={photoOptionOperations}
                    />
                )}

                <SideMenuWrapper
                    viewState={viewState} filterState={filterState} selectionState={selectionState}
                    displayState={displayState} searchState={searchState} photoDataState={photoDataState}
                    listState={listState}
                    handlers={handlers} tabClass={tabClass} setTabClass={setTabClass}
                    dateNum={dateNum || {}} updateDateNum={updateDateNum}
                    dateList={dateList || []} updateDateList={updateDateList}
                    setShowJobQueueModal={setShowJobQueueModal} filterOptions={filterOptions}
                    loadFilterOptions={loadFilterOptions} isFilterOptionsLoading={isFilterOptionsLoading}
                    importState={importState} albumsList={albumsList} tagsList={tagsList}
                    config={appConfig} saveConfigWithStartupImages={saveConfigWithStartupImages}
                    sharedOperations={photoOptionOperations} modalState={modalState}
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

                <SharedModals modalState={modalState} photoSelectionCount={photoSelection.length} />
            </FaceDetectionProvider>
        </ErrorBoundary>
    );
}

export default PhotosList;
