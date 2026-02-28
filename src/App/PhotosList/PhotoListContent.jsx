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

import React, { useState, useCallback } from 'react';
import { VIEW_MODES } from "../../constants/viewModes.js";
import { useUI } from "../../context/UIContext.jsx";
import ListViewHeader from "./ListViewHeader.jsx";
import GenericListView from "./GenericListView.jsx";
import TagCloudView from "./TagCloudView.jsx";
import FacesList from "./FacesList.jsx";
import FaceThumbnail from "../../components/FaceThumbnail.jsx";
import BackNavigationLink from "../../components/BackNavigationLink.jsx";
import StatusBar from "./StatusBar.jsx";
import PhotosToolbar from "./PhotosToolbar.jsx";
import PhotoGrid from "./PhotoGrid.jsx";
import EmptyState from "./EmptyState.jsx";
import SlideShow from "../../components/SlideShow.jsx";
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
    configLimit: _configLimit,
    debugMessage,
    // Infinite scroll
    infiniteScrollEnabled,
    renderFilterClearingUI,
    filterButtonRef,
}) {
    // Get burst mode from UI context
    const { burstModeEnabled } = useUI();

    // Slideshow state
    const [showSlideshow, setShowSlideshow] = useState(false);
    const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);

    // Destructure from state groups
    const { viewModeObj, mode: viewMode, currentDate } = viewState;

    // Destructure from list state
    const { albums, tags, faces } = listState;
    const filteredAlbums = albums.filtered;
    const albumSearchTerm = albums.searchTerm;
    const filteredTags = tags.filtered;
    const tagSearchTerm = tags.searchTerm;
    const facesList = faces?.list || [];
    const faceSearchTerm = faces?.searchTerm || '';
    const unknownFacesCount = faces?.unknownCount || 0;
    const faceViewType = faces?.viewType || 'persons';
    const unknownFacesRefreshTrigger = faces?.refreshTrigger || 0;

    // Destructure from config state
    const { import: importState, app: appConfig } = configState;
    const thumbnailOrientationCorrection = appConfig?.thumbnail_orientation_correction || false;

    // Derive values from viewModeObj
    const currentAlbumName = viewModeObj.getCollectionName();
    const currentTagName = viewModeObj.getCollectionName();
    const currentPersonName = viewModeObj.getCurrentPersonName();
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
        tags: selectedTags,
        persons: selectedPersons,
        unknownFaces: selectedUnknownFaces
    } = selectionState;

    const {
        currentPhoto,
        currentPhotoIndex,
        showSideMenu,
        iconSize,
        sort: sortOfPhotos,
        importSort: importSortOfPhotos,
        datePage
    } = displayState;

    const {
        query: searchQuery,
        currentParams: currentSearchParams,
        isSearching
    } = searchState;

    const {
        addSelection,
        displayPhoto,
        openBurstGroup,
        goBackFromBurstGroup,
        loadMorePhotos: handleInfiniteScroll,
        handleAlbumSelection,
        handleTagSelection,
        handlePersonSelection,
        handleUnknownFaceClick,
        handleUnknownFaceSelection,
        setFaceViewType,
        handleAlbumClick,
        handleTagClick,
        handleNewAlbumClick,
        handleNewTagClick,
        handlePersonClick,
        clearSearch,
        clearAllFilters,
        setShowSideMenu,
        setIconSize,
        setSort,
        setImportSort,
        setShowFilterPopover,
        setAlbumSearchTerm,
        setTagSearchTerm,
        setFaceSearchTerm,
        toggleAlbumListMode,
        openTagsList,
        openFacesList,
        toggleHome,
        refreshPhotosOnly,
        reloadAlbums,
        reloadTags,
        reloadFaces
    } = handlers;

    // Slideshow handlers
    const handleStartSlideshow = useCallback((startIndex = 0) => {
        logger.debug('PhotoListContent', 'slideshow_handler_called', 'handleStartSlideshow called', { startIndex, photoCount: displayedPhotos.length });
        if (displayedPhotos.length > 0) {
            const firstPhoto = displayedPhotos[0];
            logger.debug('PhotoListContent', 'slideshow_first_photo', 'First photo info', {
                hasDisplayPath: typeof firstPhoto?.displayPath === 'function',
                displayPath: typeof firstPhoto?.displayPath === 'function' ? firstPhoto.displayPath() : 'NOT_A_FUNCTION'
            });
            setSlideshowStartIndex(startIndex);
            setShowSlideshow(true);
            logger.debug('PhotoListContent', 'slideshow_state_set', 'setShowSlideshow(true) called');
            logger.info('PhotoListContent', 'slideshow_start', 'Starting slideshow', {
                photoCount: displayedPhotos.length,
                startIndex
            });
        }
    }, [displayedPhotos.length]);

    const handleCloseSlideshow = useCallback(() => {
        setShowSlideshow(false);
        logger.info('PhotoListContent', 'slideshow_close', 'Slideshow closed');
    }, []);

    // Wrapper for openBurstGroup to include current view mode data
    // This ensures that when returning from burst group, the context (album/tag) and photo position are preserved
    // photoIndex parameter is passed from PhotoCard when clicking burst badge in PhotoGrid
    const handleOpenBurstGroup = useCallback((burstGroupId, photoIndex) => {
        // Determine return mode based on current view mode
        let returnMode = null;
        let returnModeData = null;

        // Use photoIndex if provided (from PhotoGrid click), otherwise use currentPhotoIndex (from PhotoViewer)
        const indexToRestore = typeof photoIndex === 'number' ? photoIndex : currentPhotoIndex;

        if (viewModeObj.isAlbumMode()) {
            returnMode = VIEW_MODES.ALBUM;
            returnModeData = {
                albumId: viewModeObj.getCurrentAlbumId(),
                albumName: viewModeObj.getCollectionName(),
                currentPhotoIndex: indexToRestore
            };
        } else if (viewModeObj.isTagMode()) {
            returnMode = VIEW_MODES.TAG;
            returnModeData = {
                tagId: viewModeObj.getCurrentTagId(),
                tagName: viewModeObj.getCollectionName(),
                currentPhotoIndex: indexToRestore
            };
        } else {
            // For date view or other modes, store the photo index
            returnModeData = {
                currentPhotoIndex: indexToRestore
            };
        }

        logger.info('PhotoListContent', 'open_burst_group', 'Opening burst group with return mode data', {
            burstGroupId,
            returnMode,
            returnModeData,
            photoIndex,
            currentPhotoIndex
        });

        openBurstGroup(burstGroupId, returnMode, returnModeData);
    }, [viewModeObj, openBurstGroup, currentPhotoIndex]);

    // Handler for back navigation from Unknown Faces photo list
    const handleBackToUnknownFaces = useCallback(() => {
        setFaceViewType('unknown');
        openFacesList();
    }, [setFaceViewType, openFacesList]);

    // Tag list view mode (list or cloud) with localStorage persistence
    const TAG_VIEW_MODE_KEY = 'photoclove-tag-list-view-mode';
    const [tagListViewMode, setTagListViewMode] = useState(() => {
        return localStorage.getItem(TAG_VIEW_MODE_KEY) || 'list';
    });

    // Persist tag list view mode to localStorage
    const handleTagListViewModeChange = (mode) => {
        setTagListViewMode(mode);
        localStorage.setItem(TAG_VIEW_MODE_KEY, mode);
        logger.info('PhotoListContent', 'tag_list_view_mode_changed', 'Tag list view mode changed', { mode });
    };

    return (
        <div className={(showSideMenu || !currentPhoto) ? "centerDisplay" : "centerDisplayMax"}
             id="photoList"
             style={{ display: (!photoLoading && !currentPhoto) ? "block" : "none" }}
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

                    // Show cloud view for tags when tagListViewMode is 'cloud'
                    const showCloudView = !isAlbumList && tagListViewMode === 'cloud';

                    return (
                        <>
                            <ListViewHeader
                                title={listConfig.title}
                                count={listConfig.count}
                                itemType={listConfig.itemType}
                                iconSize={iconSize}
                                onIconSizeChange={setIconSize}
                                viewMode={tagListViewMode}
                                onViewModeChange={handleTagListViewModeChange}
                                showViewModeToggle={!isAlbumList}
                                onRefresh={isAlbumList ? reloadAlbums : reloadTags}
                            />
                            {showCloudView ? (
                                <TagCloudView
                                    items={listConfig.items}
                                    selectedItems={listConfig.selectedItems}
                                    onItemSelection={listConfig.onItemSelection}
                                    onItemClick={listConfig.onItemClick}
                                    searchTerm={listConfig.searchTerm}
                                    onSearchChange={listConfig.onSearchChange}
                                    onNewItemClick={listConfig.onNewItemClick}
                                />
                            ) : (
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
                            )}
                        </>
                    );
                })()}

                {/* Face List Mode */}
                {viewMode === VIEW_MODES.FACE_LIST && (
                    <>
                        <ListViewHeader
                            title="Faces"
                            count={facesList.length}
                            itemType="faces"
                            iconSize={iconSize}
                            onIconSizeChange={setIconSize}
                            showViewModeToggle={false}
                            onRefresh={reloadFaces}
                        />
                        <FacesList
                            persons={facesList}
                            iconSize={iconSize}
                            onPersonClick={handlePersonClick}
                            onFaceClick={handleUnknownFaceClick}
                            selectedPersons={selectedPersons}
                            onPersonSelection={handlePersonSelection}
                            selectedUnknownFaces={selectedUnknownFaces}
                            onUnknownFaceSelection={handleUnknownFaceSelection}
                            searchTerm={faceSearchTerm}
                            onSearchChange={setFaceSearchTerm}
                            onRefresh={reloadFaces}
                            unknownFacesCount={unknownFacesCount}
                            viewType={faceViewType}
                            onViewTypeChange={setFaceViewType}
                            unknownFacesRefreshTrigger={unknownFacesRefreshTrigger}
                        />
                    </>
                )}

                {/* Regular Photo Display Mode */}
                {viewMode !== VIEW_MODES.ALBUM_LIST && viewMode !== VIEW_MODES.TAG_LIST && viewMode !== VIEW_MODES.FACE_LIST && (
                    <>
                        {displayedPhotos.length === 0 && (
                            <BackNavigationLink
                                viewModeObj={viewModeObj}
                                clearSearch={clearSearch}
                                toggleAlbumListMode={toggleAlbumListMode}
                                openTagsList={openTagsList}
                                openFacesList={openFacesList}
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
                                    currentPersonName={currentPersonName}
                                    searchQuery={searchQuery}
                                    toggleAlbumListMode={toggleAlbumListMode}
                                    openTagsList={openTagsList}
                                    openFacesList={openFacesList}
                                    onBackToUnknownFaces={handleBackToUnknownFaces}
                                    goBackFromBurstGroup={goBackFromBurstGroup}
                                    isLimitedByConfig={isLimitedByConfig}
                                    onRefresh={refreshPhotosOnly}
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
                                    onStartSlideshow={() => handleStartSlideshow(0)}
                                    photosCount={displayedPhotos.length}
                                />
                            </div>
                            : <div>
                                {isSearching ? (
                                    <div className="empty-state-container">
                                        <div className="empty-state-content">
                                            <div className="empty-state-icon">
                                                <span className="empty-state-emoji">🔍</span>
                                            </div>
                                            <h2 className="empty-state-text">Searching...</h2>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <EmptyState viewModeObj={viewModeObj} searchQuery={searchQuery} searchParams={currentSearchParams} />
                                        {renderFilterClearingUI()}
                                    </>
                                )}
                            </div>
                        }
                        {/* Only render PhotoGrid when there are photos to display */}
                        {displayedPhotos.length > 0 && (
                            <PhotoGrid
                                displayedPhotos={displayedPhotos}
                                allPhotos={filteredPhotos}
                                iconSize={iconSize}
                                photoSelectionDict={photoSelectionDict}
                                onAddSelection={addSelection}
                                onDisplayPhoto={displayPhoto}
                                onOpenBurstGroup={handleOpenBurstGroup}
                                isInBurstGroupMode={viewModeObj?.isInBurstGroupMode()}
                                burstModeEnabled={burstModeEnabled}
                                starFilter={viewModeObj.isImportMode() ? 0 : starFilter}
                                hasCommentFilter={viewModeObj.isImportMode() ? false : hasCommentFilter}
                                hasTagFilter={viewModeObj.isImportMode() ? false : hasTagFilter}
                                extensionFilter={viewModeObj.isImportMode() ? importExtensionFilter : extensionFilter}
                                onClearFilters={clearAllFilters}
                                importState={importState}
                                setShowSideMenu={setShowSideMenu}
                                showSideMenu={showSideMenu}
                                thumbnailOrientationCorrection={thumbnailOrientationCorrection}
                            />
                        )}

                        <div className="debug" style={{ display: (debugMessage === "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                            {debugMessage}
                        </div>
                    </>
                )}
            </div>

            {/* Slideshow overlay */}
            {showSlideshow && filteredPhotos.length > 0 && (
                <SlideShow
                    photos={filteredPhotos}
                    startIndex={slideshowStartIndex}
                    onClose={handleCloseSlideshow}
                />
            )}
        </div>
    );
}

export default PhotoListContent;
