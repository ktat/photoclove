import { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const TUTORIAL_STORAGE_KEY = 'photoclove_tutorials';

// Load initial state from localStorage synchronously
const getInitialTutorialState = () => {
  try {
    const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (saved) {
      const parsedState = JSON.parse(saved);
      // Reset 'shown' flags on page load - only keep 'dismissed' flags
      const resetState = {};
      for (const [tutorialType, contexts] of Object.entries(parsedState)) {
        resetState[tutorialType] = {};
        for (const [context, state] of Object.entries(contexts)) {
          resetState[tutorialType][context] = {
            shown: false, // Reset shown flag
            dismissed: state.dismissed || false // Keep dismissed flag
          };
        }
      }
      logger.info('useTutorial', 'initial_state_loaded', 'Tutorial state loaded from localStorage', { resetState });
      return resetState;
    }
  } catch (error) {
    logger.warn('useTutorial', 'initial_load_failed', 'Failed to load initial tutorial state', { error: error.message });
  }

  // Return default state if no saved state
  return {
    selectionTutorial: {
      dateMode: { shown: false, dismissed: false },
      albumMode: { shown: false, dismissed: false }
    }
  };
};

export const useTutorial = () => {
  const [tutorialState, setTutorialState] = useState(getInitialTutorialState);

  // Save tutorial state to localStorage
  const saveTutorialState = (newState) => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(newState));
      setTutorialState(newState);
    } catch (error) {
      logger.error('useTutorial', 'save_failed', 'Failed to save tutorial state', { error: error.message });
    }
  };

  // Check if tutorial should be shown
  const shouldShowTutorial = (tutorialType, context) => {
    const contextState = tutorialState[tutorialType]?.[context];
    // If contextState doesn't exist yet, show the tutorial (first time)
    if (!contextState) {
      return true;
    }
    // Show if not permanently dismissed AND not shown in this session yet
    // This shows tutorial once per session unless permanently dismissed
    return !contextState.dismissed && !contextState.shown;
  };

  // Mark tutorial as shown
  const markTutorialShown = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          ...tutorialState[tutorialType][context],
          shown: true
        }
      }
    };
    saveTutorialState(newState);
    
    logger.info('useTutorial', 'tutorial_shown', 'Tutorial marked as shown', { tutorialType, context });
  };

  // Dismiss tutorial (temporary - can show again in future)
  const dismissTutorial = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          shown: true,
          dismissed: false // Allow showing again next time
        }
      }
    };
    saveTutorialState(newState);

    logger.info('useTutorial', 'tutorial_dismissed', 'Tutorial dismissed temporarily', { tutorialType, context });
  };

  // Permanently disable tutorial
  const disableTutorial = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          ...tutorialState[tutorialType][context],
          shown: true,
          dismissed: true
        }
      }
    };
    saveTutorialState(newState);
  };

  // Reset all tutorials (for testing/debugging)
  const resetTutorials = () => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setTutorialState({
      selectionTutorial: {
        dateMode: { shown: false, dismissed: false },
        albumMode: { shown: false, dismissed: false }
      }
    });
  };

  return {
    shouldShowTutorial,
    markTutorialShown,
    dismissTutorial,
    disableTutorial,
    resetTutorials
  };
};