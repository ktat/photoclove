import React, { useState } from 'react';
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
    currentSearch
}) => {
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [currentFilters, setCurrentFilters] = useState(initialFilters || {});

    // Handle filter changes
    const handleFiltersChange = (newFilters) => {
        setCurrentFilters(newFilters);
        onFiltersChange(newFilters);
    };

    // Enhanced search that includes filters
    const handleSearch = (query, searchType) => {
        onSearch(query, searchType, currentFilters);
    };

    return (
        <div className="search-tools">
            <SearchBar 
                onSearch={handleSearch}
                onClear={onClear}
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
                <AdvancedFilters 
                    onFiltersChange={handleFiltersChange}
                    initialFilters={currentFilters}
                />
            )}
            
            <SavedSearches 
                onSearchSelect={onSearchSelect}
                currentSearch={currentSearch}
            />
        </div>
    );
};

export default SearchTools;