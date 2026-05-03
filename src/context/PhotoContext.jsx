import React, { createContext, useContext, useState, useCallback } from 'react';
import { Photo } from '../domain/Photo.js';

const PhotoContext = createContext();

export const usePhoto = () => {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error('usePhoto must be used within a PhotoProvider');
  }
  return context;
};

export const PhotoProvider = ({ children }) => {
  const [dateList, setDateList] = useState([]);
  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
  const [dateNum, setDateNum] = useState({});
  const [hideLoading, setHideLoading] = useState(false);
  const [recentPhotosMode, setRecentPhotosMode] = useState(false);
  
  // Album state
  const [albumsList, setAlbumsList] = useState([]);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  
  const setCurrentDateNum = useCallback((num) => {
    setDateNum(prevDateNum => {
      const newDateNum = { ...prevDateNum };
      newDateNum[currentDate.replace(/\//g, "-")] = num;
      return newDateNum;
    });
  }, [currentDate]);

  const photoActions = {
    setCurrentDateNum,
    updateDateNum: setDateNum,
    updateDateList: setDateList,
    updateDatePage: setDatePage,
    updateCurrentDate: setCurrentDate,
    updateHideLoading: setHideLoading,

    resetPhotoState: useCallback(() => {
      setCurrentDate("");
      setDatePage({});
      setRecentPhotosMode(false);
    }, []),

    updateRecentPhotosMode: useCallback((mode) => {
      setRecentPhotosMode(mode);
      if (mode) {
        // Keep currentDate for visual indication, only clear datePage
        setDatePage({});
      }
    }, []),

    // Album actions
    updateAlbumsList: useCallback((albums) => {
      setAlbumsList(albums);
    }, []),

    updateCurrentAlbum: useCallback((album) => {
      setCurrentAlbum(album);
    }, []),

    resetAlbumState: useCallback(() => {
      setCurrentAlbum(null);
    }, [])
  };

  const value = {
    // State
    dateList,
    datePage,
    currentDate,
    dateNum,
    hideLoading,
    recentPhotosMode,
    albumsList,
    currentAlbum,
    // Actions
    ...photoActions
  };

  return (
    <PhotoContext.Provider value={value}>
      {children}
    </PhotoContext.Provider>
  );
};

export default PhotoContext;