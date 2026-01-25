/**
 * View Mode State Machine Hook
 * Implements a centralized state machine for PhotoClove view navigation
 * Based on improvement plan Phase 2
 */
import { useState, useCallback, useMemo } from 'react';
import { logger } from '../services/LoggerService.js';
import { VIEW_MODES } from '../constants/viewModes.js';

// Define valid transitions between view modes
const TRANSITIONS = {
  [VIEW_MODES.HOME]: {
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE,
    TO_LOGIN: VIEW_MODES.LOGIN
  },
  [VIEW_MODES.DATE]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE,
    TO_IN_BURST_GROUP: VIEW_MODES.IN_BURST_GROUP
  },
  [VIEW_MODES.RECENT]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.SEARCH]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.ALBUM_LIST]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM: VIEW_MODES.ALBUM,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.ALBUM]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE,
    TO_IN_BURST_GROUP: VIEW_MODES.IN_BURST_GROUP
  },
  [VIEW_MODES.TAG_LIST]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG: VIEW_MODES.TAG,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.TAG]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE,
    TO_IN_BURST_GROUP: VIEW_MODES.IN_BURST_GROUP
  },
  [VIEW_MODES.IMPORT]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.PREFERENCES]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.JOB_QUEUE]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES
  },
  [VIEW_MODES.TRASH]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.LOGIN]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT
  },
  [VIEW_MODES.IN_BURST_GROUP]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_ALBUM: VIEW_MODES.ALBUM,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_TAG: VIEW_MODES.TAG,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.FACE_LIST]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_PERSON: VIEW_MODES.PERSON,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
  },
  [VIEW_MODES.PERSON]: {
    TO_HOME: VIEW_MODES.HOME,
    TO_DATE: VIEW_MODES.DATE,
    TO_RECENT: VIEW_MODES.RECENT,
    TO_SEARCH: VIEW_MODES.SEARCH,
    TO_ALBUM_LIST: VIEW_MODES.ALBUM_LIST,
    TO_TAG_LIST: VIEW_MODES.TAG_LIST,
    TO_FACE_LIST: VIEW_MODES.FACE_LIST,
    TO_TRASH: VIEW_MODES.TRASH,
    TO_IMPORT: VIEW_MODES.IMPORT,
    TO_PREFERENCES: VIEW_MODES.PREFERENCES,
    TO_JOB_QUEUE: VIEW_MODES.JOB_QUEUE
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

    // Allow self-transitions (same mode with different data)
    const isValidTransition = Object.values(transitions).includes(newMode) || currentMode === newMode;
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
    // Only add to history if it's a different mode
    if (currentMode !== newMode) {
      setHistory(prev => [...prev, newMode]);
    }

    logger.info('useViewMode', 'mode_transition', `View mode changed: ${currentMode} → ${newMode}`, {
      fromMode: currentMode,
      toMode: newMode,
      data,
      isSelfTransition: currentMode === newMode
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
    showPhotosList: [VIEW_MODES.DATE, VIEW_MODES.RECENT, VIEW_MODES.ALBUM, VIEW_MODES.ALBUM_LIST, VIEW_MODES.TAG, VIEW_MODES.TAG_LIST, VIEW_MODES.TRASH, VIEW_MODES.IN_BURST_GROUP].includes(currentMode),
    showSearchPage: currentMode === VIEW_MODES.SEARCH,
    showAlbumsList: currentMode === VIEW_MODES.ALBUM_LIST,
    showTagsList: currentMode === VIEW_MODES.TAG_LIST,
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
      // Always use SEARCH mode - Advanced Search has been unified with regular Search
      transitionTo(VIEW_MODES.SEARCH, { searchQuery: initialQuery, isAdvanced });
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

  const showDatePhotos = useCallback((date) => {
    transitionTo(VIEW_MODES.DATE, { date });
  }, [transitionTo]);

  const showRecentPhotos = useCallback(() => {
    transitionTo(VIEW_MODES.RECENT);
  }, [transitionTo]);

  const openTag = useCallback((tagId) => {
    transitionTo(VIEW_MODES.TAG, { tagId });
  }, [transitionTo]);

  const openTagsList = useCallback(() => {
    transitionTo(VIEW_MODES.TAG_LIST);
  }, [transitionTo]);

  const openTrash = useCallback(() => {
    transitionTo(VIEW_MODES.TRASH);
  }, [transitionTo]);

  const openPerson = useCallback((personId) => {
    transitionTo(VIEW_MODES.PERSON, { personId });
  }, [transitionTo]);

  const openFacesList = useCallback(() => {
    transitionTo(VIEW_MODES.FACE_LIST);
  }, [transitionTo]);

  const openBurstGroup = useCallback((burstGroupId, returnMode, returnModeData) => {
    transitionTo(VIEW_MODES.IN_BURST_GROUP, {
      burstGroupId,
      returnMode,
      returnModeData
    });
  }, [transitionTo]);

  const goBackFromBurstGroup = useCallback(() => {
    // Get the stored return mode and data
    const returnMode = modeData.returnMode;
    const returnModeData = modeData.returnModeData || {};

    if (returnMode) {
      // Return to the specific mode with its data
      transitionTo(returnMode, returnModeData);
    } else {
      // Fallback to goBack or HOME
      if (history.length > 1) {
        goBack();
      } else {
        transitionTo(VIEW_MODES.HOME);
      }
    }

    // Return the returnModeData so callers can restore state like currentPhotoIndex
    return returnModeData;
  }, [modeData, transitionTo, goBack, history.length]);

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
    openTag,
    openTagsList,
    openTrash,
    openPerson,
    openFacesList,
    openBurstGroup,
    goBackFromBurstGroup,
    showDatePhotos,
    showRecentPhotos,

    // Additional computed values
    isSearchMode: isMode(VIEW_MODES.SEARCH),
    isAdvancedSearchMode: isMode(VIEW_MODES.SEARCH), // Kept for backward compatibility
    isAlbumMode: isMode(VIEW_MODES.ALBUM),
    isAlbumListMode: isMode(VIEW_MODES.ALBUM_LIST),
    isTagMode: isMode(VIEW_MODES.TAG),
    isTagListMode: isMode(VIEW_MODES.TAG_LIST),
    isTrashMode: isMode(VIEW_MODES.TRASH),
    currentAlbumId: modeData.albumId || null,
    currentTagId: modeData.tagId || null,
    searchInitialQuery: modeData.searchQuery || "",
    canGoBack: history.length > 1,
    // Burst group mode
    isInBurstGroupMode: isMode(VIEW_MODES.IN_BURST_GROUP),
    currentBurstGroupId: modeData.burstGroupId || null,
    burstReturnMode: modeData.returnMode || null,
    burstReturnModeData: modeData.returnModeData || null
  };
};