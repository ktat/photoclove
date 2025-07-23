import React, { createContext, useContext, useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { message } from '@tauri-apps/plugin-dialog';
import { useViewMode, VIEW_MODES } from '../hooks/useViewMode.js';

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
  const [welcomeImage, setWelcomeImage] = useState("");
  const [useCount, setUseCount] = useState(0);

  const addFooterMessage = useCallback((k, v, withDialog, deleteAfter) => {
    setFooterMessages(prev => ({
      ...prev,
      [k]: v
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
    console.log('🐛 UIContext showPhotosListView() called - transitioning to DATE mode');
    viewMode.transitionTo(VIEW_MODES.DATE);
    console.log('🐛 UIContext showPhotosListView() - view mode transition complete');
  }, [viewMode]);

  const value = {
    // View mode state (from state machine)
    ...viewMode,
    
    // Legacy compatibility - map new state to old property names
    viewMode: viewMode.currentMode,
    
    // Non-view-related state
    footerMessages,
    welcomeImage,
    useCount,
    
    // Enhanced navigation actions
    toggleHome,
    toggleAlbumListMode,
    showPhotosListView,
    
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