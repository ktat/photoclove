/**
 * View Mode State Machine Hook
 * Implements a centralized state machine for PhotoClove view navigation
 * Based on improvement plan Phase 2
 */
import { useState, useCallback, useMemo } from 'react';
import { logger } from '../services/LoggerService.js';

// Define all possible view modes
export const VIEW_MODES = {
  HOME: 'home',
  DATE: 'date',
  RECENT: 'recent',
  SEARCH: 'search',
  ADVANCED_SEARCH: 'advanced_search',
  ALBUM_LIST: 'album_list',
  ALBUM: 'album',
  IMPORT: 'import',
  PREFERENCES: 'preferences',
  JOB_QUEUE: 'job_queue',
  LOGIN: 'login'
};

// Define valid transitions between view modes
const TRANSITIONS = {
  [VIEW_MODES.HOME]: {
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE,
    TO_LOGIN: VIEW_MODES.LOGIN
  },
  [VIEW_MODES.DATE]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.RECENT]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.SEARCH]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.ADVANCED_SEARCH]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.ALBUM_LIST]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM: VIEW_MODES.ALBUM,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.ALBUM]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.IMPORT]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.PREFERENCES]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.JOB_QUEUE]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES
  },
  [VIEW_MODES.LOGIN]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT
  }
};

export const useViewMode = (initialMode = VIEW_MODES.HOME) => {
  const [currentMode, setCurrentMode] = useState(initialMode);
  const [modeData, setModeData] = useState({});
  const [history, setHistory] = useState([initialMode]);

  // Transition to a new view mode with validation
  const transitionTo = useCallback((newMode, data = {}) => {
    // Find the transition key for the new mode
    const transitions = TRANSITIONS[currentMode];
    if (!transitions) {
      logger.warn('useViewMode', 'invalid_current_mode', `No transitions defined for mode: ${currentMode}`);
      return false;
    }

    // Check if transition is allowed
    const isValidTransition = Object.values(transitions).includes(newMode);
    if (!isValidTransition) {
      logger.warn('useViewMode', 'invalid_transition', `Invalid transition from ${currentMode} to ${newMode}`, {
        currentMode,
        targetMode: newMode,
        availableTransitions: Object.values(transitions)
      });
      return false;
    }

    // Perform the transition
    setCurrentMode(newMode);
    setModeData(data);
    setHistory(prev => [...prev, newMode]);

    logger.info('useViewMode', 'mode_transition', `View mode changed: ${currentMode} → ${newMode}`, {
      fromMode: currentMode,
      toMode: newMode,
      data
    });

    return true;
  }, [currentMode]);

  // Go back to previous mode
  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // Remove current mode
      const previousMode = newHistory[newHistory.length - 1];
      
      setCurrentMode(previousMode);
      setHistory(newHistory);
      setModeData({}); // Clear mode data when going back

      logger.info('useViewMode', 'go_back', `Returned to previous mode: ${previousMode}`, {
        fromMode: currentMode,
        toMode: previousMode,
        historyLength: newHistory.length
      });

      return true;
    }
    
    logger.debug('useViewMode', 'go_back_failed', 'No previous mode in history');
    return false;
  }, [history, currentMode]);

  // Check if currently in a specific mode
  const isMode = useCallback((mode) => {
    return currentMode === mode;
  }, [currentMode]);

  // Check if transition to a mode is allowed
  const canTransitionTo = useCallback((targetMode) => {
    const transitions = TRANSITIONS[currentMode];
    return transitions ? Object.values(transitions).includes(targetMode) : false;
  }, [currentMode]);

  // Get available transitions from current mode
  const getAvailableTransitions = useCallback(() => {
    const transitions = TRANSITIONS[currentMode];
    return transitions ? Object.values(transitions) : [];
  }, [currentMode]);

  // Screen visibility state computed from current mode
  const screenVisibility = useMemo(() => ({
    showImporter: currentMode === VIEW_MODES.IMPORT,
    showPhotosList: [VIEW_MODES.DATE, VIEW_MODES.RECENT, VIEW_MODES.ALBUM].includes(currentMode),
    showSearchPage: [VIEW_MODES.SEARCH, VIEW_MODES.ADVANCED_SEARCH].includes(currentMode),
    showAlbumsList: currentMode === VIEW_MODES.ALBUM_LIST,
    showPreferences: currentMode === VIEW_MODES.PREFERENCES,
    showJobQueue: currentMode === VIEW_MODES.JOB_QUEUE,
    showLogin: currentMode === VIEW_MODES.LOGIN,
    showHome: currentMode === VIEW_MODES.HOME
  }), [currentMode]);

  // Legacy compatibility functions
  const toggleImporter = useCallback((show) => {
    if (show) {
      transitionTo(VIEW_MODES.IMPORT);
    } else {
      transitionTo(VIEW_MODES.HOME);
    }
  }, [transitionTo]);

  const toggleSearchPage = useCallback((show, initialQuery = "", isAdvanced = false) => {
    if (show) {
      const targetMode = isAdvanced ? VIEW_MODES.ADVANCED_SEARCH : VIEW_MODES.SEARCH;
      transitionTo(targetMode, { searchQuery: initialQuery, isAdvanced });
    } else {
      transitionTo(VIEW_MODES.HOME);
    }
  }, [transitionTo]);

  const togglePreferences = useCallback((show) => {
    if (show) {
      transitionTo(VIEW_MODES.PREFERENCES);
    } else {
      transitionTo(VIEW_MODES.HOME);
    }
  }, [transitionTo]);

  const toggleJobQueue = useCallback((show) => {
    if (show) {
      transitionTo(VIEW_MODES.JOB_QUEUE);
    } else {
      transitionTo(VIEW_MODES.HOME);
    }
  }, [transitionTo]);

  const toggleLogin = useCallback((show) => {
    if (show) {
      transitionTo(VIEW_MODES.LOGIN);
    } else {
      transitionTo(VIEW_MODES.HOME);
    }
  }, [transitionTo]);

  const openAlbum = useCallback((albumId) => {
    transitionTo(VIEW_MODES.ALBUM, { albumId });
  }, [transitionTo]);

  const openAlbumsList = useCallback(() => {
    transitionTo(VIEW_MODES.ALBUM_LIST);
  }, [transitionTo]);

  return {
    // State
    currentMode,
    modeData,
    history,
    
    // Computed state
    ...screenVisibility,
    
    // Core functions
    transitionTo,
    goBack,
    isMode,
    canTransitionTo,
    getAvailableTransitions,
    
    // Legacy compatibility functions
    toggleImporter,
    toggleSearchPage,
    togglePreferences,
    toggleJobQueue,
    toggleLogin,
    openAlbum,
    openAlbumsList,
    
    // Additional computed values
    isSearchMode: isMode(VIEW_MODES.SEARCH) || isMode(VIEW_MODES.ADVANCED_SEARCH),
    isAdvancedSearchMode: isMode(VIEW_MODES.ADVANCED_SEARCH),
    isAlbumMode: isMode(VIEW_MODES.ALBUM),
    isAlbumListMode: isMode(VIEW_MODES.ALBUM_LIST),
    currentAlbumId: modeData.albumId || null,
    searchInitialQuery: modeData.searchQuery || "",
    canGoBack: history.length > 1
  };
};