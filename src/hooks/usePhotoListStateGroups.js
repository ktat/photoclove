/**
 * usePhotoListStateGroups Hook
 *
 * Centralizes the creation of state group objects for PhotosList component.
 * These state groups organize related state into logical units for easier
 * prop passing to child components.
 *
 * Extracted from PhotosList.jsx to reduce file size and improve maintainability.
 */

import { useMemo } from 'react';

/**
 * Custom hook to create state group objects
 *
 * @param {Object} params - All state values needed for creating state groups
 * @returns {Object} State group objects
 */
export function usePhotoListStateGroups({
    // ViewState params
    viewMode,
    currentDate,
    viewModeObj,

    // FilterState params
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    importExtensionFilter,
    showFilterPopover,
    hasActiveFiltersState,

    // SelectionState params
    photoSelectionDict,
    photoSelection,
    selectedAlbums,
    selectedTags,
    selectedPersons,
    selectedUnknownFaces,

    // DisplayState params
    currentPhotoPath,
    currentPhotoIndex,
    showSideMenu,
    iconSize,
    sortOfPhotos,
    importSortOfPhotos,
    datePage,
    numOfPhoto,

    // SearchState params
    searchQuery,
    searchInitialQuery,
    searchFilters,
    searchResults,
    currentSearchParams,

    // PhotoDataState params
    displayedPhotos,
    filteredPhotos,
    displayedPhotoCount,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,

    // PhotoListMiniState params
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    photosListMiniReread,
    setPhotosListMiniReread,

    // CacheState params
    imgCacheMap,
    setImgCacheMap,
    thumbnailStore,
    setThumbnailStore,

    // NavigationState params
    shortCutNavigation,
    setShortCutNavigation,

    // ConfigState params
    appConfig,
    importState,
    photos,

    // ListState params
    filteredAlbums,
    albumSearchTerm,
    filteredTags,
    tagSearchTerm,
    facesList,
    faceSearchTerm,
    unknownFacesCount,
    faceViewType,
    unknownFacesRefreshTrigger
}) {
    /** @type {import('../types/PageState.js').ViewState} */
    // ViewState - Simplified to only essential properties
    // All mode checking (isSearchMode, isTagListMode, etc.) can be done via viewModeObj
    // All collection data (albumId/Name, tagId/Name) can be accessed via viewModeObj.getCollectionId/Name()
    const viewState = useMemo(() => ({
        mode: viewMode,
        currentDate: currentDate,
        viewModeObj: viewModeObj
    }), [viewMode, currentDate, viewModeObj]);

    /** @type {import('../types/PageState.js').FilterState} */
    const filterState = useMemo(() => ({
        star: starFilter,
        comment: hasCommentFilter,
        tag: hasTagFilter,
        extension: extensionFilter,
        importExtension: importExtensionFilter,
        showPopover: showFilterPopover,
        hasActiveFilters: hasActiveFiltersState
    }), [starFilter, hasCommentFilter, hasTagFilter, extensionFilter, importExtensionFilter, showFilterPopover, hasActiveFiltersState]);

    /** @type {import('../types/PageState.js').SelectionState} */
    // count is derived from photoList.length, so it's not stored in state
    const selectionState = useMemo(() => ({
        photos: photoSelectionDict,
        photoList: photoSelection,
        albums: selectedAlbums,
        tags: selectedTags,
        persons: selectedPersons,
        unknownFaces: selectedUnknownFaces
    }), [photoSelectionDict, photoSelection, selectedAlbums, selectedTags, selectedPersons, selectedUnknownFaces]);

    /** @type {import('../types/PageState.js').DisplayState} */
    const displayState = useMemo(() => ({
        currentPhotoPath: currentPhotoPath,
        currentPhotoIndex: currentPhotoIndex,
        showSideMenu: showSideMenu,
        iconSize: iconSize,
        sort: sortOfPhotos,
        importSort: importSortOfPhotos,
        scrollPosition: 0, // Will be managed in Phase 2
        datePage: datePage || {},
        numOfPhoto: numOfPhoto
    }), [currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize, sortOfPhotos, importSortOfPhotos, datePage, numOfPhoto]);

    /** @type {import('../types/PageState.js').SearchState} */
    // isSearchMode and isAdvancedSearchMode are derived from viewModeObj
    const searchState = useMemo(() => ({
        query: searchQuery,
        initialQuery: searchInitialQuery,
        filters: searchFilters,
        results: searchResults,
        currentParams: currentSearchParams
    }), [searchQuery, searchInitialQuery, searchFilters, searchResults, currentSearchParams]);

    /** @type {import('../types/PageState.js').PhotoDataState} */
    const photoDataState = useMemo(() => ({
        displayed: displayedPhotos,
        filtered: filteredPhotos,
        displayedCount: displayedPhotoCount,
        allForCurrentFetch: allPhotosForCurrentFetch,
        setAllForCurrentFetch: setAllPhotosForCurrentFetch
    }), [displayedPhotos, filteredPhotos, displayedPhotoCount, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch]);

    /** @type {import('../types/PageState.js').PhotoListMiniState} */
    const photoListMiniState = useMemo(() => ({
        allPhotos: photosListMiniAllPhotos,
        setAllPhotos: setPhotosListMiniAllPhotos,
        currentIndex: photosListMiniCurrentIndex,
        setCurrentIndex: setPhotosListMiniCurrentIndex,
        reread: photosListMiniReread,
        setReread: setPhotosListMiniReread
    }), [
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        photosListMiniReread,
        setPhotosListMiniReread
    ]);

    /** @type {import('../types/PageState.js').CacheState} */
    const cacheState = useMemo(() => ({
        imgCache: imgCacheMap,
        setImgCache: setImgCacheMap,
        thumbnailStore: thumbnailStore,
        setThumbnailStore: setThumbnailStore
    }), [imgCacheMap, setImgCacheMap, thumbnailStore, setThumbnailStore]);

    /** @type {import('../types/PageState.js').NavigationState} */
    const navigationState = useMemo(() => ({
        shortCut: shortCutNavigation,
        setShortCut: setShortCutNavigation
    }), [shortCutNavigation, setShortCutNavigation]);

    /** @type {import('../types/PageState.js').ConfigState} */
    const configState = useMemo(() => ({
        app: appConfig,
        import: importState,
        photos: photos
    }), [appConfig, importState, photos]);

    /** @type {import('../types/PageState.js').ListState} */
    const listState = useMemo(() => ({
        albums: {
            filtered: filteredAlbums,
            searchTerm: albumSearchTerm
        },
        tags: {
            filtered: filteredTags,
            searchTerm: tagSearchTerm
        },
        faces: {
            list: facesList,
            searchTerm: faceSearchTerm,
            unknownCount: unknownFacesCount,
            viewType: faceViewType,
            refreshTrigger: unknownFacesRefreshTrigger
        }
    }), [filteredAlbums, albumSearchTerm, filteredTags, tagSearchTerm, facesList, faceSearchTerm, unknownFacesCount, faceViewType, unknownFacesRefreshTrigger]);

    return {
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
    };
}
