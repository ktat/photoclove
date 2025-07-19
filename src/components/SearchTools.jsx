import React, { useState, useEffect } from 'react';
import SearchBar from './SearchBar';
import AdvancedFilters from './AdvancedFilters';
import SavedSearches from './SavedSearches';

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
    isFilterOptionsLoading
}) => {
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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

    // Handle filter changes
    const handleFiltersChange = (newFilters) => {
        console.log('SearchTools - Filters changed:', {
            oldFilters: currentFilters,
            newFilters: newFilters
        });
        setCurrentFilters(newFilters);
        onFiltersChange(newFilters);
    };

    // Enhanced search that includes filters
    const handleSearch = (query, searchType) => {
        setSearchQuery(query); // Track current search query
        onSearch(query, searchType, currentFilters);
    };

    // Apply filters even without search query
    const applyFilters = () => {
        // Use empty query to search with filters only
        onSearch('', 'all', currentFilters);
    };
    
    // Check if there are active filters to enable/disable the manual search button
    const hasActiveFilters = Object.keys(currentFilters).some(key => {
        const value = currentFilters[key];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') return value.length > 0;
        if (typeof value === 'object' && value !== null) {
            return Object.values(value).some(v => v && v.toString().length > 0);
        }
        return false;
    });

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
                    {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
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
                    <div className="manual-search-controls">
                        <button 
                            onClick={applyFilters}
                            className="search-button manual-search-button"
                            disabled={!hasActiveFilters && !searchQuery.trim()}
                        >
                            🔍 Execute Search
                        </button>
                        <p className="manual-search-hint">
                            Click "Execute Search" to apply your filter changes
                        </p>
                    </div>
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