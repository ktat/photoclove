/**
 * SideMenuWrapper Component
 *
 * Wrapper for the DirectoryMenu (side menu) with conditional display logic
 *
 * Extracted from PhotosList.jsx lines 1827-1894
 *
 * Phase 1 Refactoring: Now uses state groups to reduce prop drilling
 * @see src/types/PageState.js for type definitions
 */

import DirectoryMenu from "./DirectoryMenu.jsx";
import SearchTools from "../../components/SearchTools.jsx";

/**
 * @param {Object} props
 * @param {import('../../types/PageState.js').ViewState} props.viewState
 * @param {import('../../types/PageState.js').FilterState} props.filterState
 * @param {import('../../types/PageState.js').SelectionState} props.selectionState
 * @param {import('../../types/PageState.js').DisplayState} props.displayState
 * @param {import('../../types/PageState.js').SearchState} props.searchState
 * @param {import('../../types/PageState.js').PhotoDataState} props.photoDataState
 * @param {Object} props.handlers
 * @param {string} props.tabClass
 * @param {Function} props.setTabClass
 * @param {Object} props.dateNum
 * @param {Function} props.updateDateNum
 * @param {Array} props.dateList
 * @param {Function} props.updateDateList
 * @param {Function} props.setShowJobQueueModal
 * @param {Object} props.filterOptions
 * @param {Function} props.loadFilterOptions
 * @param {boolean} props.isFilterOptionsLoading
 * @param {Object} props.importState
 * @param {Array} props.albumsList
 * @param {Array} props.tagsList
 */
function SideMenuWrapper({
    viewState,
    filterState,
    selectionState,
    displayState,
    searchState,
    photoDataState,
    listState,
    handlers,
    tabClass,
    setTabClass,
    dateNum,
    updateDateNum,
    dateList,
    updateDateList,
    setShowJobQueueModal,
    filterOptions,
    loadFilterOptions,
    isFilterOptionsLoading,
    importState,
    albumsList,
    tagsList,
    config,
    saveConfigWithStartupImages,
}) {
    // Destructure from state groups
    const { viewModeObj, currentDate } = viewState;
    const isSearchMode = viewModeObj.isSearchMode();
    const { star: starFilter, extension: extensionFilter } = filterState;
    const { allForCurrentFetch: allPhotosForCurrentFetch, setAllForCurrentFetch: setAllPhotosForCurrentFetch } = photoDataState;
    const { photoList: photoSelection, albums: selectedAlbums, tags: selectedTags, persons: selectedPersons, unknownFaces: selectedUnknownFaces } = selectionState;
    const { currentPhotoPath, showSideMenu } = displayState;
    const { query: searchQuery, initialQuery: searchInitialQuery, filters: searchFilters, results: searchResults, currentParams: currentSearchParams } = searchState;
    const isAdvancedSearchMode = viewModeObj.isAdvancedSearchMode();
    const {
        clearPhotoSelection,
        selectAllPhotoToSelection,
        setCurrentDateNum,
        moveToTrashCan,
        getPhotos,
        reloadCurrentModeData,
        refreshPhotosOnly,
        updatePhotosAfterTrashOperation,
        deletePhotos,
        restorePhotos,
        removePhotoFromList,
        setStarFilter,
        setHasCommentFilter,
        setExtensionFilter,
        setShowSideMenu,
        handleSearch,
        clearSearch,
        handleFiltersChange,
        handleSavedSearchSelect,
        clearAlbumSelection,
        clearTagSelection,
        clearPersonSelection,
        clearUnknownFaceSelection,
        deleteSelectedAlbums,
        deleteSelectedTags,
        deleteSelectedPersons,
        changeTab,
        closeRightColumn,
        addFooterMessage
    } = handlers;
    if (!showSideMenu) return null;

    return (
        <div className="rightMenu">
            <div style={{ display: !currentPhotoPath ? "block" : "none" }}>
                <DirectoryMenu
                    viewModeObj={viewModeObj}
                    addFooterMessage={addFooterMessage}
                    tabClass={tabClass}
                    setTabClass={setTabClass}
                    changeTab={changeTab}
                    currentDate={currentDate}
                    closeRightColumn={closeRightColumn}
                    photoSelection={photoSelection}
                    clearPhotoSelection={clearPhotoSelection}
                    selectAllPhotoToSelection={selectAllPhotoToSelection}
                    dateNum={dateNum}
                    setDateNum={updateDateNum}
                    dateList={dateList}
                    setDateList={updateDateList}
                    setCurrentDateNum={setCurrentDateNum}
                    moveToTrashCan={moveToTrashCan}
                    onPhotosRefresh={refreshPhotosOnly}
                    reloadCurrentModeData={reloadCurrentModeData}
                    updatePhotosAfterTrashOperation={updatePhotosAfterTrashOperation}
                    deletePhotos={deletePhotos}
                    restorePhotos={restorePhotos}
                    removePhotoFromList={removePhotoFromList}
                    allPhotosForCurrentFetch={allPhotosForCurrentFetch}
                    setAllPhotosForCurrentFetch={setAllPhotosForCurrentFetch}
                    setStarFilter={setStarFilter}
                    setHasCommentFilter={setHasCommentFilter}
                    starFilter={starFilter}
                    setExtensionFilter={setExtensionFilter}
                    extensionFilter={extensionFilter}
                    setShowSideMenu={setShowSideMenu}
                    setShowJobQueue={(show) => setShowJobQueueModal(show)}
                    searchMode={isSearchMode}
                    searchTools={isSearchMode ? (
                        <SearchTools
                            onSearch={handleSearch}
                            onClear={clearSearch}
                            searchResults={searchResults}
                            initialQuery={searchQuery || searchInitialQuery}
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
                    importState={importState}
                    selectedAlbums={selectedAlbums}
                    selectedTags={selectedTags}
                    selectedPersons={selectedPersons}
                    selectedUnknownFaces={selectedUnknownFaces}
                    albumsList={albumsList}
                    tagsList={tagsList}
                    facesList={listState?.faces?.list || []}
                    faceViewType={listState?.faces?.viewType || 'persons'}
                    clearAlbumSelection={clearAlbumSelection}
                    clearTagSelection={clearTagSelection}
                    clearPersonSelection={clearPersonSelection}
                    clearUnknownFaceSelection={clearUnknownFaceSelection}
                    deleteSelectedAlbums={deleteSelectedAlbums}
                    deleteSelectedTags={deleteSelectedTags}
                    deleteSelectedPersons={deleteSelectedPersons}
                    config={config}
                    saveConfigWithStartupImages={saveConfigWithStartupImages}
                />
            </div>
        </div>
    );
}

export default SideMenuWrapper;
