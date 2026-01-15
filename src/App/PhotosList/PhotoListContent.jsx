/**
 * PhotoListContent Component
 *
 * Main content area for photo list display
 * Handles both list mode (Albums/Tags) and photo grid mode
 *
 * Extracted from PhotosList.jsx lines 1652-1780
 *
 * Phase 1 Refactoring: Now uses state groups to reduce prop drilling
 * @see src/types/PageState.js for type definitions
 */

import { VIEW_MODES } from "../../constants/viewModes.js";
import ListViewHeader from "./ListViewHeader.jsx";
import GenericListView from "./GenericListView.jsx";
import BackNavigationLink from "../../components/BackNavigationLink.jsx";
import StatusBar from "./StatusBar.jsx";
import PhotosToolbar from "./PhotosToolbar.jsx";
import PhotoGrid from "./PhotoGrid.jsx";
import EmptyState from "./EmptyState.jsx";
import { logger } from "../../services/LoggerService.js";

/**
 * @param {Object} props
 * @param {boolean} props.photoLoading
 * @param {import('../../types/PageState.js').ViewState} props.viewState
 * @param {import('../../types/PageState.js').FilterState} props.filterState
 * @param {import('../../types/PageState.js').SelectionState} props.selectionState
 * @param {import('../../types/PageState.js').DisplayState} props.displayState
 * @param {import('../../types/PageState.js').SearchState} props.searchState
 * @param {import('../../types/PageState.js').PhotoDataState} props.photoDataState
 * @param {Object} props.handlers
 * @param {import('../../types/PageState.js').ListState} props.listState
 * @param {import('../../types/PageState.js').ConfigState} props.configState
 * @param {boolean} props.isLimitedByConfig
 * @param {number} props.configLimit
 * @param {string} props.debugMessage
 * @param {boolean} props.infiniteScrollEnabled
 * @param {Function} props.renderFilterClearingUI
 * @param {Object} props.filterButtonRef
 */
function PhotoListContent({
    photoLoading,
    viewState,
    filterState,
    selectionState,
    displayState,
    searchState,
    photoDataState,
    handlers,
    listState,
    configState,
    // Config
    isLimitedByConfig,
    configLimit,
    debugMessage,
    // Infinite scroll
    infiniteScrollEnabled,
    renderFilterClearingUI,
    filterButtonRef,
}) {
    // Destructure from state groups
    const { viewModeObj, mode: viewMode, currentDate } = viewState;

    // Destructure from list state
    const { albums, tags } = listState;
    const filteredAlbums = albums.filtered;
    const albumSearchTerm = albums.searchTerm;
    const filteredTags = tags.filtered;
    const tagSearchTerm = tags.searchTerm;

    // Destructure from config state
    const { import: importState, app: appConfig } = configState;
    const thumbnailOrientationCorrection = appConfig?.thumbnail_orientation_correction || false;

    // Debug log for orientation correction setting
    logger.info('PhotoListContent', 'config_check', 'Checking orientation correction setting', {
        thumbnailOrientationCorrection,
        hasAppConfig: !!appConfig,
        appConfigKeys: appConfig ? Object.keys(appConfig) : []
    });

    // Derive values from viewModeObj
    const currentAlbumName = viewModeObj.getCollectionName();
    const currentTagName = viewModeObj.getCollectionName();
    const recentPhotosMode = viewModeObj.isRecentMode();
    const isTagListMode = viewModeObj.isTagListMode();
    const isSearchMode = viewModeObj.isSearchMode();

    // Destructure photo data
    const { displayed: displayedPhotos, filtered: filteredPhotos, displayedCount: displayedPhotoCount } = photoDataState;

    const {
        star: starFilter,
        comment: hasCommentFilter,
        tag: hasTagFilter,
        extension: extensionFilter,
        importExtension: importExtensionFilter,
        showPopover: showFilterPopover,
        hasActiveFilters: hasActiveFiltersState
    } = filterState;

    const {
        photos: photoSelectionDict,
        albums: selectedAlbums,
        tags: selectedTags
    } = selectionState;

    const {
        currentPhotoPath,
        showSideMenu,
        iconSize,
        sort: sortOfPhotos,
        importSort: importSortOfPhotos,
        datePage
    } = displayState;

    const {
        query: searchQuery,
        currentParams: currentSearchParams
    } = searchState;

    const {
        addSelection,
        displayPhoto,
        loadMorePhotos: handleInfiniteScroll,
        handleAlbumSelection,
        handleTagSelection,
        handleAlbumClick,
        handleTagClick,
        handleNewAlbumClick,
        handleNewTagClick,
        clearSearch,
        clearAllFilters,
        setShowSideMenu,
        setIconSize,
        setSort,
        setImportSort,
        setShowFilterPopover,
        setAlbumSearchTerm,
        setTagSearchTerm,
        toggleAlbumListMode,
        openTagsList,
        toggleHome
    } = handlers;
    return (
        <div className={(showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"}
             id="photoList"
             style={{ display: (!photoLoading && !currentPhotoPath) ? "block" : "none" }}
             data-date={viewModeObj.isRecentMode() ? "recent" : viewModeObj.getDataAttribute()}
             data-page={recentPhotosMode ? (datePage["recent"] || 1) : (isSearchMode ? (datePage["search_results"] || 1) : 1)}>
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
                        {displayedPhotos.length === 0 && (
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
                                <PhotosToolbar
                                    iconSize={iconSize}
                                    setIconSize={setIconSize}
                                    sortOfPhotos={viewModeObj.isImportMode() ? importSortOfPhotos : sortOfPhotos}
                                    setSort={viewModeObj.isImportMode() ? setImportSort : setSort}
                                    showFilterPopover={showFilterPopover}
                                    setShowFilterPopover={setShowFilterPopover}
                                    filterButtonRef={filterButtonRef}
                                    starFilter={starFilter}
                                    hasCommentFilter={hasCommentFilter}
                                    hasTagFilter={hasTagFilter}
                                    extensionFilter={viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter}
                                    hasActiveFilters={hasActiveFiltersState}
                                />
                            </div>
                            : <div>
                                <>
                                    <EmptyState viewModeObj={viewModeObj} searchQuery={searchQuery} searchParams={currentSearchParams} />
                                    {renderFilterClearingUI()}
                                </>
                            </div>
                        }
                        {/* Only render PhotoGrid when there are photos to display */}
                        {displayedPhotos.length > 0 && (
                            <PhotoGrid
                                displayedPhotos={displayedPhotos}
                                totalPhotosCount={filteredPhotos.length}
                                allPhotos={filteredPhotos}
                                iconSize={iconSize}
                                photoSelectionDict={photoSelectionDict}
                                onAddSelection={addSelection}
                                onDisplayPhoto={displayPhoto}
                                isLimitedByConfig={isLimitedByConfig}
                                configLimit={configLimit}
                                starFilter={viewModeObj.isImportMode() ? 0 : starFilter}
                                hasCommentFilter={viewModeObj.isImportMode() ? false : hasCommentFilter}
                                hasTagFilter={viewModeObj.isImportMode() ? false : hasTagFilter}
                                extensionFilter={viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter}
                                onClearFilters={clearAllFilters}
                                importState={importState}
                                setShowSideMenu={setShowSideMenu}
                                thumbnailOrientationCorrection={thumbnailOrientationCorrection}
                            />
                        )}

                        <div className="debug" style={{ display: (debugMessage === "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                            {debugMessage}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default PhotoListContent;
