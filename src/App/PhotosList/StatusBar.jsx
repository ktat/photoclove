import React from 'react';
import { ViewMode } from '../../domain/ViewMode.js';
import { VIEW_MODES } from '../../constants/viewModes.js';

/**
 * StatusBar Component
 * Extracted from PhotosList.jsx to reduce component complexity
 * Displays navigation, title, photo counts, and status information
 */
function StatusBar({
    viewMode,
    currentDate,
    currentAlbumName,
    currentTagName,
    searchQuery,
    isSearchMode,
    clearSearch,
    toggleAlbumListMode,
    openTagsList,
    toggleHome,
    filteredPhotos,
    infiniteScrollEnabled,
    displayedPhotoCount,
    isLimitedByConfig
}) {
    // Create ViewMode object for title generation
    const viewModeObj = new ViewMode(viewMode, {
        date: currentDate,
        albumName: currentAlbumName,
        tagName: currentTagName,
        searchQuery: searchQuery
    });
    
    const title = viewModeObj.getModeTitle();
    const photoCount = filteredPhotos.length;

    // Render navigation and title based on current mode
    const renderTitleAndNavigation = () => {
        if (viewMode === VIEW_MODES.ALBUM) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); toggleAlbumListMode(); }}>
                        Back to Album List
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title} ({photoCount} photos)</span>
                </>
            );
        } else if (viewMode === VIEW_MODES.TAG) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); openTagsList(); }}>
                        Back to Tag List
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title} ({photoCount} photos)</span>
                </>
            );
        } else {
            // For SEARCH, TRASH, and other modes - no back link
            return <span>{title} ({photoCount} photos)</span>;
        }
    };

    return (
        <div className="photo-page-info">
            {renderTitleAndNavigation()}
            {infiniteScrollEnabled && displayedPhotoCount < filteredPhotos.length && (
                <span style={{ marginLeft: "10px", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                    {' '}- Showing: {displayedPhotoCount} photos
                </span>
            )}
            {isLimitedByConfig && (
                <span style={{ marginLeft: "10px", fontSize: "var(--font-size-xs)", color: "var(--color-warning)", fontWeight: "bold" }}>
                    {' '}(Limited by config)
                </span>
            )}
        </div>
    );
}

export default StatusBar;