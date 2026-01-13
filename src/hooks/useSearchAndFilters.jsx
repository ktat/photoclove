import { useState, useMemo, useCallback } from 'react';
import { useSearch } from './useSearch.js';

/**
 * Custom hook for managing search and filter functionality
 * Extracted from PhotosList.jsx to reduce component complexity
 */
export function useSearchAndFilters() {
    // Search state for the PhotosList component
    const [searchFilters, setSearchFilters] = useState({});
    const [currentSearchParams, setCurrentSearchParams] = useState(null);
    
    // Use existing search hook
    const { searchResults, searchQuery, isSearching, performSearch, clearSearch: clearSearchHook } = useSearch();

    /**
     * Clear all search parameters and filters
     * Note: This only clears search-related state, not view filters (star, comment, etc.)
     */
    const clearAllSearchFilters = useCallback(() => {
        setCurrentSearchParams(null);
        setSearchFilters({});
        clearSearchHook();
    }, [clearSearchHook]);

    /**
     * Check if any filters are currently active
     */
    const hasActiveFilters = useCallback((filterState) => {
        const { starFilter, hasCommentFilter, hasTagFilter, extensionFilter } = filterState;
        return starFilter > 0 || hasCommentFilter || hasTagFilter || extensionFilter !== 'all';
    }, []);

    /**
     * Generate a summary string of active filters
     */
    const getFilterSummary = useCallback((filterState) => {
        const { starFilter, hasCommentFilter, hasTagFilter, extensionFilter } = filterState;
        const active = [];
        
        if (starFilter > 0) active.push(`★${starFilter}+`);
        if (hasCommentFilter) active.push('Has comment');
        if (hasTagFilter) active.push('Has tag');
        if (extensionFilter !== 'all') active.push(`${extensionFilter}`);

        return active.length > 0 ? `Active filters: ${active.join(', ')}` : '';
    }, []);

    /**
     * Render filter clearing UI component
     */
    const renderFilterClearingUI = useCallback((filterState, onClearFilters) => {
        const hasFilters = hasActiveFilters(filterState);
        if (!hasFilters) return null;
        
        const summary = getFilterSummary(filterState);
        
        return (
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "5px" }}>
                {summary}
                <button
                    style={{ marginLeft: "10px", fontSize: "var(--font-size-2xs)", padding: "2px 6px", cursor: "pointer" }}
                    onClick={onClearFilters || clearAllSearchFilters}
                >
                    Clear Filters
                </button>
            </div>
        );
    }, [hasActiveFilters, getFilterSummary, clearAllSearchFilters]);

    /**
     * Update search parameters and trigger search if needed
     */
    const updateSearchParams = useCallback((params) => {
        setCurrentSearchParams(params);
        if (params?.filters) {
            setSearchFilters(params.filters);
        }
    }, []);

    /**
     * Perform search with current parameters
     */
    const executeSearch = useCallback((query, searchType, filters, isSearchMode) => {
        if (isSearchMode && currentSearchParams && searchResults.length > 0) {
            return performSearch(
                currentSearchParams.query,
                currentSearchParams.searchType,
                currentSearchParams.filters,
                currentSearchParams
            );
        }
        return null;
    }, [currentSearchParams, searchResults, performSearch]);

    return {
        // State
        searchFilters,
        setSearchFilters,
        currentSearchParams,
        setCurrentSearchParams,
        
        // Search functionality
        searchResults,
        searchQuery,
        isSearching,
        performSearch,
        clearSearch: clearSearchHook,
        
        // Filter functionality
        clearAllSearchFilters,
        hasActiveFilters,
        getFilterSummary,
        renderFilterClearingUI,
        
        // Combined functionality
        updateSearchParams,
        executeSearch
    };
}

export default useSearchAndFilters;