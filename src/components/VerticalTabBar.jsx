import React from 'react';
import { VIEW_MODES } from '../constants/viewModes.js';
import { getSelectionTabClassName } from '../utils/tabClassUtils.js';
import './VerticalTabBar.css';

/**
 * Vertical tab bar component for side panel navigation
 * Shows different tabs based on current view mode
 */
function VerticalTabBar({
    viewMode,
    viewModeObj,
    showSideMenu,
    tabClass,
    changeTab,
    setShowSideMenu,
    closeRightColumn,
    clearAllTabs,
    photoSelectionCount = 0,
    selectedAlbumsCount = 0,
    selectedTagsCount = 0,
    selectedPersonsCount = 0,
    selectedUnknownFacesCount = 0,
    faceViewType = 'persons'
}) {
    // Define tab configurations based on view mode
    const getAvailableTabs = () => {
        const tabs = [];

        // Directory tab - only in import mode
        if (viewMode === VIEW_MODES.IMPORT) {
            tabs.push({
                id: 'directory',
                label: 'Directory',
                title: 'Directory Navigation',
                targetTab: '#tab-directory'
            });
        }

        // Search tab - only in search mode
        if (viewModeObj?.isSearchMode()) {
            tabs.push({
                id: 'search',
                label: 'Search',
                title: 'Search Tools',
                targetTab: '#tab-search'
            });
        }
        
        // Selection tab - always available
        tabs.push({
            id: 'selection',
            label: 'Selection',
            title: 'Photo Selection',
            targetTab: '#tab-selection'
        });

        // Share tab - available in standard photo modes (not import/trash)
        if (viewModeObj?.shouldShowPhotoSelection() && !viewModeObj?.isImportMode() && !viewModeObj?.isTrashMode()) {
            tabs.push({
                id: 'share',
                label: 'Share',
                title: 'Share Photos',
                targetTab: '#tab-share'
            });
        }

        // Maintenance tab - only in date mode
        if (viewModeObj?.shouldShowMaintenanceTab()) {
            tabs.push({
                id: 'maintenance',
                label: 'Maintenance',
                title: 'Maintenance Tools',
                targetTab: '#tab-maintenance'
            });
        }
        
        return tabs;
    };
    
    const handleTabClick = (e, targetTab) => {
        changeTab(e, targetTab);
        setShowSideMenu(true);
    };

    const availableTabs = getAvailableTabs();

    // Determine which selection counts to use based on current ViewMode
    const getRelevantSelectionCounts = () => {
        if (viewModeObj?.isAlbumListMode()) {
            // Album List mode - only album selections matter
            return { photos: 0, albums: selectedAlbumsCount, tags: 0, persons: 0, unknownFaces: 0 };
        } else if (viewModeObj?.isTagListMode()) {
            // Tag List mode - only tag selections matter
            return { photos: 0, albums: 0, tags: selectedTagsCount, persons: 0, unknownFaces: 0 };
        } else if (viewModeObj?.isFaceListMode()) {
            // Face List mode - check which tab is active
            if (faceViewType === 'unknown') {
                return { photos: 0, albums: 0, tags: 0, persons: 0, unknownFaces: selectedUnknownFacesCount };
            } else {
                return { photos: 0, albums: 0, tags: 0, persons: selectedPersonsCount, unknownFaces: 0 };
            }
        } else {
            // All other modes (DATE, ALBUM, TAG, PERSON, etc.) - only photo selections matter
            return { photos: photoSelectionCount, albums: 0, tags: 0, persons: 0, unknownFaces: 0 };
        }
    };

    const relevantCounts = getRelevantSelectionCounts();

    return (
        <div className={`directory-vertical-tabs ${showSideMenu ? 'menu-open' : 'menu-closed'}`}>
            {availableTabs.map(tab => {
                // Generate className - use shared utility for Selection tab (Feature #152)
                const className = tab.id === 'selection'
                    ? getSelectionTabClassName(
                        tabClass[tab.id],
                        relevantCounts.photos,
                        relevantCounts.albums,
                        relevantCounts.tags,
                        relevantCounts.persons,
                        'directory-vertical-tab-button',
                        relevantCounts.unknownFaces
                    )
                    : tabClass[tab.id]
                        ? "directory-vertical-tab-button active"
                        : "directory-vertical-tab-button";

                return (
                    <button
                        key={tab.id}
                        className={className}
                        onClick={(e) => handleTabClick(e, tab.targetTab)}
                        title={tab.title}
                        aria-label={tab.title}
                        aria-pressed={tabClass[tab.id]}
                    >
                        <span className="directory-vertical-text">{tab.label}</span>
                    </button>
                );
            })}
            
            {showSideMenu && (
                <button
                    className="directory-vertical-tab-button directory-close-tab"
                    onClick={() => {
                        clearAllTabs?.();
                        closeRightColumn();
                    }}
                    title="Close Panel"
                    aria-label="Close side panel"
                >
                    ×
                </button>
            )}
        </div>
    );
}

export default VerticalTabBar;