/**
 * BaseThumbnailStrip - Horizontal thumbnail navigation component
 * Handles carousel-style scrolling, current selection highlighting, and configurable size/count
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useThumbnailGeneration } from '../hooks/useThumbnailGeneration';
import { isVideoFile, getFileName } from '../utils/photoUtils';

const BaseThumbnailStrip = ({
  photos = [],
  currentIndex = 0,
  onPhotoSelect = null,
  thumbnailSize = 80,
  visibleCount = 9,
  showFileName = false,
  showControls = true,
  orientation = 'horizontal', // 'horizontal' or 'vertical'
  className = '',
  style = {},
  ...props
}) => {
  // State
  const [stripIndex, setStripIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [errorImages, setErrorImages] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // Refs
  const stripRef = useRef(null);
  const containerRef = useRef(null);
  
  // Hooks
  const { getThumbnailSource, handleThumbnailError } = useThumbnailGeneration();
  
  // Calculate visible photos range
  const visiblePhotos = useMemo(() => {
    const start = Math.max(0, stripIndex);
    const end = Math.min(photos.length, stripIndex + visibleCount);
    return photos.slice(start, end);
  }, [photos, stripIndex, visibleCount]);
  
  // Auto-scroll to keep current photo visible
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < photos.length) {
      // Check if current photo is visible
      const isVisible = currentIndex >= stripIndex && currentIndex < stripIndex + visibleCount;
      
      if (!isVisible) {
        // Scroll to center the current photo
        const newStripIndex = Math.max(0, currentIndex - Math.floor(visibleCount / 2));
        setStripIndex(newStripIndex);
      }
    }
  }, [currentIndex, photos.length, stripIndex, visibleCount]);
  
  // Handle photo selection
  const handlePhotoClick = useCallback((photo, index, event) => {
    event.preventDefault();
    
    if (onPhotoSelect) {
      const actualIndex = stripIndex + index;
      onPhotoSelect(photo, actualIndex, event);
    }
  }, [onPhotoSelect, stripIndex]);
  
  // Navigation functions
  const scrollLeft = useCallback(() => {
    const newIndex = Math.max(0, stripIndex - 1);
    setStripIndex(newIndex);
  }, [stripIndex]);
  
  const scrollRight = useCallback(() => {
    const maxIndex = Math.max(0, photos.length - visibleCount);
    const newIndex = Math.min(maxIndex, stripIndex + 1);
    setStripIndex(newIndex);
  }, [stripIndex, photos.length, visibleCount]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((event) => {
    switch (event.key) {
      case 'ArrowLeft':
        if (orientation === 'horizontal') {
          event.preventDefault();
          scrollLeft();
        }
        break;
      case 'ArrowRight':
        if (orientation === 'horizontal') {
          event.preventDefault();
          scrollRight();
        }
        break;
      case 'ArrowUp':
        if (orientation === 'vertical') {
          event.preventDefault();
          scrollLeft(); // Up = previous in vertical
        }
        break;
      case 'ArrowDown':
        if (orientation === 'vertical') {
          event.preventDefault();
          scrollRight(); // Down = next in vertical
        }
        break;
      default:
        break;
    }
  }, [orientation, scrollLeft, scrollRight]);
  
  // Handle touch/mouse drag
  const handleDragStart = useCallback((event) => {
    setIsDragging(true);
    const clientPos = orientation === 'horizontal' ? event.clientX : event.clientY;
    setDragStart(clientPos);
    setScrollOffset(0);
  }, [orientation]);
  
  const handleDragMove = useCallback((event) => {
    if (!isDragging) return;
    
    const clientPos = orientation === 'horizontal' ? event.clientX : event.clientY;
    const offset = clientPos - dragStart;
    setScrollOffset(offset);
  }, [isDragging, dragStart, orientation]);
  
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Determine if we should scroll based on drag distance
    const threshold = thumbnailSize / 3;
    
    if (Math.abs(scrollOffset) > threshold) {
      if (scrollOffset > 0) {
        scrollLeft();
      } else {
        scrollRight();
      }
    }
    
    setScrollOffset(0);
  }, [isDragging, scrollOffset, thumbnailSize, scrollLeft, scrollRight]);
  
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
  
  // Setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('mousedown', handleDragStart);
    container.addEventListener('mousemove', handleDragMove);
    container.addEventListener('mouseup', handleDragEnd);
    container.addEventListener('mouseleave', handleDragEnd);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('mousedown', handleDragStart);
      container.removeEventListener('mousemove', handleDragMove);
      container.removeEventListener('mouseup', handleDragEnd);
      container.removeEventListener('mouseleave', handleDragEnd);
    };
  }, [handleKeyDown, handleDragStart, handleDragMove, handleDragEnd]);
  
  // Render thumbnail item
  const renderThumbnailItem = useCallback((photo, index) => {
    if (!photo) return null;
    
    const actualIndex = stripIndex + index;
    const isSelected = currentIndex === actualIndex;
    const isLoaded = loadedImages.has(index);
    const hasError = errorImages.has(index);
    const isVideo = isVideoFile(photo.file.path);
    
    const thumbnailSource = getThumbnailSource(photo);
    const imageSrc = thumbnailSource ? thumbnailSource.primary : convertFileSrc(photo.file.path);
    
    const itemStyles = {
      width: thumbnailSize,
      height: thumbnailSize + (showFileName ? 20 : 0),
      border: isSelected ? '3px solid #4a9eff' : '1px solid #444',
      opacity: isLoaded ? 1 : 0.5,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      flexShrink: 0
    };
    
    const fileName = getFileName(photo.file.path);
    
    return (
      <div
        key={`${photo.file.path}-${actualIndex}`}
        className={`thumbnail-strip-item ${isSelected ? 'selected' : ''}`}
        style={itemStyles}
        onClick={(e) => handlePhotoClick(photo, index, e)}
        title={fileName}
      >
        <div className="thumbnail-image-container">
          <img
            src={imageSrc}
            alt={fileName}
            className="thumbnail-image"
            style={{
              width: thumbnailSize,
              height: thumbnailSize,
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
            {fileName.length > 12 ? fileName.substring(0, 9) + '...' : fileName}
          </div>
        )}
      </div>
    );
  }, [
    stripIndex,
    currentIndex,
    loadedImages,
    errorImages,
    thumbnailSize,
    showFileName,
    getThumbnailSource,
    handlePhotoClick,
    handleThumbnailLoad,
    handleThumbnailLoadError
  ]);
  
  // Calculate strip styles
  const stripStyles = {
    display: 'flex',
    flexDirection: orientation === 'horizontal' ? 'row' : 'column',
    gap: 5,
    transition: isDragging ? 'none' : 'transform 0.3s ease',
    transform: `translate${orientation === 'horizontal' ? 'X' : 'Y'}(${scrollOffset}px)`
  };
  
  const containerStyles = {
    ...style,
    overflow: 'hidden',
    position: 'relative',
    width: orientation === 'horizontal' ? '100%' : thumbnailSize + 20,
    height: orientation === 'vertical' ? '100%' : thumbnailSize + (showFileName ? 20 : 0) + 20
  };
  
  if (photos.length === 0) {
    return (
      <div className={`base-thumbnail-strip empty ${className}`} style={containerStyles}>
        <div className="empty-message">No photos</div>
      </div>
    );
  }
  
  const canScrollLeft = stripIndex > 0;
  const canScrollRight = stripIndex + visibleCount < photos.length;
  
  return (
    <div 
      ref={containerRef}
      className={`base-thumbnail-strip ${orientation} ${className}`} 
      style={containerStyles}
      tabIndex={0}
      {...props}
    >
      {showControls && canScrollLeft && (
        <button
          className={`strip-control prev ${orientation}`}
          onClick={scrollLeft}
          style={{
            position: 'absolute',
            [orientation === 'horizontal' ? 'left' : 'top']: 0,
            zIndex: 2
          }}
        >
          {orientation === 'horizontal' ? '‹' : '‹'}
        </button>
      )}
      
      <div 
        ref={stripRef}
        className="thumbnail-strip-container"
        style={stripStyles}
      >
        {visiblePhotos.map((photo, index) => renderThumbnailItem(photo, index))}
      </div>
      
      {showControls && canScrollRight && (
        <button
          className={`strip-control next ${orientation}`}
          onClick={scrollRight}
          style={{
            position: 'absolute',
            [orientation === 'horizontal' ? 'right' : 'bottom']: 0,
            zIndex: 2
          }}
        >
          {orientation === 'horizontal' ? '›' : '›'}
        </button>
      )}
      
      <div className="strip-info">
        <span className="position-info">
          {currentIndex + 1} / {photos.length}
        </span>
      </div>
    </div>
  );
};

export default BaseThumbnailStrip;