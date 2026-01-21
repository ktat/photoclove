import React, { useState, useCallback } from 'react';
import { ViewMode } from '../../domain/ViewMode.js';
import { VIEW_MODES } from '../../constants/viewModes.js';
import { logger } from '../../services/LoggerService.js';
import styles from './StatusBar.module.css';

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
    isLimitedByConfig,
    onRefresh
}) {
    // Create ViewMode object for title generation
    const viewModeObj = new ViewMode(viewMode, {
        date: currentDate,
        albumName: currentAlbumName,
        tagName: currentTagName,
        searchQuery: searchQuery
    });

    const title = viewModeObj.getModeTitle();

    // Reload button state
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || isRefreshing) return;

        logger.info('StatusBar', 'refresh_clicked', 'Reload button clicked', { viewMode });
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    }, [onRefresh, isRefreshing, viewMode]);

    // Reload button component
    const ReloadButton = () => (
        onRefresh ? (
            <button
                className={`${styles.reloadButton} ${isRefreshing ? styles.spinning : ''}`}
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Reload photos"
                aria-label="Reload photos"
            >
                ↻
            </button>
        ) : null
    );

    // Render navigation and title based on current mode
    const renderTitleAndNavigation = () => {
        if (viewMode === VIEW_MODES.ALBUM) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); toggleAlbumListMode(); }}>
                        Back to Album List
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title}</span>
                    <ReloadButton />
                </>
            );
        } else if (viewMode === VIEW_MODES.TAG) {
            return (
                <>
                    <a className="back-to-home" href="#" onClick={(e) => { e.preventDefault(); openTagsList(); }}>
                        Back to Tag List
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title}</span>
                    <ReloadButton />
                </>
            );
        } else if (viewMode === VIEW_MODES.IN_BURST_GROUP) {
            return (
                <>
                    <a className="back-to-home no-home-icon" href="#" onClick={(e) => { e.preventDefault(); goBackFromBurstGroup && goBackFromBurstGroup(); }}>
                        ← Back
                    </a>
                    <span style={{ marginLeft: "10px" }}>{title}</span>
                    <ReloadButton />
                </>
            );
        } else {
            // For SEARCH, TRASH, DATE, RECENT, and other modes - no back link
            return (
                <>
                    <span>{title}</span>
                    <ReloadButton />
                </>
            );
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