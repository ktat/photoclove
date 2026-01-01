/**
 * useViewModeObject Hook
 * React integration hook for ViewMode domain value object.
 * 
 * This hook bridges the gap between the pure domain model (ViewMode)
 * and React's component lifecycle, providing a clean API for components.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ViewMode } from '../domain/ViewMode.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';

/**
 * Custom hook for managing ViewMode state in React components
 * @param {string} initialMode - Initial view mode (defaults to HOME)
 * @param {Object} initialData - Initial mode data
 * @param {Object} appConfig - Application configuration for limits and settings
 * @returns {Object} ViewMode state and operations
 */
export const useViewModeObject = (initialMode = VIEW_MODES.HOME, initialData = {}, appConfig = null) => {
    // Create initial ViewMode value object
    const [viewModeObj, setViewModeObj] = useState(() => {
        try {
            return new ViewMode(initialMode, initialData);
        } catch (error) {
            logger.error('useViewModeObject', 'initialization_error', 'Failed to create initial ViewMode', { 
                initialMode, 
                initialData, 
                error: error.message 
            });
            return ViewMode.home(); // Fallback to home mode
        }
    });

    // History for navigation
    const [history, setHistory] = useState([viewModeObj]);

    // Transition to new mode with validation and logging
    const transitionTo = useCallback((newMode, newData = {}) => {
        try {
            const newViewMode = new ViewMode(newMode, newData);
            
            setViewModeObj(newViewMode);
            setHistory(prev => [...prev, newViewMode]);
            
            logger.info('useViewModeObject', 'mode_transition', 'View mode changed', {
                fromMode: viewModeObj.mode,
                toMode: newMode,
                fromData: viewModeObj.data,
                toData: newData
            });
            
            return true;
        } catch (error) {
            logger.error('useViewModeObject', 'transition_error', 'Failed to transition to new mode', {
                currentMode: viewModeObj.mode,
                targetMode: newMode,
                targetData: newData,
                error: error.message
            });
            return false;
        }
    }, [viewModeObj]);

    // Update current mode data without changing mode
    const updateData = useCallback((newData) => {
        try {
            const updatedViewMode = viewModeObj.withData(newData);
            setViewModeObj(updatedViewMode);
            
            logger.debug('useViewModeObject', 'data_update', 'View mode data updated', {
                mode: viewModeObj.mode,
                oldData: viewModeObj.data,
                newData: updatedViewMode.data
            });
            
            return true;
        } catch (error) {
            logger.error('useViewModeObject', 'data_update_error', 'Failed to update view mode data', {
                mode: viewModeObj.mode,
                currentData: viewModeObj.data,
                newData,
                error: error.message
            });
            return false;
        }
    }, [viewModeObj]);

    // Go back to previous mode
    const goBack = useCallback(() => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop(); // Remove current mode
            const previousViewMode = newHistory[newHistory.length - 1];
            
            setViewModeObj(previousViewMode);
            setHistory(newHistory);
            
            logger.info('useViewModeObject', 'go_back', 'Returned to previous mode', {
                fromMode: viewModeObj.mode,
                toMode: previousViewMode.mode,
                historyLength: newHistory.length
            });
            
            return true;
        }
        
        logger.debug('useViewModeObject', 'go_back_failed', 'No previous mode in history');
        return false;
    }, [history, viewModeObj]);

    // Check if we can go back
    const canGoBack = useMemo(() => {
        return history.length > 1;
    }, [history.length]);

    // Factory methods for easy mode creation
    const factoryMethods = useMemo(() => ({
        goHome: () => transitionTo(VIEW_MODES.HOME),
        showDate: (date) => transitionTo(VIEW_MODES.DATE, { date }),
        showRecent: () => transitionTo(VIEW_MODES.RECENT),
        showSearch: (searchQuery = "", isAdvanced = false) => {
            // Always use SEARCH mode - Advanced Search has been unified with regular Search
            return transitionTo(VIEW_MODES.SEARCH, { searchQuery, isAdvanced });
        },
        showAlbum: (albumId) => transitionTo(VIEW_MODES.ALBUM, { albumId }),
        showAlbumList: () => transitionTo(VIEW_MODES.ALBUM_LIST),
        showTag: (tagId) => transitionTo(VIEW_MODES.TAG, { tagId }),
        showTagList: () => transitionTo(VIEW_MODES.TAG_LIST),
        showTrash: () => transitionTo(VIEW_MODES.TRASH),
        showImport: () => transitionTo(VIEW_MODES.IMPORT),
        showPreferences: () => transitionTo(VIEW_MODES.PREFERENCES),
        showJobQueue: () => transitionTo(VIEW_MODES.JOB_QUEUE),
        showLogin: () => transitionTo(VIEW_MODES.LOGIN)
    }), [transitionTo]);

    // Legacy compatibility - expose individual boolean checks
    const legacyMethods = useMemo(() => ({
        isAlbumMode: viewModeObj.isAlbumMode(),
        isAlbumListMode: viewModeObj.isAlbumListMode(),
        isTagMode: viewModeObj.isTagMode(),
        isTagListMode: viewModeObj.isTagListMode(),
        isSearchMode: viewModeObj.isSearchMode(),
        isAdvancedSearchMode: viewModeObj.isAdvancedSearchMode(),
        isTrashMode: viewModeObj.isTrashMode(),
        isDateMode: viewModeObj.isDateMode(),
        isRecentMode: viewModeObj.isRecentMode(),
        isHomeMode: viewModeObj.isHomeMode(),
        isImportMode: viewModeObj.isImportMode(),
        isPreferencesMode: viewModeObj.isPreferencesMode(),
        isJobQueueMode: viewModeObj.isJobQueueMode(),
        isLoginMode: viewModeObj.isLoginMode(),
        
        // Computed properties
        currentAlbumId: viewModeObj.getCurrentAlbumId(),
        currentTagId: viewModeObj.getCurrentTagId(),
        currentDate: viewModeObj.getCurrentDate(),
        searchQuery: viewModeObj.getSearchQuery()
    }), [viewModeObj]);

    // Screen visibility state
    const screenVisibility = useMemo(() => {
        return viewModeObj.getScreenVisibility();
    }, [viewModeObj]);

    // Available operations in current mode
    const availableOperations = useMemo(() => {
        return viewModeObj.getAvailableOperations();
    }, [viewModeObj]);

    // Filter parameters for current mode
    const filterParams = useMemo(() => {
        return viewModeObj.getFilterParams(appConfig);
    }, [viewModeObj, appConfig]);

    // Effect to log mode changes
    useEffect(() => {
        logger.debug('useViewModeObject', 'mode_active', `Current view mode: ${viewModeObj.mode}`, {
            mode: viewModeObj.mode,
            data: viewModeObj.data,
            historyLength: history.length
        });
    }, [viewModeObj, history.length]);

    return {
        // Core ViewMode object (immutable)
        viewMode: viewModeObj,
        
        // Raw mode string for compatibility
        currentMode: viewModeObj.mode,
        modeData: viewModeObj.data,
        
        // State management
        transitionTo,
        updateData,
        goBack,
        canGoBack,
        history: history.map(vm => vm.mode), // Return just mode strings for compatibility
        
        // Factory methods
        ...factoryMethods,
        
        // Legacy boolean methods (computed)
        ...legacyMethods,
        
        // Computed state
        ...screenVisibility,
        ...availableOperations,
        
        // Utility methods
        dataAttribute: viewModeObj.getDataAttribute(),
        filterParams,
        
        // ViewMode object methods (direct access)
        shouldShowSelectionTab: viewModeObj.shouldShowSelectionTab(),
        shouldShowAlbumTab: viewModeObj.shouldShowAlbumTab(),
        shouldShowSearchTools: viewModeObj.shouldShowSearchTools(),
        shouldShowTrashOperations: viewModeObj.shouldShowTrashOperations(),
        
        // Helper methods
        getLoaderFunction: (loaderMap) => viewModeObj.getLoaderFunction(loaderMap),
        toString: () => viewModeObj.toString(),
        equals: (other) => viewModeObj.equals(other)
    };
};

export default useViewModeObject;