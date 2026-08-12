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
  // Bumped when something outside the list changes the files behind it - a
  // move between date directories, a thumbnail run. PhotosList watches this
  // and reloads; without it the view keeps showing photos in the date they
  // just left, and freshly built thumbnails never appear.
  const [photoRefreshToken, setPhotoRefreshToken] = useState(0);

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

    /// Ask the photo list to reload because the files behind it changed.
    requestPhotoRefresh: useCallback(() => {
      setPhotoRefreshToken((n) => n + 1);
    }, []),

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
    photoRefreshToken,
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