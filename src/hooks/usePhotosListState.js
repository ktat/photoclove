/**
 * Main PhotosList state management hook
 * Combines all specialized hooks for centralized state management
 * Extracted from PhotosList.jsx to reduce complexity
 */
import { useState, useCallback, useMemo } from 'react';
import { usePhotosListDisplay } from './usePhotosListDisplay.js';
import { usePhotosListFilters } from './usePhotosListFilters.js';
import { usePhotosListSelection } from './usePhotosListSelection.js';
import { logger } from '../services/LoggerService.js';

export const usePhotosListState = () => {
  // Specialized hooks
  const photoDisplay = usePhotosListDisplay();
  const filters = usePhotosListFilters();
  const selection = usePhotosListSelection();
  
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
      
      // Use the display hook's load function
      await photoDisplay.loadPhotos(fetchConfig);
      
      logger.info('usePhotosListState', 'load_photos_with_config', 'Photos loaded with config', {
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
  }, [photoDisplay]);
  
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
  
  return {
    // Specialized hook state and functions
    ...photoDisplay,
    ...filters,
    ...selection,
    
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
    loadMorePhotos
  };
};