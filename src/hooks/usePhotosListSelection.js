/**
 * Custom hook for PhotosList selection state management
 * Extracted from PhotosList.jsx to reduce complexity
 */
import { useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';

export const usePhotosListSelection = () => {
  // Selection state
  const [photoSelection, setPhotoSelection] = useState([]);
  const [photoSelectionDict, setPhotoSelectionDict] = useState({});
  
  // Add photo to selection
  const addToSelection = useCallback((photoPath) => {
    setPhotoSelection(prev => {
      if (prev.includes(photoPath)) {
        return prev; // Already selected
      }
      const newSelection = [...prev, photoPath];
      
      logger.debug('usePhotosListSelection', 'photo_selected', 'Photo added to selection', {
        photoPath,
        selectionCount: newSelection.length
      });
      
      return newSelection;
    });
    
    setPhotoSelectionDict(prev => ({
      ...prev,
      [photoPath]: true
    }));
  }, []);
  
  // Remove photo from selection
  const removeFromSelection = useCallback((photoPath) => {
    setPhotoSelection(prev => {
      const newSelection = prev.filter(path => path !== photoPath);
      
      logger.debug('usePhotosListSelection', 'photo_deselected', 'Photo removed from selection', {
        photoPath,
        selectionCount: newSelection.length
      });
      
      return newSelection;
    });
    
    setPhotoSelectionDict(prev => {
      const newDict = { ...prev };
      delete newDict[photoPath];
      return newDict;
    });
  }, []);
  
  // Toggle photo selection
  const toggleSelection = useCallback((photoPath) => {
    if (photoSelection.includes(photoPath)) {
      removeFromSelection(photoPath);
    } else {
      addToSelection(photoPath);
    }
  }, [photoSelection, addToSelection, removeFromSelection]);
  
  // Select all photos
  const selectAll = useCallback((photos) => {
    const allPaths = photos.map(photo => photo.file.path);
    setPhotoSelection(allPaths);
    
    const selectionDict = {};
    allPaths.forEach(path => {
      selectionDict[path] = true;
    });
    setPhotoSelectionDict(selectionDict);
    
    logger.info('usePhotosListSelection', 'select_all', 'All photos selected', {
      selectionCount: allPaths.length
    });
  }, []);
  
  // Clear all selections
  const clearSelection = useCallback(() => {
    setPhotoSelection([]);
    setPhotoSelectionDict({});
    
    logger.info('usePhotosListSelection', 'selection_cleared', 'All selections cleared');
  }, []);
  
  // Check if photo is selected
  const isSelected = useCallback((photoPath) => {
    return photoSelectionDict[photoPath] === true;
  }, [photoSelectionDict]);
  
  // Get selection count
  const getSelectionCount = useCallback(() => {
    return photoSelection.length;
  }, [photoSelection]);
  
  // Check if any photos are selected
  const hasSelection = useCallback(() => {
    return photoSelection.length > 0;
  }, [photoSelection]);
  
  // Get selected photos from full photos array
  const getSelectedPhotos = useCallback((allPhotos) => {
    return allPhotos.filter(photo => isSelected(photo.file.path));
  }, [isSelected]);
  
  // Select photos by indices
  const selectByIndices = useCallback((photos, indices) => {
    const selectedPaths = indices.map(index => photos[index]?.file.path).filter(Boolean);
    setPhotoSelection(selectedPaths);
    
    const selectionDict = {};
    selectedPaths.forEach(path => {
      selectionDict[path] = true;
    });
    setPhotoSelectionDict(selectionDict);
    
    logger.debug('usePhotosListSelection', 'select_by_indices', 'Photos selected by indices', {
      indices,
      selectionCount: selectedPaths.length
    });
  }, []);
  
  // Select range of photos
  const selectRange = useCallback((photos, startIndex, endIndex) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    const indices = [];
    
    for (let i = start; i <= end && i < photos.length; i++) {
      indices.push(i);
    }
    
    selectByIndices(photos, indices);
    
    logger.debug('usePhotosListSelection', 'select_range', 'Photo range selected', {
      startIndex,
      endIndex,
      actualRange: [start, end],
      selectionCount: indices.length
    });
  }, [selectByIndices]);
  
  return {
    // State
    photoSelection,
    photoSelectionDict,
    
    // Setters (for backward compatibility)
    setPhotoSelection,
    setPhotoSelectionDict,
    
    // Functions
    addToSelection,
    removeFromSelection,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    getSelectionCount,
    hasSelection,
    getSelectedPhotos,
    selectByIndices,
    selectRange
  };
};