/**
 * Custom hook for photo display logic and navigation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { isVideoFile, isImageFile } from '../utils/photoUtils';

export const usePhotoDisplay = (photos = [], options = {}) => {
  const {
    autoLoadFirst = true,
    enableKeyboardNav = true,
    onPhotoChange = null,
    initialIndex = 0
  } = options;
  
  // State
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [photoZoom, setPhotoZoom] = useState('auto');
  const [showHelp, setShowHelp] = useState(false);
  
  // Refs
  const navigateLock = useRef(false);
  const keyboardListenerRef = useRef(null);
  
  // Navigation functions
  const navigateToIndex = useCallback((index) => {
    if (navigateLock.current || !photos.length || index < 0 || index >= photos.length) {
      return;
    }
    
    navigateLock.current = true;
    setCurrentIndex(index);
    setCurrentPhoto(photos[index]);
    setHasError(false);
    setIsLoading(true);
    
    // Call callback if provided
    if (onPhotoChange) {
      onPhotoChange(photos[index], index);
    }
    
    // Release lock after a brief delay
    setTimeout(() => {
      navigateLock.current = false;
      setIsLoading(false);
    }, 100);
  }, [photos, onPhotoChange]);
  
  const navigateNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < photos.length) {
      navigateToIndex(nextIndex);
    }
  }, [currentIndex, photos.length, navigateToIndex]);
  
  const navigatePrevious = useCallback(() => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      navigateToIndex(prevIndex);
    }
  }, [currentIndex, navigateToIndex]);
  
  const navigateFirst = useCallback(() => {
    navigateToIndex(0);
  }, [navigateToIndex]);
  
  const navigateLast = useCallback(() => {
    navigateToIndex(photos.length - 1);
  }, [photos.length, navigateToIndex]);
  
  // Keyboard navigation
  const handleKeyDown = useCallback((event) => {
    if (!enableKeyboardNav) return;
    
    switch (event.key) {
      case 'ArrowRight':
      case ' ': // Spacebar
        event.preventDefault();
        navigateNext();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        navigatePrevious();
        break;
      case 'Home':
        event.preventDefault();
        navigateFirst();
        break;
      case 'End':
        event.preventDefault();
        navigateLast();
        break;
      case 'h':
      case 'H':
      case '?':
        event.preventDefault();
        setShowHelp(prev => !prev);
        break;
      case 'Escape':
        event.preventDefault();
        setShowHelp(false);
        break;
      case '+':
      case '=':
        event.preventDefault();
        setPhotoZoom(prev => {
          const zooms = ['auto', '25%', '50%', '75%', '100%', '125%', '150%', '200%'];
          const currentIdx = zooms.indexOf(prev);
          return currentIdx < zooms.length - 1 ? zooms[currentIdx + 1] : prev;
        });
        break;
      case '-':
        event.preventDefault();
        setPhotoZoom(prev => {
          const zooms = ['auto', '25%', '50%', '75%', '100%', '125%', '150%', '200%'];
          const currentIdx = zooms.indexOf(prev);
          return currentIdx > 0 ? zooms[currentIdx - 1] : prev;
        });
        break;
      case '0':
        event.preventDefault();
        setPhotoZoom('auto');
        break;
      default:
        break;
    }
  }, [enableKeyboardNav, navigateNext, navigatePrevious, navigateFirst, navigateLast]);
  
  // Setup keyboard listeners
  useEffect(() => {
    if (enableKeyboardNav) {
      keyboardListenerRef.current = handleKeyDown;
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enableKeyboardNav, handleKeyDown]);
  
  // Auto-load first photo
  useEffect(() => {
    if (autoLoadFirst && photos.length > 0 && currentPhoto === null) {
      navigateToIndex(initialIndex < photos.length ? initialIndex : 0);
    }
  }, [autoLoadFirst, photos, currentPhoto, initialIndex, navigateToIndex]);
  
  // Update current photo when photos array changes
  useEffect(() => {
    if (photos.length > 0 && currentIndex < photos.length) {
      setCurrentPhoto(photos[currentIndex]);
    } else if (photos.length === 0) {
      setCurrentPhoto(null);
    }
  }, [photos, currentIndex]);
  
  // Utility functions
  const isCurrentVideo = currentPhoto ? isVideoFile(currentPhoto.file.path) : false;
  const isCurrentImage = currentPhoto ? isImageFile(currentPhoto.file.path) : false;
  const hasNext = currentIndex < photos.length - 1;
  const hasPrevious = currentIndex > 0;
  
  return {
    // State
    currentIndex,
    currentPhoto,
    isLoading,
    hasError,
    setHasError,
    photoZoom,
    setPhotoZoom,
    showHelp,
    setShowHelp,
    
    // Navigation
    navigateToIndex,
    navigateNext,
    navigatePrevious,
    navigateFirst,
    navigateLast,
    
    // Utilities
    isCurrentVideo,
    isCurrentImage,
    hasNext,
    hasPrevious,
    
    // Info
    totalPhotos: photos.length,
    isFirstPhoto: currentIndex === 0,
    isLastPhoto: currentIndex === photos.length - 1
  };
};