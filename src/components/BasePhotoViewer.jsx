/**
 * BasePhotoViewer - Core photo display component
 * Handles single photo display (image/video), zoom, CSS styles, and basic interactions
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { parseCssStyle, isVideoFile, isImageFile, handleImageError } from '../utils/photoUtils';
import { useThumbnailGeneration } from '../hooks/useThumbnailGeneration';

const BasePhotoViewer = ({
  photo,
  photoZoom = 'auto',
  onPhotoLoad = null,
  onPhotoError = null,
  onPhotoClick = null,
  showControls = true,
  enableZoom = true,
  className = '',
  style = {},
  ...props
}) => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imgStyle, setImgStyle] = useState({
    transition: 'opacity 0.1s',
    opacity: 0,
    maxWidth: '100%',
    maxHeight: '100%',
    overflow: 'hidden'
  });
  const [photoSize, setPhotoSize] = useState({ width: 0, height: 0 });
  
  // Refs
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  
  // Hooks
  const { getThumbnailSource, handleThumbnailError } = useThumbnailGeneration();
  
  // Check file type
  const isVideo = photo ? isVideoFile(photo.file.path) : false;
  const isImage = photo ? isImageFile(photo.file.path) : false;
  
  // Get photo source with thumbnail fallback
  const getPhotoSource = useCallback(() => {
    if (!photo) return null;
    
    // For video files, always use original
    if (isVideo) {
      return convertFileSrc(photo.file.path);
    }
    
    // For images, try thumbnail first
    const thumbnailSource = getThumbnailSource(photo);
    return thumbnailSource ? thumbnailSource.primary : convertFileSrc(photo.file.path);
  }, [photo, isVideo, getThumbnailSource]);
  
  // Apply CSS styles from photo metadata
  const getPhotoStyles = useCallback(() => {
    const baseStyles = { ...imgStyle };
    
    // Apply zoom
    if (enableZoom && photoZoom !== 'auto') {
      if (photoZoom.endsWith('%')) {
        const zoomValue = parseInt(photoZoom) / 100;
        baseStyles.transform = `scale(${zoomValue})`;
        baseStyles.transformOrigin = 'center center';
      }
    }
    
    // Apply photo-specific CSS styles
    if (photo?.css_style) {
      const photoStyles = parseCssStyle(photo.css_style);
      Object.assign(baseStyles, photoStyles);
    }
    
    return baseStyles;
  }, [imgStyle, enableZoom, photoZoom, photo]);
  
  // Handle image load success
  const handleLoad = useCallback((event) => {
    setIsLoading(false);
    setHasError(false);
    setImgStyle(prev => ({ ...prev, opacity: 1 }));
    
    // Get image dimensions
    if (event.target.naturalWidth && event.target.naturalHeight) {
      setPhotoSize({
        width: event.target.naturalWidth,
        height: event.target.naturalHeight
      });
    }
    
    if (onPhotoLoad) {
      onPhotoLoad(photo, event);
    }
  }, [photo, onPhotoLoad]);
  
  // Handle load error with fallback
  const handleError = useCallback((event) => {
    setIsLoading(false);
    
    if (photo && !isVideo) {
      // Try fallback to original file if thumbnail failed
      const originalSrc = convertFileSrc(photo.file.path);
      if (event.target.src !== originalSrc) {
        event.target.src = originalSrc;
        return;
      }
      
      // If even original fails, handle as final error
      handleThumbnailError(photo, event.target);
    }
    
    setHasError(true);
    setImgStyle(prev => ({ ...prev, opacity: 0.3 }));
    
    if (onPhotoError) {
      onPhotoError(photo, event);
    }
  }, [photo, isVideo, handleThumbnailError, onPhotoError]);
  
  // Handle photo click
  const handleClick = useCallback((event) => {
    if (onPhotoClick) {
      onPhotoClick(photo, event);
    }
  }, [photo, onPhotoClick]);
  
  // Reset state when photo changes
  useEffect(() => {
    if (photo) {
      setIsLoading(true);
      setHasError(false);
      setImgStyle(prev => ({ ...prev, opacity: 0 }));
      setPhotoSize({ width: 0, height: 0 });
    }
  }, [photo]);
  
  // Don't render if no photo
  if (!photo) {
    return (
      <div className={`base-photo-viewer no-photo ${className}`} style={style}>
        <div className="no-photo-message">No photo selected</div>
      </div>
    );
  }
  
  const photoStyles = getPhotoStyles();
  const photoSrc = getPhotoSource();
  
  return (
    <div className={`base-photo-viewer ${className}`} style={style} {...props}>
      {isVideo ? (
        <video
          ref={videoRef}
          src={photoSrc}
          style={photoStyles}
          controls={showControls}
          onLoadedData={handleLoad}
          onError={handleError}
          onClick={handleClick}
          className="photo-viewer-video"
        />
      ) : (
        <img
          ref={imgRef}
          src={photoSrc}
          alt={photo.file.name}
          style={photoStyles}
          onLoad={handleLoad}
          onError={handleError}
          onClick={handleClick}
          className="photo-viewer-image"
          draggable={false}
        />
      )}
      
      {isLoading && (
        <div className="photo-viewer-loading">
          <div className="loading-spinner">Loading...</div>
        </div>
      )}
      
      {hasError && (
        <div className="photo-viewer-error">
          <div className="error-message">
            Failed to load: {photo.file.name}
          </div>
        </div>
      )}
      
      {enableZoom && showControls && (
        <div className="photo-viewer-info">
          <div className="photo-size">
            {photoSize.width > 0 && photoSize.height > 0 && 
              `${photoSize.width} × ${photoSize.height}`
            }
          </div>
          <div className="photo-zoom">
            Zoom: {photoZoom}
          </div>
        </div>
      )}
    </div>
  );
};

export default BasePhotoViewer;