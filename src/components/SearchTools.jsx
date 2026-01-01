import React, { useState, useEffect } from 'react';
import SearchBar from './SearchBar';
import AdvancedFilters from './AdvancedFilters';
import SavedSearches from './SavedSearches';
import { logger } from '../services/LoggerService.js';

const SearchTools = ({
    onSearch,
    onClear,
    searchResults,
    initialQuery,
    onFiltersChange,
    initialFilters,
    onSearchSelect,
    currentSearch,
    filterOptions,
    onLoadFilterOptions,
    isFilterOptionsLoading,
    isAdvancedSearchMode
}) => {
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(isAdvancedSearchMode || false);
    const [currentFilters, setCurrentFilters] = useState(initialFilters || {});
    const [searchQuery, setSearchQuery] = useState(initialQuery || '');
   
    // Update filters when initialFilters change (e.g., from saved search)
    useEffect(() => {
        if (initialFilters) {
            setCurrentFilters(initialFilters);
            // Show advanced filters if there are active filters
            const hasFilters = Object.keys(initialFilters).some(key => {
                const value = initialFilters[key];
                if (typeof value === 'boolean') return value;
                if (typeof value === 'number') return value > 0;
                if (typeof value === 'string') return value.length > 0;
                if (typeof value === 'object' && value !== null) {
                    return Object.values(value).some(v => v && v.toString().length > 0);
                }
                return false;
            });
            if (hasFilters) {
                setShowAdvancedFilters(true);
            }
        }
    }, [initialFilters]);

    // Open advanced filters automatically for Advanced Search mode
    useEffect(() => {
        if (isAdvancedSearchMode) {
            setShowAdvancedFilters(true);
        }
    }, [isAdvancedSearchMode]);

    // Helper to check if filters have any active values
    const hasActiveFilters = (filters) => {
        if (!filters) return false;

        return !!(
            filters.camera ||
            filters.lens ||
            (filters.isoRange?.min) || (filters.isoRange?.max) ||
            (filters.apertureRange?.min) || (filters.apertureRange?.max) ||
            (filters.shutterSpeedRange?.min) || (filters.shutterSpeedRange?.max) ||
            (filters.focalLengthRange?.min) || (filters.focalLengthRange?.max) ||
            filters.dateRange?.start || filters.dateRange?.end ||
            filters.hasComment ||
            (filters.starRating && filters.starRating > 0) ||
            (filters.fileExtension && filters.fileExtension !== '') ||
            (filters.selectedTags && filters.selectedTags.length > 0)
        );
    };

    // Handle filter changes - automatically trigger search
    const handleFiltersChange = (newFilters) => {
        logger.debug('SearchTools', 'filters_changed', 'Filters changed', {
            oldFilters: currentFilters,
            newFilters: newFilters,
            currentQuery: searchQuery,
            hasActiveFilters: hasActiveFilters(newFilters),
            hasQuery: !!searchQuery.trim()
        });
        setCurrentFilters(newFilters);
        onFiltersChange(newFilters);

        // Only trigger search if there's a query OR active filters
        // This prevents showing all photos when clearing the last filter without a query
        if (searchQuery.trim() || hasActiveFilters(newFilters)) {
            logger.debug('SearchTools', 'auto_search_triggered', 'Triggering search with new filters', {
                query: searchQuery.trim(),
                hasFilters: hasActiveFilters(newFilters)
            });
            onSearch(searchQuery.trim(), 'all', newFilters);
        } else {
            logger.debug('SearchTools', 'auto_search_skipped', 'Skipping search - no query or filters', {
                query: searchQuery.trim(),
                filters: newFilters
            });
        }
    };

    // Enhanced search that includes filters
    const handleSearch = (query, searchType) => {
        setSearchQuery(query); // Track current search query
        onSearch(query, searchType, currentFilters);
    };

    return (
        <div className="search-tools">
            <SearchBar
                onSearch={handleSearch}
                onClear={() => { setSearchQuery(''); onClear(); }}
                searchResults={searchResults}
                initialQuery={initialQuery}
            />
           
            <div className="search-filters-toggle">
                <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="toggle-advanced-filters"
                >
                    {showAdvancedFilters ? 'Hide' : 'Show'} Search Options
                </button>
            </div>
           
            {showAdvancedFilters && (
                <div className="advanced-filters-section">
                    <AdvancedFilters
                        onFiltersChange={handleFiltersChange}
                        initialFilters={currentFilters}
                        filterOptions={filterOptions}
                        onLoadFilterOptions={onLoadFilterOptions}
                        isLoading={isFilterOptionsLoading}
                    />
                </div>
            )}

            <SavedSearches
                onSearchSelect={onSearchSelect}
                currentSearch={currentSearch}
            />
        </div>
    );
};

export default SearchTools;
