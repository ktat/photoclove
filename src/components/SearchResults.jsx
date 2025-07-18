import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import BasePhotoViewer from './BasePhotoViewer';
import BaseThumbnailGrid from './BaseThumbnailGrid';
import BaseThumbnailStrip from './BaseThumbnailStrip';
import BaseRightPanel, { PhotoInfoTab, PhotoEditorTab, SearchToolsTab } from './BaseRightPanel';
import { PhotoDataAdapter } from '../utils/PhotoDataAdapter';
import { usePhotoDisplay } from '../hooks/usePhotoDisplay';
import { usePhotoMetadata } from '../hooks/usePhotoMetadata';

const SearchResults = ({ 
  searchResults, 
  searchQuery, 
  onPhotoSelect, 
  onClearSearch 
}) => {
  // View state
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState('grid');
  const [showPhotoDisplay, setShowPhotoDisplay] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showThumbnailList, setShowThumbnailList] = useState(true);
  
  // Convert search results to standard format
  const standardizedPhotos = useMemo(() => {
    return PhotoDataAdapter.fromSearchResults(searchResults, searchQuery);
  }, [searchResults, searchQuery]);
  
  // Sort photos
  const sortedPhotos = useMemo(() => {
    return PhotoDataAdapter.sort(standardizedPhotos, sortBy, sortBy === 'relevance' ? 'desc' : 'asc');
  }, [standardizedPhotos, sortBy]);
  
  // Photo display hook
  const {
    currentIndex,
    currentPhoto,
    navigateToIndex,
    navigateNext,
    navigatePrevious,
    hasNext,
    hasPrevious,
    totalPhotos
  } = usePhotoDisplay(sortedPhotos, {
    autoLoadFirst: false,
    enableKeyboardNav: showPhotoDisplay,
    onPhotoChange: (photo, index) => {
      if (onPhotoSelect) {
        onPhotoSelect(photo);
      }
    }
  });
  
  // Photo metadata hook
  const {
    starRating,
    comment,
    setStarRating,
    setComment,
    saveStarRating,
    saveComment
  } = usePhotoMetadata(currentPhoto);
  
  // Handle photo selection from grid
  const handlePhotoSelect = (photo, index) => {
    navigateToIndex(index);
    setShowPhotoDisplay(true);
    
    if (onPhotoSelect) {
      onPhotoSelect(photo);
    }
  };
  
  // Handle photo selection from thumbnail strip
  const handleThumbnailSelect = (photo, index) => {
    navigateToIndex(index);
  };
  
  // Highlight search terms in text
  const highlightSearchTerm = (text, query) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  };
  
  // Export search results
  const exportResults = async () => {
    try {
      const exportData = {
        query: searchQuery,
        timestamp: new Date().toISOString(),
        results: sortedPhotos.map(photo => ({
          path: photo.file.path,
          name: photo.file.name,
          relevance: photo.search_relevance || 0
        }))
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      
      await invoke('save_search_results', {
        data: jsonString,
        filename: `search_results_${new Date().toISOString().split('T')[0]}.json`
      });
    } catch (error) {
      console.error('Failed to export search results:', error);
    }
  };
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showPhotoDisplay) return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          setShowThumbnailList(!showThumbnailList);
          break;
        case 'Escape':
          e.preventDefault();
          setShowPhotoDisplay(false);
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setShowSideMenu(true);
          break;
      }
    };
    
    if (showPhotoDisplay) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showPhotoDisplay, showThumbnailList]);

  if (!searchResults || searchResults.length === 0) {
    return (
      <div className="search-results-empty">
        <div className="empty-state">
          <h3>No results found</h3>
          <p>Try adjusting your search query or filters</p>
          <button onClick={onClearSearch} className="clear-search-button">
            Clear Search
          </button>
        </div>
      </div>
    );
  }

  // Photo display view (similar to PhotosListMini)
  if (showPhotoDisplay) {
    const tabs = [
      {
        id: 'search',
        label: 'Search',
        component: SearchToolsTab,
        props: { searchQuery, onClearSearch }
      },
      {
        id: 'info',
        label: 'Info',
        component: PhotoInfoTab
      },
      {
        id: 'editor',
        label: 'Editor',
        component: PhotoEditorTab
      }
    ];

    return (
      <div className="search-photo-display">
        {/* Left column - Search info */}
        <div className="leftMenu">
          <div className="photo-display-info">
            <div className="results-info">
              <h3>Photo {currentIndex + 1} of {totalPhotos}</h3>
              <span className="results-count">
                Search: {searchQuery && `"${searchQuery}"`}
              </span>
            </div>
            
            <div className="navigation-controls">
              <button 
                onClick={navigatePrevious} 
                disabled={!hasPrevious}
                className="nav-button prev"
              >
                ← Previous
              </button>
              <button 
                onClick={() => setShowPhotoDisplay(false)}
                className="nav-button close"
              >
                Close
              </button>
              <button 
                onClick={navigateNext} 
                disabled={!hasNext}
                className="nav-button next"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
        
        {/* Center column - Photo viewer */}
        <div className="centerDisplay">
          <BasePhotoViewer
            photo={currentPhoto}
            onPhotoClick={() => setShowSideMenu(!showSideMenu)}
            className="search-photo-viewer"
          />
          
          {/* Thumbnail strip */}
          {showThumbnailList && (
            <div className="thumbnail-strip-container">
              <BaseThumbnailStrip
                photos={sortedPhotos}
                currentIndex={currentIndex}
                onPhotoSelect={handleThumbnailSelect}
                thumbnailSize={80}
                visibleCount={9}
                showFileName={false}
                className="search-thumbnail-strip"
              />
            </div>
          )}
          
          {/* Toggle thumbnail list */}
          <div className="thumbnail-toggle">
            <button onClick={() => setShowThumbnailList(!showThumbnailList)}>
              {showThumbnailList ? "▽ Hide thumbnails ▽" : "△ Show thumbnails △"}
            </button>
          </div>
        </div>
        
        {/* Right panel with tabs */}
        <BaseRightPanel
          context="search"
          tabs={tabs}
          currentPhoto={currentPhoto}
          showSideMenu={showSideMenu}
          setShowSideMenu={setShowSideMenu}
          defaultActiveTab="search"
        />
      </div>
    );
  }

  // Grid/list view
  return (
    <div className="search-results">
      <div className="search-results-header">
        <div className="results-info">
          <h3>Search Results</h3>
          <span className="results-count">
            {searchResults.length} photo{searchResults.length !== 1 ? 's' : ''} found
            {searchQuery && ` for "${searchQuery}"`}
          </span>
        </div>
        
        <div className="results-controls">
          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="relevance">Relevance</option>
              <option value="name">Name</option>
              <option value="date">Date</option>
            </select>
          </div>
          
          <div className="view-controls">
            <button 
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ⊞
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              ☰
            </button>
          </div>
          
          <button onClick={exportResults} className="export-button">
            Export Results
          </button>
          
          <button onClick={onClearSearch} className="clear-search-button">
            Clear Search
          </button>
        </div>
      </div>
      
      {/* Search results grid */}
      <div className={`search-results-content ${viewMode}`}>
        <BaseThumbnailGrid
          photos={sortedPhotos}
          selectedIndex={currentIndex}
          onPhotoSelect={handlePhotoSelect}
          viewMode={viewMode}
          sortBy={sortBy}
          sortOrder={sortBy === 'relevance' ? 'desc' : 'asc'}
          showFileName={true}
          showFileInfo={true}
          className="search-results-grid"
        />
        
        {/* Custom search-specific overlay for each item */}
        <div className="search-overlay">
          {sortedPhotos.map((photo, index) => (
            <div key={`overlay-${photo.file.path}-${index}`} className="search-item-overlay">
              {photo.search_relevance && (
                <div className="relevance-badge">
                  {Math.round(photo.search_relevance * 100)}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchResults;