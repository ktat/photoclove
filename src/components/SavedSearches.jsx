import React, { useState, useEffect } from 'react';

const SavedSearches = ({ onSearchSelect, currentSearch }) => {
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchToEdit, setSearchToEdit] = useState(null);

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('photo_saved_searches');
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved searches:', error);
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
        console.error('Failed to import searches:', error);
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
                <div className="search-info" onClick={() => handleSearchSelect(search)}>
                  <div className="search-name">{search.name}</div>
                  <div className="search-details">
                    <span className="search-query">"{search.query}"</span>
                    <span className="search-type">in {search.searchType}</span>
                  </div>
                  <div className="search-meta">
                    <span className="created-date">
                      Created: {formatDate(search.createdAt)}
                    </span>
                    <span className="last-used">
                      Last used: {formatDate(search.lastUsed)}
                    </span>
                  </div>
                </div>
                
                <div className="search-actions">
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