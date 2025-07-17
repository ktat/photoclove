/**
 * BaseThumbnailGrid - Configurable thumbnail grid display component
 * Handles grid/list display, thumbnail generation, selection, pagination, and sorting
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useThumbnailGeneration } from '../hooks/useThumbnailGeneration';
import { isVideoFile, formatFileSize, getFileName, debounce } from '../utils/photoUtils';

const BaseThumbnailGrid = ({
  photos = [],
  selectedIndex = -1,
  onPhotoSelect = null,
  onPhotoDoubleClick = null,
  viewMode = 'grid', // 'grid' or 'list'
  thumbnailSize = 150,
  showFileName = true,
  showFileInfo = true,
  sortBy = 'name',
  sortOrder = 'asc',
  enableSelection = true,
  enablePagination = false,
  photosPerPage = 50,
  currentPage = 0,
  onPageChange = null,
  className = '',
  style = {},
  ...props
}) => {
  // State
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [errorImages, setErrorImages] = useState(new Set());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Hooks
  const { 
    getThumbnailSource, 
    handleThumbnailError, 
    preloadThumbnails 
  } = useThumbnailGeneration();
  
  // Sort photos
  const sortedPhotos = useMemo(() => {
    if (!Array.isArray(photos)) return [];
    
    const sorted = [...photos];
    
    sorted.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'name':
          valueA = getFileName(a.file.path).toLowerCase();
          valueB = getFileName(b.file.path).toLowerCase();
          break;
        case 'date':
          valueA = new Date(a.date_taken || 0);
          valueB = new Date(b.date_taken || 0);
          break;
        case 'size':
          valueA = a.file_size || 0;
          valueB = b.file_size || 0;
          break;
        case 'rating':
          valueA = a.star_rating || 0;
          valueB = b.star_rating || 0;
          break;
        case 'relevance':
          valueA = a.search_relevance || 0;
          valueB = b.search_relevance || 0;
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [photos, sortBy, sortOrder]);
  
  // Paginate photos if enabled
  const paginatedPhotos = useMemo(() => {
    if (!enablePagination) return sortedPhotos;
    
    const startIndex = currentPage * photosPerPage;
    const endIndex = startIndex + photosPerPage;
    return sortedPhotos.slice(startIndex, endIndex);
  }, [sortedPhotos, enablePagination, currentPage, photosPerPage]);
  
  // Calculate grid layout
  const gridLayout = useMemo(() => {
    if (viewMode === 'list') {
      return {
        columns: 1,
        itemWidth: '100%',
        itemHeight: 80
      };
    }
    
    // Calculate columns based on container width and thumbnail size
    const containerWidth = containerSize.width || 800;
    const margin = 10;
    const minColumns = 1;
    const maxColumns = 10;
    
    const columns = Math.max(
      minColumns,
      Math.min(
        maxColumns,
        Math.floor(containerWidth / (thumbnailSize + margin))
      )
    );
    
    return {
      columns,
      itemWidth: thumbnailSize,
      itemHeight: thumbnailSize + (showFileName ? 40 : 0) + (showFileInfo ? 20 : 0)
    };
  }, [viewMode, containerSize.width, thumbnailSize, showFileName, showFileInfo]);
  
  // Handle photo selection
  const handlePhotoClick = useCallback((photo, index, event) => {
    event.preventDefault();
    
    if (enableSelection && onPhotoSelect) {
      // Calculate actual index in full sorted array if paginated
      const actualIndex = enablePagination ? 
        (currentPage * photosPerPage) + index : 
        index;
      onPhotoSelect(photo, actualIndex, event);
    }
  }, [enableSelection, onPhotoSelect, enablePagination, currentPage, photosPerPage]);
  
  // Handle photo double click
  const handlePhotoDoubleClick = useCallback((photo, index, event) => {
    event.preventDefault();
    
    if (onPhotoDoubleClick) {
      const actualIndex = enablePagination ? 
        (currentPage * photosPerPage) + index : 
        index;
      onPhotoDoubleClick(photo, actualIndex, event);
    }
  }, [onPhotoDoubleClick, enablePagination, currentPage, photosPerPage]);
  
  // Handle thumbnail load success
  const handleThumbnailLoad = useCallback((photo, index) => {
    setLoadedImages(prev => new Set(prev).add(index));
    setErrorImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);
  
  // Handle thumbnail load error
  const handleThumbnailLoadError = useCallback((photo, index, event) => {
    setErrorImages(prev => new Set(prev).add(index));
    if (photo) {
      handleThumbnailError(photo, event.target);
    }
  }, [handleThumbnailError]);
  
  // Preload thumbnails when photos change
  useEffect(() => {
    if (paginatedPhotos.length > 0) {
      const debouncedPreload = debounce(() => {
        preloadThumbnails(paginatedPhotos, 0, Math.min(20, paginatedPhotos.length));
      }, 100);
      
      debouncedPreload();
    }
  }, [paginatedPhotos, preloadThumbnails]);
  
  // Render thumbnail item
  const renderThumbnailItem = useCallback((photo, index) => {
    if (!photo) return null;
    
    const isSelected = enableSelection && (
      enablePagination ? 
        selectedIndex === (currentPage * photosPerPage) + index :
        selectedIndex === index
    );
    const isHovered = hoveredIndex === index;
    const isLoaded = loadedImages.has(index);
    const hasError = errorImages.has(index);
    const isVideo = isVideoFile(photo.file.path);
    
    const thumbnailSource = getThumbnailSource(photo);
    const imageSrc = thumbnailSource ? thumbnailSource.primary : convertFileSrc(photo.file.path);
    
    const itemStyles = {
      width: viewMode === 'grid' ? gridLayout.itemWidth : '100%',
      height: gridLayout.itemHeight,
      border: isSelected ? '3px solid #4a9eff' : '1px solid #444',
      opacity: isLoaded ? 1 : 0.5,
      cursor: enableSelection ? 'pointer' : 'default',
      transition: 'all 0.2s ease'
    };
    
    const fileName = getFileName(photo.file.path);
    
    return (
      <div
        key={`${photo.file.path}-${index}`}
        className={`thumbnail-item ${viewMode} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        style={itemStyles}
        onClick={(e) => handlePhotoClick(photo, index, e)}
        onDoubleClick={(e) => handlePhotoDoubleClick(photo, index, e)}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(-1)}
      >
        <div className="thumbnail-image-container">
          <img
            src={imageSrc}
            alt={fileName}
            className="thumbnail-image"
            style={{
              width: viewMode === 'grid' ? thumbnailSize : 60,
              height: viewMode === 'grid' ? thumbnailSize : 60,
              objectFit: 'cover'
            }}
            onLoad={() => handleThumbnailLoad(photo, index)}
            onError={(e) => handleThumbnailLoadError(photo, index, e)}
            draggable={false}
          />
          
          {isVideo && (
            <div className="video-indicator">
              <span>▶</span>
            </div>
          )}
          
          {photo.star_rating > 0 && (
            <div className="rating-indicator">
              {'★'.repeat(photo.star_rating)}
            </div>
          )}
          
          {hasError && (
            <div className="error-indicator">
              <span>⚠</span>
            </div>
          )}
        </div>
        
        {showFileName && (
          <div className="thumbnail-filename" title={fileName}>
            {fileName}
          </div>
        )}
        
        {showFileInfo && (
          <div className="thumbnail-info">
            {photo.file_size && (
              <span className="file-size">{formatFileSize(photo.file_size)}</span>
            )}
            {photo.date_taken && (
              <span className="date-taken">{new Date(photo.date_taken).toLocaleDateString()}</span>
            )}
          </div>
        )}
      </div>
    );
  }, [
    enableSelection,
    selectedIndex,
    hoveredIndex,
    loadedImages,
    errorImages,
    viewMode,
    gridLayout,
    thumbnailSize,
    showFileName,
    showFileInfo,
    getThumbnailSource,
    handlePhotoClick,
    handlePhotoDoubleClick,
    handleThumbnailLoad,
    handleThumbnailLoadError,
    currentPage,
    photosPerPage,
    enablePagination
  ]);
  
  // Render pagination
  const renderPagination = useCallback(() => {
    if (!enablePagination) return null;
    
    const totalPages = Math.ceil(sortedPhotos.length / photosPerPage);
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="thumbnail-pagination">
        <button
          disabled={currentPage === 0}
          onClick={() => onPageChange && onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        
        <span className="page-info">
          Page {currentPage + 1} of {totalPages}
        </span>
        
        <button
          disabled={currentPage === totalPages - 1}
          onClick={() => onPageChange && onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    );
  }, [enablePagination, sortedPhotos.length, photosPerPage, currentPage, onPageChange]);
  
  if (paginatedPhotos.length === 0) {
    return (
      <div className={`base-thumbnail-grid empty ${className}`} style={style}>
        <div className="empty-message">No photos to display</div>
      </div>
    );
  }
  
  return (
    <div className={`base-thumbnail-grid ${viewMode} ${className}`} style={style} {...props}>
      <div 
        className={`thumbnail-container ${viewMode}`}
        style={{
          display: viewMode === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridLayout.columns}, 1fr)` : undefined,
          flexDirection: viewMode === 'list' ? 'column' : undefined,
          gap: 10
        }}
      >
        {paginatedPhotos.map((photo, index) => renderThumbnailItem(photo, index))}
      </div>
      
      {renderPagination()}
      
      <div className="grid-info">
        <span className="photo-count">
          {enablePagination ? 
            `${currentPage * photosPerPage + 1}-${Math.min((currentPage + 1) * photosPerPage, sortedPhotos.length)} of ${sortedPhotos.length}` :
            `${paginatedPhotos.length} photos`
          }
        </span>
      </div>
    </div>
  );
};

export default BaseThumbnailGrid;