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
    toggleAlbumListMode,
    openTagsList,
    goBackFromBurstGroup,
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

    // Render navigation and title based on current mode
    const renderTitleAndNavigation = () => {
        if (viewMode === VIEW_MODES.ALBUM) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); toggleAlbumListMode(); }}>
                        Back to Album List
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title}</span>
                </>
            );
        } else if (viewMode === VIEW_MODES.TAG) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); openTagsList(); }}>
                        Back to Tag List
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title}</span>
                </>
            );
        } else if (viewMode === VIEW_MODES.IN_BURST_GROUP) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); goBackFromBurstGroup && goBackFromBurstGroup(); }}>
                        ← Back
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title}</span>
                </>
            );
        } else {
            // For SEARCH, TRASH, and other modes - no back link
            return <span>{title}</span>;
        }
    };

    return (
        <div className="photo-page-info">
            {renderTitleAndNavigation()}
            {isLimitedByConfig && (
                <span style={{ marginLeft: "10px", fontSize: "var(--font-size-xs)", color: "var(--color-warning)", fontWeight: "bold" }}>
                    {' '}(Limited by config)
                </span>
            )}
        </div>
    );
}

export default StatusBar;