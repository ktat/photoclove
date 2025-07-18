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

    return (
        <div className="search-tools">
            <SearchBar 
                onSearch={onSearch}
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
                    onFiltersChange={onFiltersChange}
                    initialFilters={initialFilters}
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