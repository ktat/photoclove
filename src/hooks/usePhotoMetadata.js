/**
 * Custom hook for photo metadata management (star ratings, comments, EXIF data)
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { debounce } from '../utils/photoUtils';
import { logger } from '../services/LoggerService.js';

export const usePhotoMetadata = (photo, options = {}) => {
  const {
    autoSave = true,
    saveDelay = 1000,
    onMetadataChange = null
  } = options;
 
  // State
  const [starRating, setStarRating] = useState(0);
  const [comment, setComment] = useState('');
  const [exifData, setExifData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);
 
  // Initialize metadata when photo changes
  useEffect(() => {
    if (photo) {
      setStarRating(photo.star_rating || 0);
      setComment(photo.comment || '');
      setExifData(photo.exifData || null);
      setHasUnsavedChanges(false);
      setError(null);
    } else {
      setStarRating(0);
      setComment('');
      setExifData(null);
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [photo]);
 
  // Save metadata to backend
  const saveMetadata = useCallback(async (updatedMetadata = {}) => {
    if (!photo?.file?.path) return false;
   
    setIsSaving(true);
    setError(null);
   
    try {
      const metadataToSave = {
        file_path: photo.file.path,
        star_rating: updatedMetadata.star_rating ?? starRating,
        comment: updatedMetadata.comment ?? comment,
        ...updatedMetadata
      };
     
      await invoke('update_photo_metadata', metadataToSave);
     
      setHasUnsavedChanges(false);
     
      // Call callback if provided
      if (onMetadataChange) {
        onMetadataChange(metadataToSave);
      }
     
      return true;
    } catch (err) {
      logger.error('usePhotoMetadata', 'save_metadata_failed', 'Failed to save photo metadata', {
        error: err.message || err.toString(),
        photoPath: photo?.file?.path,
        starRating,
        comment: comment?.length || 0
      });
      setError(err.message || 'Failed to save metadata');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [photo, starRating, comment, onMetadataChange]);
 
  // Debounced save function
  const debouncedSave = useCallback(
    debounce((metadata) => {
      if (autoSave) {
        saveMetadata(metadata);
      }
    }, saveDelay),
    [autoSave, saveMetadata, saveDelay]
  );
 
  // Update star rating
  const updateStarRating = useCallback((newRating) => {
    if (newRating >= 0 && newRating <= 5) {
      setStarRating(newRating);
      setHasUnsavedChanges(true);
      debouncedSave({ star_rating: newRating });
    }
  }, [debouncedSave]);
 
  // Update comment
  const updateComment = useCallback((newComment) => {
    setComment(newComment);
    setHasUnsavedChanges(true);
    debouncedSave({ comment: newComment });
  }, [debouncedSave]);
 
  // Load EXIF data
  const loadExifData = useCallback(async () => {
    if (!photo?.file?.path) return null;
   
    setIsLoading(true);
    setError(null);
   
    try {
      const exif = await invoke('get_photo_exif', {
        file_path: photo.file.path
      });
     
      const parsedExif = typeof exif === 'string' ? JSON.parse(exif) : exif;
      setExifData(parsedExif);
      return parsedExif;
    } catch (err) {
      logger.warn('usePhotoMetadata', 'load_exif_failed', 'Failed to load EXIF data', {
        error: err.message || err.toString(),
        photoPath: photo?.file?.path
      });
      setError(err.message || 'Failed to load EXIF data');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [photo]);
 
  // Load additional metadata
  const loadFullMetadata = useCallback(async () => {
    if (!photo?.file?.path) return null;
   
    setIsLoading(true);
    setError(null);
   
    try {
      const metadata = await invoke('get_photo_metadata', {
        file_path: photo.file.path
      });
     
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
     
      // Update state with loaded metadata
      if (parsedMetadata.star_rating !== undefined) {
        setStarRating(parsedMetadata.star_rating);
      }
      if (parsedMetadata.comment !== undefined) {
        setComment(parsedMetadata.comment);
      }
      if (parsedMetadata.exif) {
        setExifData(parsedMetadata.exif);
      }
     
      setHasUnsavedChanges(false);
      return parsedMetadata;
    } catch (err) {
      logger.warn('usePhotoMetadata', 'load_metadata_failed', 'Failed to load photo metadata', {
        error: err.message || err.toString(),
        photoPath: photo?.file?.path
      });
      setError(err.message || 'Failed to load metadata');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [photo]);
 
  // Force save current changes
  const forceSave = useCallback(() => {
    return saveMetadata();
  }, [saveMetadata]);
 
  // Reset metadata to original values
  const resetMetadata = useCallback(() => {
    if (photo) {
      setStarRating(photo.star_rating || 0);
      setComment(photo.comment || '');
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [photo]);
 
  // Helper to format EXIF data for display
  const getFormattedExifData = useCallback(() => {
    if (!exifData) return {};
   
    const formatted = {};
   
    // Common EXIF fields with readable names
    const fieldMappings = {
      'Camera Make': exifData.make || exifData.Make,
      'Camera Model': exifData.model || exifData.Model,
      'Date Taken': exifData.date_taken || exifData.DateTime,
      'ISO': exifData.iso || exifData.ISO,
      'F-Stop': exifData.f_number || exifData.FNumber,
      'Shutter Speed': exifData.shutter_speed || exifData.ExposureTime,
      'Focal Length': exifData.focal_length || exifData.FocalLength,
      'Flash': exifData.flash || exifData.Flash,
      'White Balance': exifData.white_balance || exifData.WhiteBalance,
      'Orientation': exifData.orientation || exifData.Orientation,
      'GPS Latitude': exifData.gps_latitude || exifData.GPSLatitude,
      'GPS Longitude': exifData.gps_longitude || exifData.GPSLongitude
    };
   
    Object.entries(fieldMappings).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formatted[key] = value;
      }
    });
   
    return formatted;
  }, [exifData]);
 
  return {
    // Current values
    starRating,
    comment,
    exifData,
   
    // Status
    isLoading,
    isSaving,
    hasUnsavedChanges,
    error,
   
    // Actions
    updateStarRating,
    updateComment,
    loadExifData,
    loadFullMetadata,
    forceSave,
    resetMetadata,
   
    // Utilities
    getFormattedExifData,
   
    // Direct save function
    saveMetadata
  };
};
