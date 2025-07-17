/**
 * Custom hook for thumbnail generation and management
 */
import { useState, useEffect, useCallback, useContext } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getThumbnailSrc, createThumbnailLoadingStrategy } from '../utils/thumbnailUtils';
import { ImgCacheContext } from '../App/ImgCacheContext.jsx';

export const useThumbnailGeneration = (options = {}) => {
  const {
    enableCaching = true,
    fallbackToOriginal = true,
    preloadNext = true
  } = options;
  
  // State
  const [thumbnailStore, setThumbnailStore] = useState('');
  const [loadingThumbnails, setLoadingThumbnails] = useState(new Set());
  const [errorThumbnails, setErrorThumbnails] = useState(new Set());
  
  // Context
  const imgCacheContext = useContext(ImgCacheContext);
  const imgCacheMap = imgCacheContext?.imgCacheMap || {};
  const setImgCacheMap = imgCacheContext?.setImgCacheMap || (() => {});
  
  // Load thumbnail store configuration
  useEffect(() => {
    const loadThumbnailStore = async () => {
      try {
        const config = await invoke('get_config', {});
        const parsedConfig = JSON.parse(config);
        setThumbnailStore(parsedConfig.thumbnail_store || '');
      } catch (error) {
        console.warn('Failed to load thumbnail store config:', error);
      }
    };
    
    loadThumbnailStore();
  }, []);
  
  // Get thumbnail source for a photo
  const getThumbnailSource = useCallback((photo) => {
    if (!photo?.file?.path) return null;
    
    const strategy = createThumbnailLoadingStrategy(
      photo.file.path,
      thumbnailStore,
      photo.has_thumbnail
    );
    
    return {
      primary: convertFileSrc(strategy.primary),
      fallback: convertFileSrc(strategy.fallback),
      isVideo: photo.file.path.toLowerCase().match(/\.(mp4|webm|mov|avi)$/i) !== null
    };
  }, [thumbnailStore]);
  
  // Load thumbnail with caching
  const loadThumbnail = useCallback(async (photo, forceReload = false) => {
    if (!photo?.file?.path) return null;
    
    const filePath = photo.file.path;
    
    // Check cache first
    if (enableCaching && !forceReload && imgCacheMap[filePath]) {
      return imgCacheMap[filePath];
    }
    
    // Check if already loading
    if (loadingThumbnails.has(filePath)) {
      return null;
    }
    
    setLoadingThumbnails(prev => new Set(prev).add(filePath));
    
    try {
      const thumbnailSource = getThumbnailSource(photo);
      
      if (thumbnailSource) {
        // Update cache if enabled
        if (enableCaching && setImgCacheMap) {
          setImgCacheMap(prev => ({
            ...prev,
            [filePath]: thumbnailSource.primary
          }));
        }
        
        // Remove from error set if it was there
        setErrorThumbnails(prev => {
          const newSet = new Set(prev);
          newSet.delete(filePath);
          return newSet;
        });
        
        return thumbnailSource.primary;
      }
    } catch (error) {
      console.warn('Error loading thumbnail:', error);
      setErrorThumbnails(prev => new Set(prev).add(filePath));
    } finally {
      setLoadingThumbnails(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    }
    
    return null;
  }, [
    enableCaching,
    imgCacheMap,
    setImgCacheMap,
    loadingThumbnails,
    getThumbnailSource
  ]);
  
  // Preload thumbnails for performance
  const preloadThumbnails = useCallback(async (photos, startIndex = 0, count = 5) => {
    if (!preloadNext || !Array.isArray(photos)) return;
    
    const endIndex = Math.min(startIndex + count, photos.length);
    const preloadPromises = [];
    
    for (let i = startIndex; i < endIndex; i++) {
      if (photos[i]) {
        preloadPromises.push(loadThumbnail(photos[i]));
      }
    }
    
    try {
      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.warn('Error preloading thumbnails:', error);
    }
  }, [preloadNext, loadThumbnail]);
  
  // Handle thumbnail load error with fallback
  const handleThumbnailError = useCallback((photo, imgElement) => {
    if (!photo?.file?.path || !imgElement) return;
    
    const filePath = photo.file.path;
    setErrorThumbnails(prev => new Set(prev).add(filePath));
    
    if (fallbackToOriginal) {
      const fallbackSrc = convertFileSrc(filePath);
      if (imgElement.src !== fallbackSrc) {
        imgElement.src = fallbackSrc;
      }
    }
  }, [fallbackToOriginal]);
  
  // Clear cache
  const clearThumbnailCache = useCallback(() => {
    if (setImgCacheMap) {
      setImgCacheMap({});
    }
    setErrorThumbnails(new Set());
    setLoadingThumbnails(new Set());
  }, [setImgCacheMap]);
  
  // Get cached thumbnail
  const getCachedThumbnail = useCallback((photo) => {
    if (!photo?.file?.path || !enableCaching) return null;
    return imgCacheMap[photo.file.path] || null;
  }, [imgCacheMap, enableCaching]);
  
  // Check if thumbnail is loading
  const isThumbnailLoading = useCallback((photo) => {
    if (!photo?.file?.path) return false;
    return loadingThumbnails.has(photo.file.path);
  }, [loadingThumbnails]);
  
  // Check if thumbnail has error
  const hasThumbnailError = useCallback((photo) => {
    if (!photo?.file?.path) return false;
    return errorThumbnails.has(photo.file.path);
  }, [errorThumbnails]);
  
  return {
    // Configuration
    thumbnailStore,
    
    // Functions
    getThumbnailSource,
    loadThumbnail,
    preloadThumbnails,
    handleThumbnailError,
    clearThumbnailCache,
    getCachedThumbnail,
    
    // Status checkers
    isThumbnailLoading,
    hasThumbnailError,
    
    // State
    loadingCount: loadingThumbnails.size,
    errorCount: errorThumbnails.size
  };
};