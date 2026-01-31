/**
 * usePhotosListHandlers - Hook for aggregating PhotosList handlers
 */
import { useMemo } from 'react';

/**
 * Hook for creating the handlers object for PhotosList
 * Aggregates all handler functions into a single memoized object
 *
 * @param {Object} handlers - Individual handler functions
 * @returns {Object} Memoized handlers object
 */
export function usePhotosListHandlers({
    // Photo display handlers
    closePhotoDisplay,
    displayPhoto,
    openBurstGroup,
    goBackFromBurstGroup,
    // Selection handlers
    toggleSelection,
    isPhotoSelected,
    addSelection,
    clearPhotoSelection,
    selectAllPhotoToSelection,
    // Photo loading handlers
    getPhotos,
    handleInfiniteScroll,
    reloadCurrentModeData,
    refreshPhotosOnly,
    reloadAlbums,
    reloadTags,
    // Trash handlers
    moveToTrashCan,
    updatePhotosAfterTrashOperation,
    deletePhotosHandler,
    restorePhotosHandler,
    permanentlyDeletePhoto,
    // Photo metadata handlers
    setStarWithUpdate,
    updatePhotoComment,
    removePhotoFromList,
    // Album handlers
    handleAlbumClick,
    handleAlbumSelection,
    handleNewAlbumClick,
    handleAlbumUpdate,
    handleAlbumDelete,
    clearAlbumSelection,
    deleteSelectedAlbums,
    // Tag handlers
    handleTagClick,
    handleTagSelection,
    handleNewTagClick,
    clearTagSelection,
    deleteSelectedTags,
    // Face handlers
    handlePersonClick,
    handlePersonSelection,
    clearPersonSelection,
    deleteSelectedPersons,
    handleUnknownFaceClick,
    handleUnknownFaceSelection,
    clearUnknownFaceSelection,
    setFaceSearchTerm,
    setFaceViewType,
    openFacesList,
    reloadFaces,
    // Search handlers
    handleSearch,
    clearSearch,
    handleFiltersChange,
    handleSavedSearchSelect,
    clearAllFilters,
    // UI state handlers
    setShowSideMenu,
    setIconSize,
    setSort,
    setImportSort,
    setCurrentPhotoPath,
    setCurrentPhotoIndex,
    setShowFilterPopover,
    setAlbumSearchTerm,
    setTagSearchTerm,
    // Navigation handlers
    changeTab,
    closeRightColumn,
    toggleAlbumListMode,
    openTagsList,
    toggleHome,
    // Error/Message handlers
    addFooterMessage,
    handleTauriError
}) {
    return useMemo(() => ({
        // Photo display
        closePhotoDisplay,
        displayPhoto,
        openBurstGroup,
        goBackFromBurstGroup,
        // Selection
        toggleSelection,
        isSelected: isPhotoSelected,
        addSelection,
        clearPhotoSelection,
        selectAllPhotoToSelection,
        // Photo loading
        getPhotos,
        loadMorePhotos: handleInfiniteScroll,
        reloadCurrentModeData,
        refreshPhotosOnly,
        reloadAlbums,
        reloadTags,
        // Trash operations
        moveToTrashCan,
        updatePhotosAfterTrashOperation,
        deletePhotos: deletePhotosHandler,
        restorePhotos: restorePhotosHandler,
        permanentlyDeletePhoto,
        // Photo metadata
        setStarWithUpdate,
        updatePhotoComment,
        removePhotoFromList,
        // Album operations
        handleAlbumClick,
        handleAlbumSelection,
        handleNewAlbumClick,
        handleAlbumUpdate,
        handleAlbumDelete,
        clearAlbumSelection,
        deleteSelectedAlbums,
        // Tag operations
        handleTagClick,
        handleTagSelection,
        handleNewTagClick,
        clearTagSelection,
        deleteSelectedTags,
        // Face operations
        handlePersonClick,
        handlePersonSelection,
        clearPersonSelection,
        deleteSelectedPersons,
        handleUnknownFaceClick,
        handleUnknownFaceSelection,
        clearUnknownFaceSelection,
        setFaceSearchTerm,
        setFaceViewType,
        openFacesList,
        reloadFaces,
        // Search operations
        handleSearch,
        clearSearch,
        handleFiltersChange,
        handleSavedSearchSelect,
        clearAllFilters,
        // UI state
        setShowSideMenu,
        setIconSize,
        setSort,
        setImportSort,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setShowFilterPopover,
        setAlbumSearchTerm,
        setTagSearchTerm,
        // Navigation
        changeTab,
        closeRightColumn,
        toggleAlbumListMode,
        openTagsList,
        toggleHome,
        // Error/Message
        addFooterMessage,
        handleTauriError
    }), [
        closePhotoDisplay, displayPhoto, openBurstGroup, goBackFromBurstGroup,
        toggleSelection, isPhotoSelected, addSelection, clearPhotoSelection, selectAllPhotoToSelection,
        getPhotos, handleInfiniteScroll, reloadCurrentModeData, refreshPhotosOnly, reloadAlbums, reloadTags,
        moveToTrashCan, updatePhotosAfterTrashOperation, deletePhotosHandler, restorePhotosHandler,
        permanentlyDeletePhoto,
        setStarWithUpdate, updatePhotoComment, removePhotoFromList,
        handleAlbumClick, handleAlbumSelection, handleNewAlbumClick, handleAlbumUpdate, handleAlbumDelete, clearAlbumSelection, deleteSelectedAlbums,
        handleTagClick, handleTagSelection, handleNewTagClick, clearTagSelection, deleteSelectedTags,
        handlePersonClick, handlePersonSelection, clearPersonSelection, deleteSelectedPersons, handleUnknownFaceClick, handleUnknownFaceSelection, clearUnknownFaceSelection, setFaceSearchTerm, setFaceViewType, openFacesList, reloadFaces,
        handleSearch, clearSearch, handleFiltersChange, handleSavedSearchSelect,
        clearAllFilters,
        setShowSideMenu, setIconSize, setSort, setImportSort, setCurrentPhotoPath, setCurrentPhotoIndex, setShowFilterPopover, setAlbumSearchTerm, setTagSearchTerm,
        changeTab, closeRightColumn, toggleAlbumListMode, openTagsList, toggleHome,
        addFooterMessage, handleTauriError
    ]);
}

export default usePhotosListHandlers;
