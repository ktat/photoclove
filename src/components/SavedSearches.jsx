import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const SavedSearches = ({ onSearchSelect, currentSearch }) => {
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchToEdit, setSearchToEdit] = useState(null);
  const [expandedSearches, setExpandedSearches] = useState(new Set());

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('photo_saved_searches');
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved));
      } catch (error) {
        logger.error('SavedSearches', 'load_searches_failed', 'Failed to load saved searches', {
          error: error.message || error.toString()
        });
      }
    }
  }, []);

  // Save searches to localStorage
  const saveToStorage = (searches) => {
    localStorage.setItem('photo_saved_searches', JSON.stringify(searches));
  };

  const handleSaveSearch = () => {
    if (!currentSearch || !searchName.trim()) {
      return;
    }

    const newSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      query: currentSearch.query,
      searchType: currentSearch.searchType,
      filters: currentSearch.filters,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    const updatedSearches = [...savedSearches, newSearch];
    setSavedSearches(updatedSearches);
    saveToStorage(updatedSearches);
   
    setSearchName('');
    setShowSaveDialog(false);
  };

  const handleUpdateSearch = () => {
    if (!searchToEdit || !currentSearch) {
      return;
    }

    const updatedSearches = savedSearches.map(search =>
      search.id === searchToEdit.id
        ? {
            ...search,
            query: currentSearch.query,
            searchType: currentSearch.searchType,
            filters: currentSearch.filters,
            lastUsed: new Date().toISOString()
          }
        : search
    );

    setSavedSearches(updatedSearches);
    saveToStorage(updatedSearches);
    setSearchToEdit(null);
  };

  const handleDeleteSearch = (searchId) => {
    const updatedSearches = savedSearches.filter(search => search.id !== searchId);
    setSavedSearches(updatedSearches);
    saveToStorage(updatedSearches);
  };

  const handleRenameSearch = (searchId, newName) => {
    const updatedSearches = savedSearches.map(search =>
      search.id === searchId
        ? { ...search, name: newName.trim() }
        : search
    );
    setSavedSearches(updatedSearches);
    saveToStorage(updatedSearches);
  };

  const handleSearchSelect = (search) => {
    // Update last used timestamp
    const updatedSearches = savedSearches.map(s =>
      s.id === search.id
        ? { ...s, lastUsed: new Date().toISOString() }
        : s
    );
    setSavedSearches(updatedSearches);
    saveToStorage(updatedSearches);

    // Execute the search
    if (onSearchSelect) {
      onSearchSelect({
        query: search.query,
        searchType: search.searchType,
        filters: search.filters
      });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Toggle expanded state for search conditions
  const toggleExpanded = (searchId) => {
    const newExpanded = new Set(expandedSearches);
    if (newExpanded.has(searchId)) {
      newExpanded.delete(searchId);
    } else {
      newExpanded.add(searchId);
    }
    setExpandedSearches(newExpanded);
  };

  // Filter display logic
  const filterDisplayMap = {
    star: 'Star Rating',
    dateFrom: 'From Date',
    dateTo: 'To Date',
    camera: 'Camera',
    lens: 'Lens',
    isoRange: 'ISO Range',
    apertureRange: 'Aperture Range',
    shutterSpeedRange: 'Shutter Speed Range',
    focalLengthRange: 'Focal Length Range',
    fileExtension: 'File Type',
    hasComment: 'Has Comment'
  };

  const formatFilterValue = (key, value) => {
    if (!value && value !== 0 && value !== false) return '';
   
    // CRITICAL: Check if value is an object first to prevent React rendering errors
    if (typeof value === 'object' && value !== null) {
      // Handle dateRange with start/end properties (most common case)
      if (value.start !== undefined || value.end !== undefined) {
        const formatDate = (dateValue) => {
          if (!dateValue) return '';
          try {
            // Handle date strings or date objects
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return String(dateValue);
            return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
          } catch {
            return String(dateValue);
          }
        };
       
        const start = formatDate(value.start);
        const end = formatDate(value.end);
        if (start && end) return `${start} → ${end}`;
        if (start) return `From: ${start}`;
        if (end) return `Until: ${end}`;
        return '';
      }
      // Handle other ranges with min/max properties
      if (value.min !== undefined || value.max !== undefined) {
        const min = value.min || '';
        const max = value.max || '';
        if (min && max) return `${min} – ${max}`;
        if (min) return `≥ ${min}`;
        if (max) return `≤ ${max}`;
        return '';
      }
      // Fallback for any other object - convert to readable format
      return `[Object: ${Object.keys(value).join(', ')}]`;
    }
   
    // Handle date formatting (for string dates)
    if (key.includes('date') || key.includes('Date')) {
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      } catch {
        return String(value);
      }
    }
   
    // Handle special value types
    if (key === 'star' || key === 'starRating') {
      const stars = parseInt(value) || 0;
      return stars > 0 ? '★'.repeat(stars) + ` (${stars} star${stars !== 1 ? 's' : ''})` : 'Any rating';
    }
    if (key === 'hasComment') return value ? 'Yes' : 'No';
    if (key === 'fileExtension') return value.toUpperCase();
   
    // Ensure we always return a string
    return String(value);
  };

  // Get active filters for display
  const getActiveFilters = (search) => {
    const filters = [];
   
    // Add query and search type
    if (search.query) {
      filters.push({ key: 'query', label: 'Query', value: search.query });
    }
    if (search.searchType && search.searchType !== 'all') {
      filters.push({ key: 'searchType', label: 'Search In', value: search.searchType });
    }
   
    // Add other filters
    if (search.filters) {
      Object.entries(search.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && value !== false) {
          const formattedValue = formatFilterValue(key, value);
          if (formattedValue) {
            filters.push({
              key,
              label: filterDisplayMap[key] || key,
              value: formattedValue
            });
          }
        }
      });
    }
   
    return filters;
  };

  const exportSearches = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      searches: savedSearches
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
   
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved_searches_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
   
    URL.revokeObjectURL(url);
  };

  const importSearches = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        if (importData.searches && Array.isArray(importData.searches)) {
          const newSearches = importData.searches.map(search => ({
            ...search,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          }));
         
          const updatedSearches = [...savedSearches, ...newSearches];
          setSavedSearches(updatedSearches);
          saveToStorage(updatedSearches);
        }
      } catch (error) {
        logger.error('SavedSearches', 'import_searches_failed', 'Failed to import searches', {
          error: error.message || error.toString()
        });
        alert('Failed to import searches. Please check the file format.');
      }
    };
    reader.readAsText(file);
   
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="saved-searches">
      <div className="saved-searches-header">
        <h3>Saved Searches</h3>
        <div className="header-actions">
          {currentSearch && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="save-button"
              title="Save current search"
            >
              💾
            </button>
          )}
          <button
            onClick={exportSearches}
            className="export-button"
            title="Export saved searches"
          >
            📤
          </button>
          <label className="import-button" title="Import saved searches">
            📥
            <input
              type="file"
              accept=".json"
              onChange={importSearches}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {showSaveDialog && (
        <div className="save-dialog">
          <h4>Save Search</h4>
          <input
            type="text"
            placeholder="Search name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveSearch()}
          />
          <div className="dialog-actions">
            <button onClick={handleSaveSearch} disabled={!searchName.trim()}>
              Save
            </button>
            <button onClick={() => {
              setShowSaveDialog(false);
              setSearchName('');
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {searchToEdit && (
        <div className="update-dialog">
          <h4>Update Search</h4>
          <p>Update "{searchToEdit.name}" with current search parameters?</p>
          <div className="dialog-actions">
            <button onClick={handleUpdateSearch}>Update</button>
            <button onClick={() => setSearchToEdit(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="searches-list">
        {savedSearches.length === 0 ? (
          <div className="empty-state">
            <p>No saved searches yet</p>
            <p>Save your current search to access it later</p>
          </div>
        ) : (
          savedSearches
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .map((search) => (
              <div key={search.id} className="search-item">
                <div className="search-info">
                  <div className="search-header" onClick={() => handleSearchSelect(search)}>
                    <div className="search-name">{search.name}</div>
                    <div className="search-dates">
                      <span>Last used: {formatDate(search.lastUsed)}</span>
                    </div>
                  </div>
                 
                  {getActiveFilters(search).length > 0 && (
                    <div className="search-conditions-wrapper">
                      <button
                        className="toggle-conditions"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(search.id);
                        }}
                        aria-expanded={expandedSearches.has(search.id)}
                        aria-controls={`conditions-${search.id}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpanded(search.id);
                          }
                        }}
                      >
                        <span className={`toggle-arrow ${expandedSearches.has(search.id) ? 'expanded' : ''}`}>
                          ▷
                        </span>
                        Search Conditions
                      </button>
                     
                      <div
                        id={`conditions-${search.id}`}
                        className={`conditions-panel ${expandedSearches.has(search.id) ? 'expanded' : ''}`}
                      >
                        <div className="conditions-list">
                          {getActiveFilters(search).map((filter, index) => (
                            <div key={index} className="condition-item">
                              <div className="condition-label">{filter.label}</div>
                              <div className="condition-value">{filter.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
               
                <div className="search-actions" style={{ float: 'right' }}>
                  <button
                    onClick={() => setSearchToEdit(search)}
                    title="Update with current search"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      const newName = prompt('Enter new name:', search.name);
                      if (newName && newName.trim()) {
                        handleRenameSearch(search.id, newName);
                      }
                    }}
                    title="Rename search"
                  >
                    📝
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${search.name}"?`)) {
                        handleDeleteSearch(search.id);
                      }
                    }}
                    title="Delete search"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default SavedSearches;
