import { useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';
import { VIEW_MODES } from '../constants/viewModes.js';

/**
 * Custom hook for tab management in PhotosList
 *
 * Handles tab state and tab switching logic for different view modes:
 * - Directory tab (import mode only)
 * - Selection tab
 * - Filter tab
 * - Maintenance tab
 * - Search tab (search mode)
 *
 * @param {Object} params
 * @param {string} params.viewMode - Current view mode
 * @param {boolean} params.isSearchMode - Whether in search mode
 * @returns {Object} Tab management state and functions
 */
export function useTabManagement({ viewMode, isSearchMode }) {
    // Initialize tabs based on current view mode
    const [tabClass, setTabClass] = useState(() => {
        logger.debug('useTabManagement', 'init_tabs', 'Initializing tab state', {
            viewMode,
            isSearchMode
        });

        if (viewMode === VIEW_MODES.IMPORT) {
            return {
                'directory': true,  // Default to directory tab in import mode
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': false,
            };
        } else {
            return {
                'maintenance': false,
                'selection': false,
                'search': isSearchMode,
                'filter': false,
                'directory': false,
            };
        }
    });

    /**
     * Change the active tab
     *
     * @param {Event} e - Click event (optional)
     * @param {string} t - Tab identifier (e.g., "#tab-selection")
     */
    const changeTab = useCallback((e, t) => {
        if (e) e.preventDefault();

        const tabName = t.replace(/^.*#tab-/, '');

        logger.info('useTabManagement', 'change_tab', 'Switching tab', {
            from: Object.keys(tabClass).find(key => tabClass[key]),
            to: tabName,
            viewMode
        });

        const newTabState = {
            'filter': false,
            'maintenance': false,
            'selection': false,
            'search': false,
            'directory': false,
        };
        newTabState[tabName] = true;
        setTabClass(newTabState);
    }, [tabClass, viewMode]);

    /**
     * Clear all tab selections (used when closing the side panel)
     */
    const clearAllTabs = useCallback(() => {
        logger.info('useTabManagement', 'clear_all_tabs', 'Clearing all tab selections');
        setTabClass({
            'filter': false,
            'maintenance': false,
            'selection': false,
            'search': false,
            'directory': false,
        });
    }, []);

    return {
        tabClass,
        setTabClass,
        changeTab,
        clearAllTabs
    };
}
