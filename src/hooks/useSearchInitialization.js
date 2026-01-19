import { useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

/**
 * Custom hook for search initialization and lifecycle
 *
 * Handles search-related initialization effects:
 * - Initialize search parameters when entering search mode
 * - Perform initial search on component mount
 * - Load filter options for advanced search
 *
 * Note: Photo loading for search results is now handled by useViewModeSync,
 * not by this hook. This keeps search mode consistent with other view modes.
 *
 * @param {Object} params
 * @param {Object} params.viewModeObj - ViewMode object for mode checks
 * @param {boolean} params.isAdvancedSearchMode - Whether in advanced search mode
 * @param {string} params.searchQuery - Current search query
 * @param {string} params.searchInitialQuery - Initial search query from URL/props
 * @param {Object} params.currentSearchParams - Current search parameters
 * @param {Object} params.searchFilters - Search filters object
 * @param {Function} params.updateSearchParams - Function to update search parameters
 * @param {Function} params.handleSearch - Function to perform search
 * @param {Object} params.filterOptions - Filter options for advanced search
 * @param {boolean} params.isFilterOptionsLoading - Whether filter options are loading
 * @param {Function} params.loadFilterOptions - Function to load filter options
 */
export function useSearchInitialization({
    viewModeObj,
    isAdvancedSearchMode,
    searchQuery,
    searchInitialQuery,
    currentSearchParams,
    searchFilters,
    updateSearchParams,
    handleSearch,
    filterOptions,
    isFilterOptionsLoading,
    loadFilterOptions
}) {
    // Initialize search parameters when in search mode
    useEffect(() => {
        if (viewModeObj.isSearchMode() && searchQuery && !currentSearchParams) {
            updateSearchParams({
                query: searchQuery,
                searchType: "all",
                filters: searchFilters
            });
        }
    }, [viewModeObj, searchQuery, currentSearchParams, searchFilters, updateSearchParams]);

    // Perform initial search when component mounts with searchInitialQuery
    useEffect(() => {
        if (viewModeObj.isSearchMode() && searchInitialQuery && !currentSearchParams) {
            handleSearch(searchInitialQuery, "all", {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewModeObj, searchInitialQuery, currentSearchParams]);
    // Note: handleSearch is intentionally omitted - only search state changes should trigger this

    // Note: Photo loading for search results is now handled by useViewModeSync
    // This hook only handles search initialization, not photo loading

    // Load filter options for Advanced Search mode
    useEffect(() => {
        if (isAdvancedSearchMode && !filterOptions && !isFilterOptionsLoading) {
            logger.info('useSearchInitialization', 'advanced_search_init', 'Loading filter options for Advanced Search mode');
            loadFilterOptions();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdvancedSearchMode, filterOptions, isFilterOptionsLoading]);
    // Note: loadFilterOptions is intentionally omitted - only mode and loading state should trigger this
}
