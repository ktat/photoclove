import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

export const useSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('photo_search_history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        logger.error('useSearch', 'history_load_failed', 'Failed to load search history from localStorage', {
          error: error.message
        });
      }
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = useCallback((query, type, resultCount) => {
    const historyItem = {
      query,
      type,
      resultCount,
      timestamp: new Date().toISOString()
    };

    setSearchHistory(prev => {
      const newHistory = [historyItem, ...prev.filter(item => 
        item.query !== query || item.type !== type
      )].slice(0, 10); // Keep only last 10 searches
      
      localStorage.setItem('photo_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const performSearch = useCallback(async (query, type = 'all', filters = {}, sortField = 'exif_date_time_original', sortOrder = 'desc') => {
    const correlationId = logger.generateCorrelationId();
    const startTime = performance.now();
    
    logger.debug('useSearch', 'search_initiated', 'Search function called', {
      query, type, filters, sortField, sortOrder, correlationId
    });
    
    // Check if we have any active filters
    const hasActiveFilters = Object.keys(filters).some(key => {
      const value = filters[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value > 0;
      if (typeof value === 'string') return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v && v.toString().length > 0);
      }
      return false;
    });

    logger.debug('useSearch', 'filter_analysis', 'Analyzed filter state', {
      hasActiveFilters, 
      filterCount: Object.keys(filters).length,
      correlationId
    });

    // If no query and no filters, clear results
    if (!query.trim() && !hasActiveFilters) {
      logger.info('useSearch', 'search_cleared', 'No query or filters, clearing results', {
        correlationId
      });
      setSearchResults([]);
      setSearchQuery('');
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);
    setSearchType(type);

    try {
      // Transform nested filter structure to flat structure expected by backend
      const transformedFilters = {
        camera: filters.camera || '',
        lens: filters.lens || '',
        iso_min: filters.isoRange?.min || '',
        iso_max: filters.isoRange?.max || '',
        aperture_min: filters.apertureRange?.min || '',
        aperture_max: filters.apertureRange?.max || '',
        shutter_speed_min: filters.shutterSpeedRange?.min || '',
        shutter_speed_max: filters.shutterSpeedRange?.max || '',
        focal_length_min: filters.focalLengthRange?.min || '',
        focal_length_max: filters.focalLengthRange?.max || '',
        start_date: filters.dateRange?.start || '',
        end_date: filters.dateRange?.end || '',
        has_comments: filters.hasComment || false,
        min_rating: filters.starRating || 0,
        extension: filters.fileExtension || ''
      };
      
      logger.debug('useSearch', 'filter_transformed', 'Filters transformed for backend', {
        originalFilters: filters,
        transformedFilters,
        correlationId
      });
      
      logger.info('useSearch', 'tauri_invoke_start', 'Calling search_photos command', {
        query: query.trim(), 
        searchType: type, 
        filterCount: Object.keys(transformedFilters).filter(key => transformedFilters[key]).length,
        correlationId
      });
      
      const result = await invoke('search_photos', {
        query: query.trim(),
        searchType: type,
        filters: JSON.stringify(transformedFilters),
        sortField,
        sortOrder
      });
      
      const endTime = performance.now();
      const searchData = JSON.parse(result);

      logger.info('useSearch', 'search_completed', 'Search completed successfully', {
        resultCount: searchData.length,
        duration_ms: Math.round(endTime - startTime),
        correlationId
      });

      setSearchResults(searchData);
      
      // Save to history
      saveSearchHistory(query, type, searchData.length);
      
      return searchData;
    } catch (error) {
      const endTime = performance.now();
      
      logger.error('useSearch', 'search_failed', 'Search operation failed', {
        error: error.message,
        errorType: typeof error,
        duration_ms: Math.round(endTime - startTime),
        correlationId
      });
      
      setSearchResults([]);
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, [saveSearchHistory]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
    setSearchType('all');
  }, []);

  const deleteFromHistory = useCallback((index) => {
    setSearchHistory(prev => {
      const newHistory = prev.filter((_, i) => i !== index);
      localStorage.setItem('photo_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('photo_search_history');
  }, []);

  return {
    searchResults,
    isSearching,
    searchQuery,
    searchType,
    searchHistory,
    performSearch,
    clearSearch,
    deleteFromHistory,
    clearHistory
  };
};

export default useSearch;