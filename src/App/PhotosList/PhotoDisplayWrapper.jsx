/**
 * PhotoDisplayWrapper Component
 *
 * Wraps PhotosListMini (fullscreen photo display) with necessary context providers
 * and conditional display logic.
 *
 * Extracted from PhotosList.jsx lines 1585-1651
 *
 * Phase 1 Refactoring: Now uses state groups to reduce prop drilling
 * @see src/types/PageState.js for type definitions
 */

import { useCallback } from 'react';
import { AllPhotosContext, ImgCacheContext } from "../ImgCacheContext.jsx";
import PhotosListMini from "./PhotosListMini.jsx";
import { VIEW_MODES } from "../../constants/viewModes.js";

/**
 * @param {Object} props
 * @param {boolean} props.photoLoading
 * @param {import('../../types/PageState.js').ViewState} props.viewState
 * @param {import('../../types/PageState.js').FilterState} props.filterState
 * @param {import('../../types/PageState.js').DisplayState} props.displayState
 * @param {import('../../types/PageState.js').SearchState} props.searchState
 * @param {Object} props.handlers
 * @param {import('../../types/PageState.js').PhotoListMiniState} props.photoListMiniState
 * @param {import('../../types/PageState.js').CacheState} props.cacheState
 * @param {import('../../types/PageState.js').NavigationState} props.navigationState
 * @param {import('../../types/PageState.js').ConfigState} props.configState
 */
function PhotoDisplayWrapper({
    photoLoading,
    viewState,
    filterState,
    displayState,
    searchState,
    handlers,
    photoListMiniState,
    cacheState,
    navigationState,
    configState,
    beforeNavigate
}) {
    // Destructure from state groups
    const { allPhotos: photosListMiniAllPhotos, setAllPhotos: setPhotosListMiniAllPhotos, currentIndex: photosListMiniCurrentIndex, setCurrentIndex: setPhotosListMiniCurrentIndex, reread: photosListMiniReread } = photoListMiniState;
    const { imgCache: imgCacheMap, setImgCache: setImgCacheMap } = cacheState;
    const { shortCut: shortCutNavigation, setShortCut: setShortCutNavigation } = navigationState;
    const { app: appConfig, import: importState, photos } = configState;

    // Destructure from state groups for cleaner code
    const { viewModeObj, currentDate } = viewState;

    // Derive values from viewModeObj
    const currentAlbumId = viewModeObj.getCurrentAlbumId();
    const currentTagId = viewModeObj.getCurrentTagId();
    // For collection name, prefer album name over tag name when both could exist
    const currentAlbumName = viewModeObj.isAlbumMode() || (viewModeObj.isInBurstGroupMode() && viewModeObj.getCurrentAlbumId())
        ? viewModeObj.getCollectionName() : null;
    const currentTagName = viewModeObj.isTagMode() || (viewModeObj.isInBurstGroupMode() && viewModeObj.getCurrentTagId())
        ? viewModeObj.getCollectionName() : null;
    const recentPhotosMode = viewModeObj.isRecentMode();
    const isSearchMode = viewModeObj.isSearchMode();
    const { star: starFilter, comment: hasCommentFilter, extension: extensionFilter } = filterState;
    const { currentPhotoPath, currentPhotoIndex, showSideMenu, sort: sortOfPhotos, datePage, numOfPhoto } = displayState;
    const { query: searchQuery } = searchState;
    const {
        moveToTrashCan,
        deletePhotos,
        closePhotoDisplay,
        toggleSelection,
        isSelected,
        getPhotos,
        setCurrentPhotoPath,
        setCurrentPhotoIndex,
        setStarWithUpdate,
        removePhotoFromList,
        permanentlyDeletePhoto,
        updatePhotosAfterTrashOperation,
        addFooterMessage,
        handleTauriError,
        setShowSideMenu,
        clearSearch,
        openBurstGroup,
        goBackFromBurstGroup
    } = handlers;

    // Wrapper for openBurstGroup to include current view context and photo index
    // This ensures that when returning from burst group, the context and position are restored
    const handleOpenBurstGroup = useCallback((burstGroupId) => {
        let returnMode = null;
        let returnModeData = null;

        if (viewModeObj.isAlbumMode()) {
            returnMode = VIEW_MODES.ALBUM;
            returnModeData = {
                albumId: viewModeObj.getCurrentAlbumId(),
                albumName: viewModeObj.getCollectionName(),
                currentPhotoIndex: currentPhotoIndex
            };
        } else if (viewModeObj.isTagMode()) {
            returnMode = VIEW_MODES.TAG;
            returnModeData = {
                tagId: viewModeObj.getCurrentTagId(),
                tagName: viewModeObj.getCollectionName(),
                currentPhotoIndex: currentPhotoIndex
            };
        } else {
            // For date view or other modes, store the photo index
            returnModeData = {
                currentPhotoIndex: currentPhotoIndex
            };
        }

        openBurstGroup(burstGroupId, returnMode, returnModeData);
    }, [viewModeObj, currentPhotoIndex, openBurstGroup]);

    // Compute derived values
    const shouldDisplay = !photoLoading && currentPhotoPath;

    if (!shouldDisplay) return null;

    return (
        <div id="photos-display-wrapper">
            <AllPhotosContext.Provider value={{ photosListMiniAllPhotos, setPhotosListMiniAllPhotos }}>
                <ImgCacheContext.Provider value={{ imgCacheMap, setImgCacheMap }}>
                    <div className="photo-display">
                        <PhotosListMini
                            moveToTrashCan={moveToTrashCan}
                            deletePhotos={deletePhotos}
                            closePhotoDisplay={closePhotoDisplay}
                            toggleSelection={toggleSelection}
                            isSelected={isSelected}
                            setShortCutNavigation={setShortCutNavigation}
                            shortCutNavigation={shortCutNavigation}
                            getPhotos={getPhotos}
                            currentPhotoPath={currentPhotoPath}
                            setCurrentPhotoPath={setCurrentPhotoPath}
                            sortOfPhotos={sortOfPhotos}
                            currentDate={currentDate}
                            datePage={datePage}
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
                            config={appConfig}
                            setCurrentIndex={setPhotosListMiniCurrentIndex}
                            setShowSideMenu={setShowSideMenu}
                            showSideMenu={showSideMenu}
                            centerDisplayClass={showSideMenu ? "centerDisplay" : "centerDisplayMax"}
                            searchMode={isSearchMode}
                            searchQuery={searchQuery}
                            onClearSearch={clearSearch}
                            recentPhotosMode={recentPhotosMode}
                            albumId={currentAlbumId}
                            albumName={currentAlbumName}
                            tagId={currentTagId}
                            tagName={currentTagName}
                            removePhotoFromList={removePhotoFromList}
                            permanentlyDeletePhoto={permanentlyDeletePhoto}
                            updatePhotosAfterTrashOperation={updatePhotosAfterTrashOperation}
                            addFooterMessage={addFooterMessage}
                            handleTauriError={handleTauriError}
                            importState={importState}
                            beforeNavigate={beforeNavigate}
                            openBurstGroup={handleOpenBurstGroup}
                            goBackFromBurstGroup={goBackFromBurstGroup}
                        />
                    </div>
                </ImgCacheContext.Provider>
            </AllPhotosContext.Provider>
        </div>
    );
}

export default PhotoDisplayWrapper;
