import { useState, useEffect, useCallback } from 'react';

export const useSearchHistory = () => {
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
  const saveToStorage = useCallback((history) => {
    localStorage.setItem('photo_search_history', JSON.stringify(history));
  }, []);

  // Add a search to history
  const addToHistory = useCallback((query, searchType, filters, resultCount) => {
    const historyItem = {
      id: Date.now().toString(),
      query,
      searchType,
      filters,
      resultCount,
      timestamp: new Date().toISOString()
    };

    setSearchHistory(prev => {
      // Remove duplicate entries (same query and search type)
      const filtered = prev.filter(item => 
        item.query !== query || item.searchType !== searchType
      );
      
      // Add new item at the beginning and limit to 50 items
      const newHistory = [historyItem, ...filtered].slice(0, 50);
      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage]);

  // Remove a specific item from history
  const removeFromHistory = useCallback((itemId) => {
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item.id !== itemId);
      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('photo_search_history');
  }, []);

  // Get recent searches (last 10)
  const getRecentSearches = useCallback(() => {
    return searchHistory.slice(0, 10);
  }, [searchHistory]);

  // Get search suggestions based on partial query
  const getSearchSuggestions = useCallback((partialQuery) => {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    const query = partialQuery.toLowerCase();
    const suggestions = searchHistory
      .filter(item => item.query.toLowerCase().includes(query))
      .slice(0, 5)
      .map(item => ({
        query: item.query,
        searchType: item.searchType,
        timestamp: item.timestamp
      }));

    // Remove duplicates based on query
    const uniqueSuggestions = suggestions.filter((item, index, self) => 
      index === self.findIndex(t => t.query === item.query)
    );

    return uniqueSuggestions;
  }, [searchHistory]);

  // Get popular searches (most frequently used)
  const getPopularSearches = useCallback(() => {
    const queryCount = {};
    
    searchHistory.forEach(item => {
      const key = `${item.query}-${item.searchType}`;
      queryCount[key] = (queryCount[key] || 0) + 1;
    });

    const popular = Object.entries(queryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => {
        const [query, searchType] = key.split('-');
        const lastUsed = searchHistory.find(item => 
          item.query === query && item.searchType === searchType
        )?.timestamp;
        
        return {
          query,
          searchType,
          count,
          lastUsed
        };
      });

    return popular;
  }, [searchHistory]);

  // Export search history
  const exportHistory = useCallback(() => {
    const exportData = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      history: searchHistory
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `search_history_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }, [searchHistory]);

  // Import search history
  const importHistory = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          if (importData.history && Array.isArray(importData.history)) {
            const newHistory = importData.history.map(item => ({
              ...item,
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            }));
            
            const updatedHistory = [...searchHistory, ...newHistory];
            setSearchHistory(updatedHistory);
            saveToStorage(updatedHistory);
            resolve(newHistory.length);
          } else {
            reject(new Error('Invalid file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  }, [searchHistory, saveToStorage]);

  return {
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentSearches,
    getSearchSuggestions,
    getPopularSearches,
    exportHistory,
    importHistory
  };
};

export default useSearchHistory;