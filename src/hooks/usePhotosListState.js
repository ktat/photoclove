/**
 * Main PhotosList state management hook
 * Combines all specialized hooks for centralized state management
 * Extracted from PhotosList.jsx to reduce complexity
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { usePhotosListDisplay } from './usePhotosListDisplay.js';
import { usePhotosListFilters } from './usePhotosListFilters.js';
import { usePhotosListSelection } from './usePhotosListSelection.js';
import { usePhotosWithFilter } from './usePhotosQuery.js';
import { logger } from '../services/LoggerService.js';
import { photoCacheService } from '../services/PhotoCacheService.js';

export const usePhotosListState = (initialFetchConfig = null) => {
  // Specialized hooks
  const photoDisplay = usePhotosListDisplay();
  const filters = usePhotosListFilters();
  const selection = usePhotosListSelection();
  
  // Fetch config state
  const [fetchConfig, setFetchConfig] = useState(initialFetchConfig);
  
  // Use photos query with automatic caching and refetching
  const photosQuery = usePhotosWithFilter(fetchConfig, {
    enabled: !!fetchConfig,
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false // Disable for photo apps
  });
  
  // Update display hook when query succeeds
  useEffect(() => {
    if (photosQuery.isSuccess && photosQuery.data) {
      photoDisplay.setPhotosList(photosQuery.data);
      setAllPhotosForCurrentFetch(photosQuery.data.photos || []);
      
      logger.debug('usePhotosListState', 'photos_query_success', 'Photos loaded from query', {
        photoCount: photosQuery.data.photos?.length || 0
      });
    }
  }, [photosQuery.isSuccess, photosQuery.data, photoDisplay]);
  
  // Additional PhotosList-specific state
  const [config, setConfig] = useState(null);
  const [isLimitedByConfig, setIsLimitedByConfig] = useState(false);
  const [configLimit, setConfigLimit] = useState(null);
  
  // Infinite scroll state
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(true);
  const [displayedPhotoCount, setDisplayedPhotoCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // All photos for current fetch (unfiltered)
  const [allPhotosForCurrentFetch, setAllPhotosForCurrentFetch] = useState([]);
  
  // Photo tags cache
  const [photoTags, setPhotoTags] = useState({}); // Cache for photo tags: { photoPath: [tags] }
  
  // UI state
  const [showSideMenu, setShowSideMenu] = useState(false);
  
  // Album-related state
  const [filteredAlbums, setFilteredAlbums] = useState([]);
  const [albumSearchTerm, setAlbumSearchTerm] = useState('');
  const [currentAlbumName, setCurrentAlbumName] = useState('');
  
  // Rating state
  const [star, setStar] = useState([false, false, false, false, false]);
  
  // Get filtered photos using the filters hook
  const filteredPhotos = useMemo(() => {
    const photosArray = photoDisplay.photos.photos || [];
    return filters.applyFrontendFilters(photosArray);
  }, [photoDisplay.photos.photos, filters]);
  
  // Reset all state
  const resetAllState = useCallback(() => {
    photoDisplay.resetPhotoDisplay();
    filters.resetFilters();
    selection.clearSelection();
    setAllPhotosForCurrentFetch([]);
    setPhotoTags({});
    setShowSideMenu(false);
    setFilteredAlbums([]);
    setAlbumSearchTerm('');
    setCurrentAlbumName('');
    setStar([false, false, false, false, false]);
    
    logger.info('usePhotosListState', 'state_reset', 'All PhotosList state reset');
  }, [photoDisplay, filters, selection]);
  
  // Load photos with configuration
  const loadPhotosWithConfig = useCallback(async (fetchConfig, config) => {
    try {
      setConfig(config);
      
      // Check config limits
      if (config && config.max_photos_per_fetch) {
        setConfigLimit(config.max_photos_per_fetch);
        setIsLimitedByConfig(true);
      } else {
        setConfigLimit(null);
        setIsLimitedByConfig(false);
      }
      
      // Update fetch config to trigger React Query
      setFetchConfig(fetchConfig);
      
      logger.info('usePhotosListState', 'load_photos_with_config', 'Photos loading with React Query', {
        fetchConfig,
        configLimit: config?.max_photos_per_fetch
      });
    } catch (error) {
      logger.error('usePhotosListState', 'load_photos_error', 'Error loading photos with config', {
        error: error.message,
        fetchConfig
      });
      throw error;
    }
  }, []);
  
  // Update displayed photo count for infinite scroll
  const updateDisplayedPhotoCount = useCallback((count) => {
    setDisplayedPhotoCount(count);
    
    logger.debug('usePhotosListState', 'update_displayed_count', 'Displayed photo count updated', {
      count
    });
  }, []);
  
  // Load more photos for infinite scroll
  const loadMorePhotos = useCallback(async () => {
    if (isLoadingMore || !infiniteScrollEnabled) {
      return;
    }
    
    setIsLoadingMore(true);
    
    try {
      // Implement infinite scroll logic here
      const newCount = displayedPhotoCount + 50;
      setDisplayedPhotoCount(newCount);
      
      logger.debug('usePhotosListState', 'load_more_photos', 'Loading more photos', {
        previousCount: displayedPhotoCount,
        newCount
      });
    } catch (error) {
      logger.error('usePhotosListState', 'load_more_error', 'Error loading more photos', {
        error: error.message
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, infiniteScrollEnabled, displayedPhotoCount]);
  
  // Tag cache methods
  const getCachedTags = useCallback((photoPath) => {
    return photoCacheService.getTags(photoPath);
  }, []);
  
  const cacheTags = useCallback((photoPath, tags) => {
    photoCacheService.setTags(photoPath, tags);
    
    // Also update local cache
    setPhotoTags(prev => ({
      ...prev,
      [photoPath]: tags
    }));
  }, []);
  
  const invalidateTagsCache = useCallback((photoPath) => {
    photoCacheService.invalidateTags(photoPath);
    
    // Remove from local cache
    setPhotoTags(prev => {
      const newTags = { ...prev };
      delete newTags[photoPath];
      return newTags;
    });
  }, []);
  
  // Album cache methods
  const getCachedAlbumPhotos = useCallback((albumId) => {
    return photoCacheService.getAlbumPhotos(albumId);
  }, []);
  
  const cacheAlbumPhotos = useCallback((albumId, photos) => {
    photoCacheService.setAlbumPhotos(albumId, photos);
  }, []);
  
  // Cache statistics
  const getCacheStats = useCallback(() => {
    return photoCacheService.getStats();
  }, []);
  
  // Clear all caches
  const clearAllCaches = useCallback(() => {
    photoCacheService.clear();
    setPhotoTags({});
    
    logger.info('usePhotosListState', 'caches_cleared', 'All caches cleared');
  }, []);
  
  return {
    // Specialized hook state and functions
    ...photoDisplay,
    ...filters,
    ...selection,
    
    // React Query state
    isLoading: photosQuery.isLoading,
    isError: photosQuery.isError,
    error: photosQuery.error,
    isFetching: photosQuery.isFetching,
    refetch: photosQuery.refetch,
    
    // Additional state
    config,
    setConfig,
    isLimitedByConfig,
    setIsLimitedByConfig,
    configLimit,
    setConfigLimit,
    infiniteScrollEnabled,
    setInfiniteScrollEnabled,
    displayedPhotoCount,
    setDisplayedPhotoCount,
    isLoadingMore,
    setIsLoadingMore,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    photoTags,
    setPhotoTags,
    showSideMenu,
    setShowSideMenu,
    filteredAlbums,
    setFilteredAlbums,
    albumSearchTerm,
    setAlbumSearchTerm,
    currentAlbumName,
    setCurrentAlbumName,
    star,
    setStar,
    
    // Computed values
    filteredPhotos,
    
    // Combined functions
    resetAllState,
    loadPhotosWithConfig,
    updateDisplayedPhotoCount,
    loadMorePhotos,
    
    // Cache functions
    getCachedTags,
    cacheTags,
    invalidateTagsCache,
    getCachedAlbumPhotos,
    cacheAlbumPhotos,
    getCacheStats,
    clearAllCaches
  };
};