/**
 * useSearchAndFilterManagement Hook
 *
 * Manages search and filter operations for PhotosList.
 * Extracted from PhotosList.jsx (Phase 3 of refactoring #129)
 *
 * Responsibilities:
 * - Search execution and handling
 * - Filter management (star, comment, tag, extension)
 * - Filter clearing and application
 * - Search auto-execution
 * - Sort-triggered search re-execution
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger } from '../services/LoggerService.js';
import { applyFrontendFilters } from '../utils/PhotoProcessingUtils.js';
import { getCurrentSortConfig } from '../utils/UIStateUtils.js';

/**
 * Search and filter management hook
 * @param {Object} params
 * @param {Object} params.viewModeObj - ViewMode object
 * @param {string} params.searchQuery - Current search query
 * @param {string} params.searchInitialQuery - Initial query from HOME
 * @param {Object} params.currentSearchParams - Current search parameters
 * @param {Array} params.searchResults - Search results array
 * @param {number} params.sortOfPhotos - Current sort value
 * @param {number} params.starFilter - Star filter value
 * @param {boolean} params.hasCommentFilter - Comment filter flag
 * @param {boolean} params.hasTagFilter - Tag filter flag
 * @param {string} params.extensionFilter - Extension filter value
 * @param {string} params.importExtensionFilter - Import mode extension filter
 * @param {Function} params.setStarFilter - Set star filter
 * @param {Function} params.setHasCommentFilter - Set comment filter
 * @param {Function} params.setHasTagFilter - Set tag filter
 * @param {Function} params.setExtensionFilter - Set extension filter
 * @param {Function} params.setImportExtensionFilter - Set import extension filter
 * @param {Function} params.performSearch - Execute search function
 * @param {Function} params.updateSearchParams - Update search params
 * @param {Function} params.clearSearchHook - Clear search hook function
 * @param {Function} params.toggleSearchPage - Toggle search page
 * @param {boolean} params.hasActiveFiltersState - Has active filters flag
 * @param {string} params.getFilterSummaryText - Filter summary text
 * @returns {Object} Search and filter functions
 */
export function useSearchAndFilterManagement({
    viewModeObj,
    searchQuery,
    searchInitialQuery,
    currentSearchParams,
    searchResults,
    sortOfPhotos,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    importExtensionFilter,
    setStarFilter,
    setHasCommentFilter,
    setHasTagFilter,
    setExtensionFilter,
    setImportExtensionFilter,
    performSearch,
    updateSearchParams,
    clearSearchHook,
    toggleSearchPage,
    hasActiveFiltersState,
    getFilterSummaryText
}) {
    /**
     * Custom clear search function that also navigates back to home
     */
    const clearSearch = useCallback(() => {
        clearSearchHook();
        updateSearchParams(null);
        // Navigate back to home by toggling search page off
        toggleSearchPage(false);
    }, [clearSearchHook, updateSearchParams, toggleSearchPage]);

    /**
     * Clear all active filters (mode-aware)
     */
    const clearAllFilters = useCallback(() => {
        if (viewModeObj.isImportMode()) {
            // Import mode: only clear extension filter
            setImportExtensionFilter('all');
        } else {
            // Normal mode: clear all filters
            setStarFilter(0);
            setHasCommentFilter(false);
            setHasTagFilter(false);
            setExtensionFilter('all');
        }
    }, [viewModeObj, setStarFilter, setHasCommentFilter, setHasTagFilter, setExtensionFilter, setImportExtensionFilter]);

    /**
     * Frontend filtering function wrapper
     */
    const applyFiltersWithConfig = useCallback((photos) => {
        // Import modeではextensionフィルターのみ適用
        if (viewModeObj.isImportMode()) {
            return applyFrontendFilters(photos, {
                starFilter: 0,
                hasCommentFilter: false,
                hasTagFilter: false,
                extensionFilter: importExtensionFilter
            });
        }

        // 通常モードでは全てのフィルターを適用
        return applyFrontendFilters(photos, {
            starFilter,
            hasCommentFilter,
            hasTagFilter,
            extensionFilter
        });
    }, [viewModeObj, starFilter, hasCommentFilter, hasTagFilter, extensionFilter, importExtensionFilter]);

    /**
     * Handle search execution
     */
    const handleSearch = useCallback(async (query, type, filters) => {
        logger.info('useSearchAndFilterManagement', 'handleSearch', 'Search triggered', {
            query,
            type,
            hasFilters: !!filters,
            filterKeys: filters ? Object.keys(filters) : [],
            filters
        });
        const params = { query, searchType: type, filters };
        updateSearchParams(params);
        // Directly execute search using performSearch
        try {
            await performSearch(query, type, filters);
        } catch (error) {
            logger.error('useSearchAndFilterManagement', 'handleSearch_error', 'Search failed', {
                error: error.message
            });
        }
    }, [updateSearchParams, performSearch]);

    /**
     * Handle saved search selection
     */
    const handleSavedSearchSelect = useCallback((searchParams) => {
        updateSearchParams(searchParams);
        // PhotoCollection will automatically reload via useViewModeSync when searchParams change
    }, [updateSearchParams]);

    /**
     * Handle filter changes
     */
    const handleFiltersChange = useCallback((newFilters) => {
        updateSearchParams({ filters: newFilters });
    }, [updateSearchParams]);

    /**
     * Render filter clearing UI component
     */
    const renderFilterClearingUI = useCallback(() => {
        if (!hasActiveFiltersState) return null;

        return (
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "5px" }}>
                {getFilterSummaryText}
                <button
                    style={{ marginLeft: "10px", fontSize: "var(--font-size-xs)", padding: "2px 6px", cursor: "pointer" }}
                    onClick={clearAllFilters}
                >
                    Clear Filters
                </button>
            </div>
        );
    }, [hasActiveFiltersState, getFilterSummaryText, clearAllFilters]);

    /**
     * Auto-execute search when coming from HOME with initial query
     */
    useEffect(() => {
        if (viewModeObj.isSearchMode() && searchInitialQuery && searchInitialQuery.trim() && !searchQuery) {
            handleSearch(searchInitialQuery, 'all', {});
        }
    }, [viewModeObj, searchInitialQuery, searchQuery, handleSearch]);

    // Note: Sort-based search re-execution removed
    // Search mode is now handled uniformly by useViewModeSync
    // which responds to sortOfPhotos changes through PhotoCollection

    return {
        // Search handlers
        handleSearch,
        clearSearch,
        handleSavedSearchSelect,
        handleFiltersChange,

        // Filter handlers
        clearAllFilters,
        applyFiltersWithConfig,
        renderFilterClearingUI
    };
}
