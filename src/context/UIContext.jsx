import React, { createContext, useContext, useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { message } from '@tauri-apps/plugin-dialog';
import { useViewMode } from '../hooks/useViewMode.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';
import WelcomeImage from '../WelcomeImage.jsx';

const UIContext = createContext();

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export const UIProvider = ({ children }) => {
  // Use the new view mode state machine
  const viewMode = useViewMode(VIEW_MODES.HOME);

  // Keep non-view-related state
  const [footerMessages, setFooterMessages] = useState({});
  const [welcomeImage, setWelcomeImage] = useState(WelcomeImage());
  const [useCount, setUseCount] = useState(null);

  // Burst grouping mode state
  const [burstModeEnabled, setBurstModeEnabled] = useState(false);

  const addFooterMessage = useCallback((k, v, withDialog, deleteAfter) => {
    // Handle single-argument call: addFooterMessage('message') -> use 'default' as key
    const key = v === undefined ? 'default' : k;
    const value = v === undefined ? k : v;

    setFooterMessages(prev => ({
      ...prev,
      [key]: value
    }));
    
    if (withDialog) {
      invoke("lock", { t: true }).then((e) => {
        if (e) {
          message(v).then((e) => {
            invoke("lock", { t: false });
          });
        }
      });
    }
    
    if (deleteAfter) {
      setTimeout(() => {
        removeFooterMessage(k);
      }, deleteAfter);
    }
  }, []);

  const removeFooterMessage = useCallback((targetKey, timeAfter = 0) => {
    setTimeout(() => {
      setFooterMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[targetKey];
        return newMessages;
      });
    }, timeAfter);
  }, []);

  // Enhanced navigation functions using the view mode state machine
  const toggleHome = useCallback(() => {
    viewMode.transitionTo(VIEW_MODES.HOME);
  }, [viewMode]);

  const toggleAlbumListMode = useCallback(() => {
    viewMode.transitionTo(VIEW_MODES.ALBUM_LIST);
  }, [viewMode]);

  const showPhotosListView = useCallback(() => {
    logger.debug('UIContext', 'show_photos_list_view', 'Transitioning to DATE mode');
    viewMode.transitionTo(VIEW_MODES.DATE);
    logger.debug('UIContext', 'photos_list_view_complete', 'View mode transition complete');
  }, [viewMode]);

  const showDatePhotos = useCallback((date) => {
    logger.debug('UIContext', 'show_date_photos', 'Transitioning to DATE mode with date', { date });
    viewMode.showDatePhotos(date);
  }, [viewMode]);

  const showRecentPhotos = useCallback(() => {
    logger.debug('UIContext', 'show_recent_photos', 'Transitioning to RECENT mode');
    viewMode.showRecentPhotos();
  }, [viewMode]);

  // Toggle burst grouping mode
  const toggleBurstMode = useCallback(() => {
    setBurstModeEnabled(prev => {
      const newValue = !prev;
      logger.info('UIContext', 'toggle_burst_mode', `Burst mode ${newValue ? 'enabled' : 'disabled'}`);
      return newValue;
    });
  }, []);

  const value = {
    // View mode state (from state machine)
    ...viewMode,
    
    // Legacy compatibility - map new state to old property names
    viewMode: viewMode.currentMode,
    
    // Non-view-related state
    footerMessages,
    welcomeImage,
    useCount,

    // Burst grouping state
    burstModeEnabled,
    toggleBurstMode,

    // Enhanced navigation actions
    toggleHome,
    toggleAlbumListMode,
    showPhotosListView,
    showDatePhotos,
    showRecentPhotos,
    
    // Footer message actions
    addFooterMessage,
    removeFooterMessage,
    
    // App state setters
    setWelcomeImage,
    setUseCount
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export default UIContext;