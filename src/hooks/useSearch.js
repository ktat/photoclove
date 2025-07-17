import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
        console.error('Failed to load search history:', error);
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

  const performSearch = useCallback(async (query, type = 'all', filters = {}) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchQuery('');
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);
    setSearchType(type);

    try {
      const result = await invoke('search_photos', {
        query: query.trim(),
        searchType: type,
        filters: JSON.stringify(filters)
      });

      const searchData = JSON.parse(result);
      setSearchResults(searchData);
      
      // Save to history
      saveSearchHistory(query, type, searchData.length);
      
      return searchData;
    } catch (error) {
      console.error('Search failed:', error);
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