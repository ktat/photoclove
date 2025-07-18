import React, { useState, useEffect } from "react";
import { useUI } from "../context/UIContext.jsx";
import SearchBar from "../components/SearchBar";
import AdvancedFilters from "../components/AdvancedFilters";
import PhotosList from "./PhotosList.jsx";
import SavedSearches from "../components/SavedSearches";
import { useSearch } from "../hooks/useSearch";
import "./SearchPage.css";
import "./SearchPageOverrides.css";

function SearchPage() {
    const { searchInitialQuery, toggleSearchPage } = useUI();
    const { 
        searchResults, 
        isSearching, 
        searchQuery, 
        searchType, 
        performSearch, 
        clearSearch 
    } = useSearch();
    
    const [searchFilters, setSearchFilters] = useState({});
    const [currentSearchParams, setCurrentSearchParams] = useState(null);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);

    // Initialize search with initial query if provided
    useEffect(() => {
        if (searchInitialQuery) {
            performSearch(searchInitialQuery, "all", {});
            setCurrentSearchParams({
                query: searchInitialQuery,
                searchType: "all",
                filters: {}
            });
        }
    }, [searchInitialQuery, performSearch]);

    // Search handlers
    const handleSearch = async (query, type, filters) => {
        const params = { query, searchType: type, filters };
        setCurrentSearchParams(params);
        await performSearch(query, type, filters);
    };

    const handleSearchClear = () => {
        clearSearch();
        setCurrentSearchParams(null);
    };

    const handleSavedSearchSelect = (searchParams) => {
        setCurrentSearchParams(searchParams);
        performSearch(searchParams.query, searchParams.searchType, searchParams.filters);
    };

    const handleFiltersChange = (newFilters) => {
        setSearchFilters(newFilters);
        // If there's an active search, re-run it with new filters
        if (currentSearchParams) {
            performSearch(currentSearchParams.query, currentSearchParams.searchType, newFilters);
        }
    };

    const handlePhotoSelect = (photo) => {
        setSelectedPhoto(photo);
    };

    const handleBackToHome = () => {
        toggleSearchPage(false);
    };

    return (
        <div className="search-page-container">
            <div className="search-page-header">
                <button 
                    className="back-to-home-button" 
                    onClick={handleBackToHome}
                >
                    ← Back to Home
                </button>
                <h1>Photo Search</h1>
            </div>

            <div className="search-page-content">
                {/* Main Content - Search Results */}
                <div className="search-page-main">
                    {currentSearchParams ? (
                        <div className="search-results-section">
                            {isSearching ? (
                                <div className="search-loading">
                                    <p>Searching...</p>
                                </div>
                            ) : searchResults && searchResults.length > 0 ? (
                                <PhotosList
                                    searchMode={true}
                                    searchResults={searchResults}
                                    searchQuery={searchQuery}
                                    onClearSearch={handleSearchClear}
                                    fetchConfig={{
                                        fetch_method: "search",
                                        value: searchQuery,
                                        title: `Search: "${searchQuery}"`
                                    }}
                                />
                            ) : (
                                <div className="search-no-results">
                                    <p>No photos found matching your search criteria.</p>
                                    <button onClick={handleSearchClear} className="clear-search-btn">
                                        Clear Search
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="search-welcome">
                            <h2>Search Your Photos</h2>
                            <p>Use the search tools on the right to find photos by filename, metadata, or EXIF data.</p>
                        </div>
                    )}
                </div>

                {/* Right Column - Search Tools */}
                <div className="search-page-right">
                    <div className="search-tools">
                        <SearchBar 
                            onSearch={handleSearch}
                            onClear={handleSearchClear}
                            searchResults={searchResults}
                            initialQuery={searchInitialQuery}
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
                                initialFilters={searchFilters}
                            />
                        )}
                        
                        <SavedSearches 
                            onSearchSelect={handleSavedSearchSelect}
                            currentSearch={currentSearchParams}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SearchPage;