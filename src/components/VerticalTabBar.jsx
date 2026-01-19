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
    selectedTagsCount = 0
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

    return (
        <div className={`directory-vertical-tabs ${showSideMenu ? 'menu-open' : 'menu-closed'}`}>
            {availableTabs.map(tab => {
                // Generate className - use shared utility for Selection tab (Feature #152)
                const className = tab.id === 'selection'
                    ? getSelectionTabClassName(
                        tabClass[tab.id],
                        photoSelectionCount,
                        selectedAlbumsCount,
                        selectedTagsCount,
                        'directory-vertical-tab-button'
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