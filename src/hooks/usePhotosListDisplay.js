/**
 * Custom hook for PhotosList display state management
 * Extracted from PhotosList.jsx to reduce complexity
 */
import { useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';
import { photoCacheService } from '../services/PhotoCacheService.js';

export const usePhotosListDisplay = () => {
  // Photo display state
  const [photos, setPhotosList] = useState({ "photos": [] });
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(undefined);
  const [photoLoading, setPhotoLoading] = useState(false);
  
  // Photo list mini display state
  const [photosListMiniAllPhotos, setPhotosListMiniAllPhotos] = useState([]);
  const [photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex] = useState(0);
  const [photosListMiniReread, setPhotosListMiniReread] = useState(false);
  
  // Image source and caching state
  const [photosListImgSrc, setPhotosListImgSrc] = useState({});
  const [imgCacheMap, setImgCacheMap] = useState({});
  const [thumbnailStore, setThumbnailStore] = useState("");
  
  // Display configuration
  const [iconSize, setIconSize] = useState(100);
  const [numOfPhoto, setNumOfPhoto] = useState(20);
  const [sortOfPhotos, setSort] = useState(0);
  
  // Loading state management
  const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);
  
  // Load photos function
  const loadPhotos = useCallback(async (fetchConfig) => {
    if (!fetchConfig) {
      logger.warn('usePhotosListDisplay', 'load_photos_no_config', 'No fetch config provided');
      return;
    }
    
    setPhotoLoading(true);
    
    try {
      logger.info('usePhotosListDisplay', 'load_photos_start', 'Starting photo load', {
        fetchMethod: fetchConfig.fetch_method,
        value: fetchConfig.value
      });
      
      // This will be integrated with the actual photo loading logic
      // For now, just update the loading state
      
      logger.info('usePhotosListDisplay', 'load_photos_complete', 'Photo load completed');
    } catch (error) {
      logger.error('usePhotosListDisplay', 'load_photos_error', 'Error loading photos', { error: error.message });
    } finally {
      setPhotoLoading(false);
    }
  }, []);
  
  // Get thumbnail from cache or return null
  const getCachedThumbnail = useCallback((photoPath) => {
    return photoCacheService.getThumbnail(photoPath);
  }, []);
  
  // Cache thumbnail
  const cacheThumbnail = useCallback((photoPath, thumbnailData) => {
    photoCacheService.setThumbnail(photoPath, thumbnailData);
  }, []);
  
  // Get photo from cache
  const getCachedPhoto = useCallback((photoPath) => {
    return photoCacheService.getPhoto(photoPath);
  }, []);
  
  // Cache photo
  const cachePhoto = useCallback((photoPath, photoData) => {
    photoCacheService.setPhoto(photoPath, photoData);
  }, []);
  
  // Reset photo display state
  const resetPhotoDisplay = useCallback(() => {
    setPhotosList({ "photos": [] });
    setCurrentPhoto(null);
    setCurrentPhotoIndex(undefined);
    setPhotosListMiniAllPhotos([]);
    setPhotosListMiniCurrentIndex(0);
    setPhotosListMiniReread(false);
    setPhotosListImgSrc({});
    
    logger.debug('usePhotosListDisplay', 'reset_display', 'Photo display state reset');
  }, []);
  
  // Update current photo
  const updateCurrentPhoto = useCallback((photo, index) => {
    setCurrentPhoto(photo);
    setCurrentPhotoIndex(index);

    logger.debug('usePhotosListDisplay', 'update_current_photo', 'Current photo updated', {
      photoPath: photo?.originalPath,
      index
    });
  }, []);
  
  return {
    // State
    photos,
    currentPhoto,
    currentPhotoIndex,
    photoLoading,
    photosListMiniAllPhotos,
    photosListMiniCurrentIndex,
    photosListMiniReread,
    photosListImgSrc,
    imgCacheMap,
    thumbnailStore,
    iconSize,
    numOfPhoto,
    sortOfPhotos,
    currentPhotoLoadingController,
    
    // Setters
    setPhotosList,
    setCurrentPhoto,
    setCurrentPhotoIndex,
    setPhotoLoading,
    setPhotosListMiniAllPhotos,
    setPhotosListMiniCurrentIndex,
    setPhotosListMiniReread,
    setPhotosListImgSrc,
    setImgCacheMap,
    setThumbnailStore,
    setIconSize,
    setNumOfPhoto,
    setSort,
    setCurrentPhotoLoadingController,
    
    // Functions
    loadPhotos,
    resetPhotoDisplay,
    updateCurrentPhoto,
    
    // Cache functions
    getCachedThumbnail,
    cacheThumbnail,
    getCachedPhoto,
    cachePhoto
  };
};