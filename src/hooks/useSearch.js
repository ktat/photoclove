import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

export const useSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from localStorage with backward compatibility
  useEffect(() => {
    const savedHistory = localStorage.getItem('photo_search_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Convert old format (string array) to new format (object array)
        const converted = parsed.map(item => {
          if (typeof item === 'string') {
            // Old format: convert string to new object structure
            return {
              query: item,
              type: 'all',
              filters: {},
              sortField: 'exif_date_time_original',
              sortOrder: 'desc',
              resultCount: 0,
              timestamp: new Date().toISOString()
            };
          }
          // New format: ensure all required fields exist
          return {
            query: item.query || '',
            type: item.type || 'all',
            filters: item.filters || {},
            sortField: item.sortField || 'exif_date_time_original',
            sortOrder: item.sortOrder || 'desc',
            resultCount: item.resultCount || 0,
            timestamp: item.timestamp || new Date().toISOString()
          };
        });
        
        setSearchHistory(converted);
        
        // Save converted format back to localStorage if conversion occurred
        if (converted.some((item, index) => typeof parsed[index] === 'string' || !parsed[index].filters)) {
          localStorage.setItem('photo_search_history', JSON.stringify(converted));
        }
      } catch (error) {
        logger.error('useSearch', 'history_load_failed', 'Failed to load search history from localStorage', {
          error: error.message
        });
        setSearchHistory([]);
      }
    }
  }, []);

  // Save search history to localStorage with extended data structure
  const saveSearchHistory = useCallback((query, type, filters = {}, sortField = null, sortOrder = null, resultCount = 0) => {
    if (!query.trim()) return;
    
    const historyItem = {
      query: query.trim(),
      type,
      filters: { ...filters }, // deep copy of filters
      sortField: sortField || 'exif_date_time_original',
      sortOrder: sortOrder || 'desc',
      resultCount,
      timestamp: new Date().toISOString()
    };

    setSearchHistory(prev => {
      // Remove duplicate entries (same query + filters + sort combination)
      const filtered = prev.filter(item => {
        // Handle backward compatibility with old string format
        if (typeof item === 'string') {
          return item !== query.trim();
        }
        // New format: check for duplicates based on query, filters, and sort
        return !(
          item.query === query.trim() && 
          JSON.stringify(item.filters) === JSON.stringify(filters) &&
          item.sortField === (sortField || 'exif_date_time_original') &&
          item.sortOrder === (sortOrder || 'desc')
        );
      });
      
      const newHistory = [historyItem, ...filtered].slice(0, 10); // Keep only last 10 searches
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
        min_rating: filters.starRating > 0 ? filters.starRating : '',
        extension: filters.fileExtension || ''
      };
      
      logger.debug('useSearch', 'filter_transformed', 'Filters transformed for backend', {
        originalFilters: filters,
        transformedFilters,
        starRatingHandling: {
          original: filters.starRating,
          transformed: filters.starRating > 0 ? filters.starRating : '',
          condition: filters.starRating > 0 ? 'included' : 'excluded'
        },
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
      
      // Save to history with filters and sort information
      saveSearchHistory(query, type, filters, sortField, sortOrder, searchData.length);
      
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

  // Replay search from history entry
  const replaySearchFromHistory = useCallback((historyEntry) => {
    if (typeof historyEntry === 'string') {
      // Old format: basic search only
      performSearch(historyEntry, 'all', {});
    } else {
      // New format: complete search reproduction
      performSearch(
        historyEntry.query,
        historyEntry.type,
        historyEntry.filters,
        historyEntry.sortField,
        historyEntry.sortOrder
      );
    }
  }, [performSearch]);

  // Format history entry for display
  const formatHistoryEntry = useCallback((entry) => {
    if (typeof entry === 'string') {
      return {
        display: entry,
        subtitle: 'Legacy search',
        timestamp: null
      };
    }
    
    // Generate filter summary
    const filterSummary = [];
    if (entry.filters.camera) filterSummary.push(`Camera: ${entry.filters.camera}`);
    if (entry.filters.lens) filterSummary.push(`Lens: ${entry.filters.lens}`);
    if (entry.filters.starRating && entry.filters.starRating > 0) filterSummary.push(`${entry.filters.starRating}+ stars`);
    if (entry.filters.dateRange?.start) filterSummary.push(`Date range`);
    if (entry.filters.fileExtension) filterSummary.push(`${entry.filters.fileExtension.toUpperCase()}`);
    
    const subtitle = [
      filterSummary.length > 0 ? filterSummary.slice(0, 2).join(', ') : 'No filters',
      `${entry.resultCount} results`,
      `Sort: ${entry.sortField === 'exif_date_time_original' ? 'date' : entry.sortField} ${entry.sortOrder}`
    ].join(' • ');
    
    return {
      display: entry.query || '(Filter only search)',
      subtitle,
      timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : null
    };
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
    clearHistory,
    replaySearchFromHistory,
    formatHistoryEntry
  };
};

export default useSearch;