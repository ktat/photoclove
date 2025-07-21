import { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const TUTORIAL_STORAGE_KEY = 'photoclove_tutorials';

export const useTutorial = () => {
  const [tutorialState, setTutorialState] = useState({
    selectionTutorial: {
      dateMode: { shown: false, dismissed: false },
      albumMode: { shown: false, dismissed: false }
    }
  });

  // Load tutorial state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setTutorialState(prev => ({ ...prev, ...parsedState }));
      }
    } catch (error) {
      logger.warn('useTutorial', 'load_failed', 'Failed to load tutorial state', { error: error.message });
    }
  }, []);

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
    // If contextState doesn't exist yet, it means we should show the tutorial (first time)
    if (!contextState) {
      return true;
    }
    // Show if not shown and not dismissed
    return !contextState.shown && !contextState.dismissed;
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

  // Dismiss tutorial
  const dismissTutorial = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          ...tutorialState[tutorialType][context],
          shown: true,
          dismissed: false
        }
      }
    };
    saveTutorialState(newState);
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