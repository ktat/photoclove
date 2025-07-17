import React, { useState, useEffect, useRef, useContext } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { ImgCacheContext } from '../App/ImgCacheContext.jsx';

const SearchResults = ({ 
  searchResults, 
  searchQuery, 
  onPhotoSelect, 
  onClearSearch 
}) => {
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState('grid');
  const [thumbnailStore, setThumbnailStore] = useState('');
  
  // Photo display state
  const [showPhotoDisplay, setShowPhotoDisplay] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentPhotoPath, setCurrentPhotoPath] = useState('');
  const [showThumbnailList, setShowThumbnailList] = useState(true);
  const imgCacheContext = useContext(ImgCacheContext);
  const [imgCacheMap, setImgCacheMap] = useState(imgCacheContext?.imgCacheMap || {});
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imgStyle, setImgStyle] = useState({
    transition: 'opacity 0.1s',
    opacity: 1,
    maxWidth: '100%',
    maxHeight: '100%',
    overflow: 'hidden'
  });
  const [borderStyle, setBorderStyle] = useState([]);
  const [photoComment, setPhotoComment] = useState('');
  const [photoStarRating, setPhotoStarRating] = useState(0);

  // Get thumbnail store configuration
  useEffect(() => {
    invoke('get_config', {}).then((e) => {
      const json = JSON.parse(e);
      setThumbnailStore(json.thumbnail_store);
    });
  }, []);
  
  // Initialize with first photo when search results change
  useEffect(() => {
    if (sortedResults.length > 0 && showPhotoDisplay) {
      setCurrentPhotoIndex(0);
      setCurrentPhotoPath(sortedResults[0].file.path);
      // Initialize border style
      const newBorderStyle = [];
      for (let i = 0; i < sortedResults.length; i++) {
        newBorderStyle[i] = i === 0 ? '3px solid #4a9eff' : '1px solid #444';
      }
      setBorderStyle(newBorderStyle);
      
      // Cache first image
      setTimeout(() => {
        setImageCache(0, 0);
      }, 100);
    }
  }, [searchResults, sortBy, showPhotoDisplay]);

  const sortedResults = React.useMemo(() => {
    const sorted = [...searchResults];
    
    switch (sortBy) {
      case 'relevance':
        return sorted.sort((a, b) => (b.search_relevance || 0) - (a.search_relevance || 0));
      case 'name':
        return sorted.sort((a, b) => a.file.name.localeCompare(b.file.name));
      case 'date':
        return sorted.sort((a, b) => new Date(b.date_taken || b.file.path) - new Date(a.date_taken || a.file.path));
      default:
        return sorted;
    }
  }, [searchResults, sortBy]);

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

  const handlePhotoClick = (photo, index) => {
    setCurrentPhotoIndex(index);
    setCurrentPhotoPath(photo.file.path);
    setShowPhotoDisplay(true);
    setImageCache(index, 0);
    resetSelectedBorder(index);
    
    if (onPhotoSelect) {
      onPhotoSelect(photo);
    }
  };
  
  // Reset border styling for thumbnail selection
  const resetSelectedBorder = (selectedIndex) => {
    if (!sortedResults || sortedResults.length === 0) return;
    
    const newBorderStyle = [];
    for (let i = 0; i < sortedResults.length; i++) {
      if (i === selectedIndex) {
        newBorderStyle[i] = '3px solid #4a9eff';
      } else {
        newBorderStyle[i] = '1px solid #444';
      }
    }
    setBorderStyle(newBorderStyle);
  };
  
  // Image caching functionality
  const setImageCache = (index, direction) => {
    const photo = sortedResults[index];
    if (!photo) return;
    
    const imagePath = photo.file.path;
    if (imgCacheMap[imagePath]) return;
    
    const img = new Image();
    img.onload = () => {
      const newCache = {
        ...imgCacheMap,
        [imagePath]: [img.src]
      };
      setImgCacheMap(newCache);
      
      // Update context if available
      if (imgCacheContext?.setImgCacheMap) {
        imgCacheContext.setImgCacheMap(newCache);
      }
    };
    img.src = convertFileSrc(imagePath);
  };
  
  // Navigation functions
  const navigatePhoto = (direction) => {
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < sortedResults.length) {
      const newPhoto = sortedResults[newIndex];
      setCurrentPhotoIndex(newIndex);
      setCurrentPhotoPath(newPhoto.file.path);
      setImageCache(newIndex, direction);
      resetSelectedBorder(newIndex);
    }
  };
  
  const prevPhoto = () => navigatePhoto(-1);
  const nextPhoto = () => navigatePhoto(1);
  
  // Keyboard navigation - only active when photo display is shown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showPhotoDisplay || sortedResults.length === 0) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          navigatePhoto(-1);
          break;
        case 'ArrowRight':
          navigatePhoto(1);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          setShowThumbnailList(!showThumbnailList);
          break;
        case 'Escape':
          setShowPhotoDisplay(false);
          break;
        case 's':
        case 'S':
          // Increase star rating
          if (sortedResults[currentPhotoIndex]) {
            const newRating = Math.min(5, photoStarRating + 1);
            setPhotoStarRating(newRating);
            savePhotoStar(sortedResults[currentPhotoIndex].file.path, newRating);
          }
          break;
        case 'd':
        case 'D':
          // Decrease star rating
          if (sortedResults[currentPhotoIndex]) {
            const newRating = Math.max(0, photoStarRating - 1);
            setPhotoStarRating(newRating);
            savePhotoStar(sortedResults[currentPhotoIndex].file.path, newRating);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPhotoDisplay, currentPhotoIndex, sortedResults, showThumbnailList, photoStarRating]);
  
  // Parse CSS style for photo display
  const parseCssStyle = (cssStyle) => {
    if (!cssStyle) return {};
    
    const style = {};
    const rules = cssStyle.split(';');
    
    rules.forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim());
      if (property && value) {
        const camelCaseProperty = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
        style[camelCaseProperty] = value;
      }
    });
    
    return style;
  };
  
  // Get current photo for display
  const getCurrentPhoto = () => {
    return sortedResults[currentPhotoIndex] || null;
  };
  
  // Get image source for photo display
  const getImageSrc = (photo) => {
    if (!photo || !photo.file || !photo.file.path) {
      return '';
    }
    const cachedSrc = imgCacheMap && imgCacheMap[photo.file.path] ? imgCacheMap[photo.file.path][0] : null;
    return cachedSrc || convertFileSrc(photo.file.path);
  };
  
  // Save photo star rating
  const savePhotoStar = async (photoPath, starRating) => {
    try {
      await invoke('save_star', {
        pathStr: photoPath,
        starNum: starRating
      });
    } catch (error) {
      console.error('Failed to save star rating:', error);
    }
  };
  
  // Save photo comment
  const savePhotoComment = async (photoPath, comment) => {
    try {
      await invoke('save_comment', {
        pathStr: photoPath,
        comment: comment
      });
      setPhotoComment(comment);
    } catch (error) {
      console.error('Failed to save comment:', error);
    }
  };
  
  // Load photo info when current photo changes
  useEffect(() => {
    if (sortedResults[currentPhotoIndex]) {
      const photo = sortedResults[currentPhotoIndex];
      setPhotoStarRating(photo.star_rating || 0);
      setPhotoComment(photo.comment || '');
    }
  }, [currentPhotoIndex, sortedResults]);
  
  // Sync with ImgCacheContext if available
  useEffect(() => {
    if (imgCacheContext?.imgCacheMap) {
      setImgCacheMap(imgCacheContext.imgCacheMap);
    }
  }, [imgCacheContext?.imgCacheMap]);

  // Function to get thumbnail path similar to PhotosList.jsx
  const getThumbnailSrc = (photo) => {
    if (!photo || !photo.file || !photo.file.path) {
      return '';
    }

    if (!photo.has_thumbnail) {
      return convertFileSrc(photo.file.path);
    }

    if (!thumbnailStore) {
      return convertFileSrc(photo.file.path);
    }

    // Extract UUID from the full file path
    // Path format: /path/to/target/2025-07-01/[UUID]/image.jpg
    const pathParts = photo.file.path.split('/');
    let uuid = null;
    
    // Look for UUID pattern in path parts
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        uuid = pathParts[i];
        break;
      }
    }
    
    // Extract date from path or use current date fallback
    let photoDate = '';
    const dateMatch = photo.file.path.match(/\/(\d{4}-\d{2}-\d{2})\//);  
    if (dateMatch) {
      photoDate = dateMatch[1];
    } else {
      // Fallback: try to get date from photo metadata or use a default
      photoDate = photo.date_taken ? photo.date_taken.split(' ')[0] : '2025-01-01';
    }
    
    let thumbnailSrc = '';
    if (uuid) {
      // Build thumbnail path with UUID directory
      if (photo.file.name.match(/(mp4|webm)$/i)) {
        thumbnailSrc = thumbnailStore + '/' + photoDate + '/' + uuid + '/' + photo.file.name + '.jpg';
      } else {
        // Fix the file extension replacement logic
        const baseName = photo.file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const extension = photo.file.name.match(/\.([^/.]+)$/);
        if (extension) {
          thumbnailSrc = thumbnailStore + '/' + photoDate + '/' + uuid + '/' + baseName + '.' + extension[1].toLowerCase();
        } else {
          thumbnailSrc = thumbnailStore + '/' + photoDate + '/' + uuid + '/' + photo.file.name;
        }
      }
    } else {
      // Fallback to old behavior if UUID cannot be extracted
      if (photo.file.name.match(/(mp4|webm)$/i)) {
        thumbnailSrc = thumbnailStore + '/' + photoDate + '/' + photo.file.name + '.jpg';
      } else {
        // Fix the file extension replacement logic
        const baseName = photo.file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const extension = photo.file.name.match(/\.([^/.]+)$/);
        if (extension) {
          thumbnailSrc = thumbnailStore + '/' + photoDate + '/' + baseName + '.' + extension[1].toLowerCase();
        } else {
          thumbnailSrc = thumbnailStore + '/' + photoDate + '/' + photo.file.name;
        }
      }
    }
    
    return convertFileSrc(thumbnailSrc);
  };

  const exportResults = async () => {
    try {
      const exportData = {
        query: searchQuery,
        timestamp: new Date().toISOString(),
        results: sortedResults.map(photo => ({
          path: photo.file.path,
          name: photo.file.name,
          relevance: photo.search_relevance || 0
        }))
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Use Tauri's save dialog
      await invoke('save_search_results', {
        data: jsonString,
        filename: `search_results_${new Date().toISOString().split('T')[0]}.json`
      });
    } catch (error) {
      console.error('Failed to export search results:', error);
    }
  };

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

  const currentPhoto = getCurrentPhoto();

  // Show PhotosListMini-style layout when a photo is clicked
  if (showPhotoDisplay) {
    return (
      <div className="inner-container">
        {/* Left column - Minimal info */}
        <div className="leftMenu">
          <div className="photo-display-info">
            <div className="results-info">
              <h3>Photo {currentPhotoIndex + 1} of {searchResults.length}</h3>
              <span className="results-count">
                Search: {searchQuery && `"${searchQuery}"`}
              </span>
            </div>
          </div>
        </div>
        
        {/* Center column - Photo display */}
        <div className="centerDisplay">
          <div className="photoDisplay" id="photoDisplay">
            <a href="#" id="dummy-for-focus">{/* Dummy */}</a>
            {currentPhotoIndex > 0 ? (
              <><a href="#" onClick={prevPhoto}>&lt;&lt; prev</a></>  
            ) : (
              <>&lt;&lt; <s>prev</s></>  
            )}
            &nbsp;&nbsp;|| 
            <a href="#" onClick={() => setShowPhotoDisplay(false)}>close</a>
            {currentPhotoIndex < (sortedResults.length - 1) ? (
              <> ||&nbsp;&nbsp;<a href="#" onClick={nextPhoto}>next &gt;&gt;</a><br /><br /></>
            ) : (
              <> ||&nbsp;&nbsp;<s>next</s> &gt;&gt;<br /><br /></>
            )}
            
            {/* Photo Display */}
            <div id="photo" className="photo">
              {currentPhoto && currentPhoto.file.path.match(/\.(mp4|webm)$/i) ? (
                <div className="video-on">
                  <video
                    controls
                    src={convertFileSrc(currentPhoto.file.path)}
                    style={{
                      ...imgStyle,
                      ...parseCssStyle(currentPhoto?.css_style)
                    }}
                  />
                </div>
              ) : (
                currentPhoto && (
                  <img 
                    id="photoImgTag"
                    src={getImageSrc(currentPhoto)}
                    alt={currentPhoto.file.name}
                    style={{
                      ...imgStyle,
                      ...parseCssStyle(currentPhoto?.css_style)
                    }}
                    onLoad={() => setIsImageLoading(false)}
                    onError={(e) => {
                      e.target.src = convertFileSrc(currentPhoto.file.path);
                    }}
                  />
                )
              )}
            </div>
          </div>
          
          {/* Thumbnail strip at bottom */}
          <div id="photos-list-mini" className={showThumbnailList ? "photosListMini" : "photosListMiniClosed"}>
            <div className="row1">
              <a style={{ display: currentPhotoIndex === 0 ? "none" : "" }} onClick={prevPhoto}>◁</a>
            </div>
            {sortedResults.map((photo, index) => {
              const thumbnailSrc = getThumbnailSrc(photo);
              const clientHeight = 80; // Fixed height for thumbnails
              
              return (
                <div className="row2" key={index}>
                  <a onClick={() => handlePhotoClick(photo, index)}>
                    {!photo.has_thumbnail && photo.file.path.match(/\.(mp4|webm)$/i) ? (
                      <div className="photo-list-movie" style={{ 
                        border: borderStyle[index] || '1px solid #444', 
                        maxHeight: clientHeight + "px" 
                      }}>
                        <span>🎬</span>
                      </div>
                    ) : (
                      <>
                        <img 
                          src={thumbnailSrc || convertFileSrc(photo.file.path)}
                          style={{ 
                            border: borderStyle[index] || '1px solid #444', 
                            maxHeight: clientHeight + "px",
                            ...parseCssStyle(photo.css_style)
                          }}
                          alt={`photo-${index}`}
                          onError={(e) => { 
                            // Fallback to original file if thumbnail fails
                            e.target.src = convertFileSrc(photo.file.path);
                          }}
                        />
                        {photo.file.path.match(/\.(mp4|webm)$/i) && (
                          <div style={{ color: "white", position: "relative", top: clientHeight / -4 }}>▶</div>
                        )}
                      </>
                    )}
                  </a>
                </div>
              );
            })}
            <div className="row1">
              <a style={{ display: currentPhotoIndex >= sortedResults.length - 1 ? "none" : "" }} onClick={nextPhoto}>▷</a>
            </div>
          </div>
          
          <div style={{ textAlign: "center", width: "100%", margin: "0px 0px 0px 0px", padding: "0px 0px 0px 0px" }}>
            <a href="#" onClick={() => setShowThumbnailList(!showThumbnailList)}>
              {showThumbnailList ? "▽ close mini list ▽" : "△ open mini list △"}
            </a>
          </div>
        </div>
        
        {/* Right column - Photo controls */}
        <div className="rightMenu">
          <h3>Photo Controls</h3>
          {currentPhoto && (
            <>
              <div className="photo-info-section">
                <h4>File Info</h4>
                <p><strong>Name:</strong> {currentPhoto.file.name}</p>
                <p><strong>Path:</strong> {currentPhoto.file.path}</p>
                {currentPhoto.camera_make && currentPhoto.camera_model && (
                  <p><strong>Camera:</strong> {currentPhoto.camera_make} {currentPhoto.camera_model}</p>
                )}
              </div>
              
              <div className="photo-rating-section">
                <h4>Rating</h4>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`star ${star <= photoStarRating ? 'filled' : ''}`}
                      onClick={() => {
                        const newRating = star === photoStarRating ? 0 : star;
                        setPhotoStarRating(newRating);
                        savePhotoStar(currentPhoto.file.path, newRating);
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p>Current: {photoStarRating}/5</p>
              </div>
              
              <div className="photo-comment-section">
                <h4>Comment</h4>
                <textarea
                  value={photoComment}
                  onChange={(e) => setPhotoComment(e.target.value)}
                  onBlur={() => savePhotoComment(currentPhoto.file.path, photoComment)}
                  placeholder="Add a comment..."
                  rows={4}
                  style={{ width: '100%', marginBottom: '10px' }}
                />
                <button onClick={() => savePhotoComment(currentPhoto.file.path, photoComment)}>
                  Save Comment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Default: Show original search results in grid/list format
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
      
      <div className={`search-results-content ${viewMode}`}>
        {sortedResults.map((photo, index) => (
          <div 
            key={`${photo.file.path}-${index}`}
            className="search-result-item"
            onClick={() => handlePhotoClick(photo, index)}
          >
            <div className="photo-thumbnail">
              {!photo.has_thumbnail && photo.file.path.match(/\.(mp4|webm)$/i) ? (
                <div className="photo-list-movie" style={{ minWidth: '180px', marginTop: '20px' }}>
                  <span style={{ fontSize: '60px' }}>🎬</span>
                </div>
              ) : (
                <img 
                  src={getThumbnailSrc(photo) || convertFileSrc(photo.file.path)}
                  alt={photo.file.name}
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to original file if thumbnail fails
                    e.target.src = convertFileSrc(photo.file.path);
                  }}
                />
              )}
              {photo.search_relevance && (
                <div className="relevance-badge">
                  {Math.round(photo.search_relevance * 100)}%
                </div>
              )}
            </div>
            
            <div className="photo-info">
              <div className="photo-name">
                {highlightSearchTerm(photo.file.name, searchQuery)}
              </div>
              <div className="photo-path">
                {highlightSearchTerm(photo.file.path, searchQuery)}
              </div>
              {photo.camera_make && photo.camera_model && (
                <div className="photo-camera">
                  {highlightSearchTerm(`${photo.camera_make} ${photo.camera_model}`, searchQuery)}
                </div>
              )}
              {photo.comment && (
                <div className="photo-comment">
                  {highlightSearchTerm(photo.comment, searchQuery)}
                </div>
              )}
              {photo.star_rating && photo.star_rating > 0 && (
                <div className="photo-rating">
                  {'★'.repeat(photo.star_rating)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;