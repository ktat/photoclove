/**
 * Lightweight React Query-like implementation for PhotoClove
 * Provides similar benefits without external dependencies
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { photoCacheService } from '../services/PhotoCacheService.js';
import { logger } from '../services/LoggerService.js';

// Query states
const QUERY_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Default options
const DEFAULT_OPTIONS = {
  cacheTime: 5 * 60 * 1000, // 5 minutes
  staleTime: 30 * 1000, // 30 seconds
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  refetchOnWindowFocus: true,
  refetchOnReconnect: true
};

/**
 * Custom hook for fetching photos with caching and automatic refetching
 */
export const usePhotosQuery = (queryKey, queryFn, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State
  const [state, setState] = useState({
    status: QUERY_STATES.IDLE,
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isFetching: false,
    isStale: false
  });
  
  // Refs
  const retryCount = useRef(0);
  const lastFetchTime = useRef(0);
  const abortController = useRef(null);
  const refetchTimer = useRef(null);
  
  // Generate cache key from query key
  const cacheKey = Array.isArray(queryKey) ? queryKey.join(':') : queryKey;
  
  // Check if data is stale
  const isDataStale = useCallback(() => {
    const now = Date.now();
    return now - lastFetchTime.current > opts.staleTime;
  }, [opts.staleTime]);
  
  // Fetch data
  const fetchData = useCallback(async () => {
    // Check cache first
    const cached = photoCacheService.getMetadata(`query:${cacheKey}`);
    if (cached && !isDataStale()) {
      setState(prev => ({
        ...prev,
        status: QUERY_STATES.SUCCESS,
        data: cached,
        isLoading: false,
        isSuccess: true,
        isError: false,
        isFetching: false,
        isStale: false
      }));
      
      logger.debug('usePhotosQuery', 'cache_hit', 'Using cached data', {
        cacheKey,
        dataAge: Date.now() - lastFetchTime.current
      });
      
      return cached;
    }
    
    // Abort previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    
    // Create new abort controller
    abortController.current = new AbortController();
    
    // Update state
    setState(prev => ({
      ...prev,
      status: QUERY_STATES.LOADING,
      isLoading: !prev.data,
      isFetching: true,
      isStale: true
    }));
    
    try {
      logger.info('usePhotosQuery', 'fetch_start', 'Fetching data', {
        cacheKey,
        attempt: retryCount.current + 1
      });
      
      // Execute query function
      const data = await queryFn({ signal: abortController.current.signal });
      
      // Cache the result
      photoCacheService.setMetadata(`query:${cacheKey}`, data);
      lastFetchTime.current = Date.now();
      retryCount.current = 0;
      
      // Update state
      setState({
        status: QUERY_STATES.SUCCESS,
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
        isFetching: false,
        isStale: false
      });
      
      logger.info('usePhotosQuery', 'fetch_success', 'Data fetched successfully', {
        cacheKey,
        dataSize: Array.isArray(data) ? data.length : 1
      });
      
      return data;
    } catch (error) {
      // Handle abort
      if (error.name === 'AbortError') {
        logger.debug('usePhotosQuery', 'fetch_aborted', 'Fetch aborted', { cacheKey });
        return;
      }
      
      // Retry logic
      if (retryCount.current < opts.retry) {
        retryCount.current++;
        const delay = opts.retryDelay(retryCount.current);
        
        logger.warn('usePhotosQuery', 'fetch_retry', 'Retrying fetch', {
          cacheKey,
          attempt: retryCount.current,
          delay,
          error: error.message
        });
        
        setTimeout(() => fetchData(), delay);
        return;
      }
      
      // Final error
      setState({
        status: QUERY_STATES.ERROR,
        data: null,
        error,
        isLoading: false,
        isError: true,
        isSuccess: false,
        isFetching: false,
        isStale: false
      });
      
      logger.error('usePhotosQuery', 'fetch_error', 'Failed to fetch data', {
        cacheKey,
        error: error.message,
        attempts: retryCount.current
      });
      
      throw error;
    }
  }, [cacheKey, queryFn, opts, isDataStale]);
  
  // Refetch function
  const refetch = useCallback(() => {
    retryCount.current = 0;
    return fetchData();
  }, [fetchData]);
  
  // Invalidate and refetch
  const invalidateAndRefetch = useCallback(() => {
    photoCacheService.invalidateMetadata(`query:${cacheKey}`);
    lastFetchTime.current = 0;
    return refetch();
  }, [cacheKey, refetch]);
  
  // Initial fetch
  useEffect(() => {
    if (opts.enabled !== false) {
      fetchData();
    }
    
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      if (refetchTimer.current) {
        clearTimeout(refetchTimer.current);
      }
    };
  }, [fetchData, opts.enabled]);
  
  // Window focus refetching
  useEffect(() => {
    if (!opts.refetchOnWindowFocus || !state.data) return;
    
    const handleFocus = () => {
      if (isDataStale()) {
        logger.debug('usePhotosQuery', 'refetch_on_focus', 'Refetching on window focus', { cacheKey });
        refetch();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [opts.refetchOnWindowFocus, state.data, isDataStale, refetch, cacheKey]);
  
  // Online status refetching
  useEffect(() => {
    if (!opts.refetchOnReconnect || !state.data) return;
    
    const handleOnline = () => {
      logger.debug('usePhotosQuery', 'refetch_on_reconnect', 'Refetching on reconnect', { cacheKey });
      refetch();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [opts.refetchOnReconnect, state.data, refetch, cacheKey]);
  
  return {
    ...state,
    refetch,
    invalidateAndRefetch
  };
};

/**
 * Hook for fetching photos with filters
 */
export const usePhotosWithFilter = (fetchConfig, options = {}) => {
  const queryKey = ['photos', fetchConfig];
  
  const queryFn = useCallback(async ({ signal }) => {
    if (!fetchConfig) return { photos: [] };
    
    const result = await invoke('get_photos_with_filter', {
      config: fetchConfig,
      signal
    });
    
    return result;
  }, [fetchConfig]);
  
  return usePhotosQuery(queryKey, queryFn, options);
};

/**
 * Hook for fetching photo tags
 */
export const usePhotoTags = (photoPath, options = {}) => {
  const queryKey = ['tags', photoPath];
  
  const queryFn = useCallback(async ({ signal }) => {
    if (!photoPath) return [];
    
    const tags = await invoke('get_tags_for_photo', {
      photoPath,
      signal
    });
    
    return tags;
  }, [photoPath]);
  
  return usePhotosQuery(queryKey, queryFn, options);
};

/**
 * Hook for fetching album photos
 */
export const useAlbumPhotos = (albumId, options = {}) => {
  const queryKey = ['album', albumId];
  
  const queryFn = useCallback(async ({ signal }) => {
    if (!albumId) return [];
    
    const photos = await invoke('get_album_photos_with_metadata', {
      albumId,
      signal
    });
    
    return photos;
  }, [albumId]);
  
  return usePhotosQuery(queryKey, queryFn, options);
};

/**
 * Mutation hook for updating data
 */
export const useMutation = (mutationFn, options = {}) => {
  const [state, setState] = useState({
    status: QUERY_STATES.IDLE,
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false
  });
  
  const mutate = useCallback(async (variables) => {
    setState({
      status: QUERY_STATES.LOADING,
      data: null,
      error: null,
      isLoading: true,
      isError: false,
      isSuccess: false
    });
    
    try {
      const result = await mutationFn(variables);
      
      setState({
        status: QUERY_STATES.SUCCESS,
        data: result,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true
      });
      
      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(result, variables);
      }
      
      return result;
    } catch (error) {
      setState({
        status: QUERY_STATES.ERROR,
        data: null,
        error,
        isLoading: false,
        isError: true,
        isSuccess: false
      });
      
      // Call error callback
      if (options.onError) {
        options.onError(error, variables);
      }
      
      throw error;
    }
  }, [mutationFn, options]);
  
  const reset = useCallback(() => {
    setState({
      status: QUERY_STATES.IDLE,
      data: null,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false
    });
  }, []);
  
  return {
    ...state,
    mutate,
    mutateAsync: mutate,
    reset
  };
};

/**
 * Mutation hook for updating photo star rating
 */
export const useUpdatePhotoStar = (options = {}) => {
  const mutationFn = useCallback(async ({ photoPath, starValue }) => {
    const result = await invoke('save_star', {
      photoPath,
      starValue
    });
    
    // Invalidate related queries
    photoCacheService.invalidateMetadata(`query:photos`);
    
    return result;
  }, []);
  
  return useMutation(mutationFn, options);
};

/**
 * Mutation hook for updating photo comment
 */
export const useUpdatePhotoComment = (options = {}) => {
  const mutationFn = useCallback(async ({ photoPath, comment }) => {
    const result = await invoke('save_comment', {
      photoPath,
      comment
    });
    
    // Invalidate related queries
    photoCacheService.invalidateMetadata(`query:photos`);
    
    return result;
  }, []);
  
  return useMutation(mutationFn, options);
};

/**
 * Mutation hook for updating photo tags
 */
export const useUpdatePhotoTags = (options = {}) => {
  const mutationFn = useCallback(async ({ photoPath, tags }) => {
    // Remove existing tags
    await invoke('remove_all_tags_from_photo', { photoPath });
    
    // Add new tags
    for (const tag of tags) {
      await invoke('add_tag_to_photo', {
        photoPath,
        tagName: tag.name
      });
    }
    
    // Invalidate caches
    photoCacheService.invalidateTags(photoPath);
    photoCacheService.invalidateMetadata(`query:photos`);
    
    return tags;
  }, []);
  
  return useMutation(mutationFn, options);
};