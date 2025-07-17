import React, { createContext, useContext, useState, useCallback } from 'react';

const ImportContext = createContext();

export const useImport = () => {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error('useImport must be used within an ImportProvider');
  }
  return context;
};

function importerInitData() {
  return { 
    "has_next_files": false, 
    "dirs_files": { 
      dir: { "path": "" }, 
      "dirs": { "dirs": [] }, 
      "files": { "files": [] } 
    } 
  };
}

export const ImportProvider = ({ children }) => {
  const [scrollLock, setScrollLock] = useState(false);
  const [importProgress, setImportProgress] = useState({});
  const [importPhotosPage, setImportPhotosPage] = useState(1);
  const [importPaths, setImportPaths] = useState([]);
  const [currentImportPath, setCurrentImportPath] = useState("");
  const [importer, setImporter] = useState(importerInitData());
  const [pathPage, setPathPage] = useState({});
  const [selectedForImport, setSelectedForImport] = useState({});
  const [imageInSelectedPhotos, setImageInSelectedPhotos] = useState(undefined);
  const [importerFilter, setImporterFilter] = useState("");

  const importActions = {
    updateImportProgress: setImportProgress,
    updateImportPhotosPage: setImportPhotosPage,
    updateImportPaths: setImportPaths,
    updateCurrentImportPath: setCurrentImportPath,
    updateImporter: setImporter,
    updatePathPage: setPathPage,
    updateSelectedForImport: setSelectedForImport,
    updateImageInSelectedPhotos: setImageInSelectedPhotos,
    updateImporterFilter: setImporterFilter,
    updateScrollLock: setScrollLock,

    resetImportState: useCallback(() => {
      setImporter(importerInitData());
      setSelectedForImport({});
      setImageInSelectedPhotos(undefined);
      setImportProgress({});
      setImportPhotosPage(1);
    }, []),

    selectPhotoForImport: useCallback((photoPath, isSelected) => {
      setSelectedForImport(prev => ({
        ...prev,
        [photoPath]: isSelected
      }));
    }, []),

    clearSelectedPhotos: useCallback(() => {
      setSelectedForImport({});
    }, []),

    updatePageForPath: useCallback((path, page) => {
      setPathPage(prev => ({
        ...prev,
        [path]: page
      }));
    }, [])
  };

  const value = {
    // State
    scrollLock,
    importProgress,
    importPhotosPage,
    importPaths,
    currentImportPath,
    importer,
    pathPage,
    selectedForImport,
    imageInSelectedPhotos,
    importerFilter,
    
    // Actions
    ...importActions
  };

  return (
    <ImportContext.Provider value={value}>
      {children}
    </ImportContext.Provider>
  );
};

export default ImportContext;