import React, { createContext, useContext, useState, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { message } from '@tauri-apps/plugin-dialog';

const UIContext = createContext();

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export const UIProvider = ({ children }) => {
  const [showImporter, setShowImporter] = useState(false);
  const [showPhotosList, setShowPhotosList] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showJobQueue, setShowJobQueue] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
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

  const toggleImporter = useCallback((t) => {
    if (t) {
      setShowImporter(true);
      setShowPhotosList(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
    }
  }, []);

  const toggleLogin = useCallback((t) => {
    if (t) {
      setShowLogin(true);
      setShowImporter(false);
      setShowPhotosList(false);
      setShowPreferences(false);
      setShowJobQueue(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(false);
    }
  }, []);

  const togglePreferences = useCallback((t) => {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowJobQueue(false);
      setShowPreferences(true);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
    }
  }, []);

  const toggleJobQueue = useCallback((t) => {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowPreferences(false);
      setShowJobQueue(true);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
    }
  }, []);

  const value = {
    // State
    showImporter,
    showPhotosList,
    showPreferences,
    showJobQueue,
    showLogin,
    footerMessages,
    welcomeImage,
    useCount,
    
    // Actions
    toggleImporter,
    toggleLogin,
    togglePreferences,
    toggleJobQueue,
    addFooterMessage,
    removeFooterMessage,
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