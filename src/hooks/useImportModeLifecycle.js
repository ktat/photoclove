/**
 * useImportModeLifecycle Hook
 *
 * Manages the lifecycle and state of Import Mode.
 * Extracted from PhotosList.jsx to reduce component complexity.
 *
 * Responsibilities:
 * - Initialize ImportState when entering import mode
 * - Set up import mode callbacks (directory change, filter change)
 * - Manage tab state for import mode
 * - Clear photo data when entering import mode
 * - Clean up ImportState when leaving import mode
 * - Handle search mode tab state
 */

import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VIEW_MODES } from '../constants/viewModes.js';
import { ImportState } from '../domain/ImportState.js';
import { logger } from '../services/LoggerService.js';
import { checkFirstActionAchievement } from '../services/AchievementService.js';

export function useImportModeLifecycle({
    viewMode,
    modeData,
    viewModeObj,
    importState,
    setImportState,
    setTabClass,
    setShowSideMenu,
    setAllPhotosForCurrentFetch,
    setPhotosListMiniAllPhotos,
    setPhotosList
}) {
    const isImportLike = viewMode === VIEW_MODES.IMPORT || viewMode === VIEW_MODES.QUICK_VIEW;

    useEffect(() => {
        if (isImportLike) {
            // Set tab state for import mode
            setTabClass({
                'directory': true,  // Default to directory tab in import mode
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': false,
            });
            setShowSideMenu(true);  // Automatically open side menu in import mode

            // Clear existing photo data when entering import mode
            logger.info('useImportModeLifecycle', 'import_mode_entered', 'Clearing existing photo data for import mode');
            setAllPhotosForCurrentFetch([]);
            setPhotosListMiniAllPhotos([]);
            setPhotosList({ photos: [], has_next: false, has_prev: false });
            // Note: Selection is intentionally NOT cleared - it should persist across view mode changes

            // Initialize ImportState if not already initialized
            if (!importState) {
                const initialPath = viewMode === VIEW_MODES.QUICK_VIEW ? modeData?.quickViewPath : undefined;
                ImportState.create(initialPath).then((newImportState) => {
                    // Check Quick View achievement after ImportState is created
                    // (delayed to ensure event listeners in App.jsx are registered)
                    if (viewMode === VIEW_MODES.QUICK_VIEW) {
                        checkFirstActionAchievement('first_quick_view');
                    }

                    // Set up callbacks for directory changes
                    newImportState.onDirectoryChange = (updatedState) => {
                        logger.info('useImportModeLifecycle', 'import_directory_changed', 'Directory changed in import mode', {
                            currentPath: updatedState.currentImportPath,
                            importPaths: updatedState.importPaths
                        });
                        // Create a new object with updated timestamp to ensure React detects change
                        const newState = Object.assign(
                            Object.create(Object.getPrototypeOf(updatedState)),
                            updatedState
                        );
                        newState._stateId = Date.now(); // Add unique identifier
                        setImportState(newState);
                    };

                    // Set up callbacks for filter changes
                    newImportState.onImportFilterChange = (updatedState) => {
                        logger.info('useImportModeLifecycle', 'import_filter_changed', 'Filter changed in import mode', {
                            filter: updatedState.importFilter
                        });
                        // Create a new object with updated timestamp to ensure React detects change
                        const newState = Object.assign(
                            Object.create(Object.getPrototypeOf(updatedState)),
                            updatedState
                        );
                        newState._stateId = Date.now(); // Add unique identifier
                        setImportState(newState);
                    };

                    newImportState._stateId = Date.now(); // Add initial state ID
                    setImportState(newImportState);
                }).catch((error) => {
                    logger.error('useImportModeLifecycle', 'import_state_init_failed', 'Failed to initialize ImportState', {
                        error: error.message
                    });
                });
            }
        } else if (viewModeObj?.isSearchMode()) {
            // Set tab state for search mode
            setTabClass({
                'directory': false,
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': true,
            });
            setShowSideMenu(true);  // Automatically open side menu in search mode
        } else {
            // For other modes, default to no active tab
            setTabClass({
                'directory': false,
                'selection': false,
                'filter': false,
                'maintenance': false,
                'search': false,
            });
            setShowSideMenu(false);  // Close side menu for other modes

            // Clean up ImportState when leaving import/quick-view mode
            if (importState && !isImportLike) {
                logger.info('useImportModeLifecycle', 'import_mode_exited', 'Cleaning up ImportState');
                importState.cleanup();
                setImportState(null);

                // Clear backend import thumbnail cache when exiting import mode
                invoke('clear_import_cache')
                    .then(removedCount => {
                        logger.info('useImportModeLifecycle', 'cache_cleared', 'Import thumbnail cache cleared on mode exit', {
                            removedFiles: removedCount
                        });
                    })
                    .catch(error => {
                        logger.warn('useImportModeLifecycle', 'cache_clear_failed', 'Failed to clear cache on mode exit', {
                            error: error.message
                        });
                    });
            }
        }
    }, [
        viewMode,
        viewModeObj,
        importState,
        isImportLike,
        modeData
        // Note: Intentionally excluding setter functions to prevent infinite loops
        // These functions are stable and don't need to trigger re-runs
    ]);
}

export default useImportModeLifecycle;
