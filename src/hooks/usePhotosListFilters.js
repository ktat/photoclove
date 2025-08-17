/**
 * Custom hook for PhotosList filter state management
 * Extracted from PhotosList.jsx to reduce complexity
 */
import { useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';
import { photoCacheService } from '../services/PhotoCacheService.js';

export const usePhotosListFilters = () => {
  // Filter state
  const [filters, setFilters] = useState({
    star: 0,
    hasComment: false,
    extension: 'all',
  });
  
  // Individual filter state for backward compatibility
  const [starFilter, setStarFilter] = useState(0);
  const [hasCommentFilter, setHasCommentFilter] = useState(false);
  const [extensionFilter, setExtensionFilter] = useState("all");
  
  // Filter options caching state
  const [filterOptions, setFilterOptions] = useState(null);
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false);
  
  // Debug message state
  const [debugMessage, setDebugMessage] = useState("");
  
  // Update individual filter
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      logger.debug('usePhotosListFilters', 'filter_updated', `Filter ${key} updated`, {
        key,
        value,
        newFilters
      });
      
      return newFilters;
    });
    
    // Also update individual state for backward compatibility
    switch (key) {
      case 'star':
        setStarFilter(value);
        break;
      case 'hasComment':
        setHasCommentFilter(value);
        break;
      case 'extension':
        setExtensionFilter(value);
        break;
    }
  }, []);
  
  // Reset all filters
  const resetFilters = useCallback(() => {
    const defaultFilters = { star: 0, hasComment: false, extension: 'all' };
    setFilters(defaultFilters);
    setStarFilter(0);
    setHasCommentFilter(false);
    setExtensionFilter("all");
    
    logger.info('usePhotosListFilters', 'filters_reset', 'All filters reset to defaults');
  }, []);
  
  // Apply frontend filters to photos array
  const applyFrontendFilters = useCallback((photos) => {
    // Check if any filters are actually active to avoid unnecessary logging
    const hasActiveFilters = filters.star > 0 || filters.hasComment || filters.extension !== 'all';
    
    if (hasActiveFilters) {
      logger.debug('usePhotosListFilters', 'apply_filters_start', 'Applying frontend filters', {
        inputPhotosCount: photos.length,
        filters
      });
    }
    
    const filtered = photos.filter(photo => {
      // Apply star filter
      if (filters.star > 0 && (!photo.star || photo.star < filters.star)) {
        return false;
      }
      
      // Apply comment filter
      if (filters.hasComment && (!photo.comment || photo.comment.trim() === "")) {
        return false;
      }
      
      // Apply extension filter
      if (filters.extension !== "all") {
        const extension = photo.file.name.split('.').pop().toLowerCase();
        const allowedExtensions = filters.extension.split(',').map(ext => ext.trim().toLowerCase());
        if (!allowedExtensions.includes(extension)) {
          return false;
        }
      }
      
      return true;
    });
    
    if (hasActiveFilters) {
      logger.debug('usePhotosListFilters', 'apply_filters_complete', 'Frontend filters applied', {
        inputCount: photos.length,
        filteredCount: filtered.length,
        filtersApplied: filters
      });
    }
    
    return filtered;
  }, [filters]);
  
  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return filters.star > 0 || filters.hasComment || filters.extension !== 'all';
  }, [filters]);
  
  // Get filter summary for display
  const getFilterSummary = useCallback(() => {
    const active = [];
    if (filters.star > 0) active.push(`★${filters.star}+`);
    if (filters.hasComment) active.push('Has comment');
    if (filters.extension !== 'all') active.push(`${filters.extension}`);
    
    return active.length > 0 ? active.join(', ') : 'No filters';
  }, [filters]);
  
  // Cache filter options
  const cacheFilterOptions = useCallback((key, options) => {
    photoCacheService.setMetadata(`filter_options:${key}`, options);
  }, []);
  
  // Get cached filter options
  const getCachedFilterOptions = useCallback((key) => {
    return photoCacheService.getMetadata(`filter_options:${key}`);
  }, []);
  
  return {
    // Unified filter state
    filters,
    setFilters,
    
    // Individual filter state (for backward compatibility)
    starFilter,
    hasCommentFilter,
    extensionFilter,
    setStarFilter,
    setHasCommentFilter,
    setExtensionFilter,
    
    // Filter options
    filterOptions,
    setFilterOptions,
    isFilterOptionsLoading,
    setIsFilterOptionsLoading,
    
    // Debug
    debugMessage,
    setDebugMessage,
    
    // Functions
    updateFilter,
    resetFilters,
    applyFrontendFilters,
    hasActiveFilters,
    getFilterSummary,
    
    // Cache functions
    cacheFilterOptions,
    getCachedFilterOptions
  };
};