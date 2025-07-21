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
  const [showPhotosList, setShowPhotosList] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showJobQueue, setShowJobQueue] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSearchPage, setShowSearchPage] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [isAdvancedSearchMode, setIsAdvancedSearchMode] = useState(false);
  const [footerMessages, setFooterMessages] = useState({});
  const [welcomeImage, setWelcomeImage] = useState("");
  const [useCount, setUseCount] = useState(0);
  
  // Album navigation state
  const [showAlbumsList, setShowAlbumsList] = useState(false);
  const [currentAlbumId, setCurrentAlbumId] = useState(null);
  const [viewMode, setViewMode] = useState('date'); // 'date', 'search', 'album', 'album_list'

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
      setShowSearchPage(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
      setShowSearchPage(false);
    }
  }, []);

  const toggleLogin = useCallback((t) => {
    if (t) {
      setShowLogin(true);
      setShowImporter(false);
      setShowPhotosList(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowSearchPage(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(false);
      setShowSearchPage(false);
    }
  }, []);

  const togglePreferences = useCallback((t) => {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowJobQueue(false);
      setShowPreferences(true);
      setShowSearchPage(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
      setShowSearchPage(false);
    }
  }, []);

  const toggleJobQueue = useCallback((t) => {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowPreferences(false);
      setShowJobQueue(true);
      setShowSearchPage(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
      setShowSearchPage(false);
    }
  }, []);

  const toggleSearchPage = useCallback((t, initialQuery = "", isAdvanced = false) => {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowSearchPage(true);
      setSearchInitialQuery(initialQuery);
      setIsAdvancedSearchMode(isAdvanced);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
      setShowSearchPage(false);
      setSearchInitialQuery("");
      setIsAdvancedSearchMode(false);
    }
  }, []);

  const toggleHome = useCallback(() => {
    setShowImporter(false);
    setShowPhotosList(false);
    setShowLogin(false);
    setShowPreferences(false);
    setShowJobQueue(false);
    setShowSearchPage(false);
    setShowAlbumsList(false);
    setViewMode('date');
    setCurrentAlbumId(null);
  }, []);

  const toggleAlbumListMode = useCallback(() => {
    setShowImporter(false);
    setShowPhotosList(true);
    setShowLogin(false);
    setShowPreferences(false);
    setShowJobQueue(false);
    setShowSearchPage(false);
    setShowAlbumsList(true);
    setViewMode('album_list');
    setCurrentAlbumId(null);
  }, []);

  const openAlbum = useCallback((albumId) => {
    setShowImporter(false);
    setShowPhotosList(true);
    setShowLogin(false);
    setShowPreferences(false);
    setShowJobQueue(false);
    setShowSearchPage(false);
    setShowAlbumsList(false);
    setViewMode('album');
    setCurrentAlbumId(albumId);
  }, []);

  const showPhotosListView = useCallback(() => {
    console.log('🐛 UIContext showPhotosListView() called - setting showPhotosList to true');
    setShowImporter(false);
    setShowPhotosList(true);
    setShowLogin(false);
    setShowPreferences(false);
    setShowJobQueue(false);
    setShowSearchPage(false);
    console.log('🐛 UIContext showPhotosListView() - all states set');
  }, []);

  const value = {
    // State
    showImporter,
    showPhotosList,
    showPreferences,
    showJobQueue,
    showLogin,
    showSearchPage,
    searchInitialQuery,
    isAdvancedSearchMode,
    footerMessages,
    welcomeImage,
    useCount,
    showAlbumsList,
    currentAlbumId,
    viewMode,
    
    // Actions
    toggleImporter,
    toggleLogin,
    togglePreferences,
    toggleJobQueue,
    toggleSearchPage,
    toggleHome,
    toggleAlbumListMode,
    openAlbum,
    showPhotosListView,
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