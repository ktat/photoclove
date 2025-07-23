import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const SearchBar = ({ onSearch, onClear, searchResults, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Set initial query when component mounts or initialQuery changes
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async () => {
    // Allow empty query - filters might still be active
    // Empty query with filters is a valid search scenario
    setIsSearching(true);
    try {
      // Call onSearch with query (can be empty) and searchType
      // Filters are handled separately by AdvancedFilters component
      onSearch(query.trim(), searchType);
    } catch (error) {
      logger.error('SearchBar', 'search_failed', 'Search operation failed', {
        error: error.message || error.toString(),
        query,
        searchType
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className="search-bar">
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search photos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="search-input"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="input-clear-button"
              title="Clear query"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="search-button"
          title="Search"
        >
          {isSearching ? '⏳' : '🔍'}
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-toggle"
          title="Advanced search options"
        >
          ⚙️
        </button>
      </div>
     
      {showAdvanced && (
        <div className="advanced-search">
          <label>Search in:</label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="search-type-select"
          >
            <option value="all">All Fields</option>
            <option value="filename">Filename</option>
            <option value="comment">Comments</option>
            <option value="camera">Camera</option>
            <option value="settings">Camera Settings</option>
            <option value="date">Date</option>
            <option value="exif">EXIF Data</option>
          </select>
        </div>
      )}

      {searchResults && (
        <div className="search-results-summary">
          Found {searchResults.length} photo{searchResults.length !== 1 ? 's' : ''}
          {query && ` for "${query}"`}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
