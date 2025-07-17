import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
    if (!query.trim()) {
      onClear();
      return;
    }

    setIsSearching(true);
    try {
      const filters = {
        search_type: searchType,
        query: query.trim()
      };

      // Call onSearch with parameters so the parent can handle the actual search
      onSearch(query.trim(), searchType, filters);
    } catch (error) {
      console.error('Search failed:', error);
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
        <input
          type="text"
          placeholder="Search photos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        <button 
          onClick={handleSearch} 
          disabled={isSearching}
          className="search-button"
          title="Search"
        >
          {isSearching ? '⏳' : '🔍'}
        </button>
        <button 
          onClick={handleClear}
          className="clear-button"
          title="Clear search"
        >
          ✕
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