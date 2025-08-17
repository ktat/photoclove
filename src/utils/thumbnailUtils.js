/**
 * Thumbnail utility functions for handling thumbnail operations
 */
import { logger } from '../services/LoggerService.js';

/**
 * Extract UUID from file path for thumbnail generation
 * @param {string} filePath - Full file path
 * @returns {string} UUID string
 */
export const extractUUIDFromPath = (filePath) => {
  if (!filePath) return '';
  
  // Remove file extension and get the base name
  const baseName = filePath.split('/').pop().split('\\').pop();
  const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf('.')) || baseName;
  
  // Extract UUID pattern (assuming it's in the filename)
  const uuidMatch = nameWithoutExt.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) {
    return uuidMatch[1];
  }
  
  // If no UUID found, use the filename without extension
  return nameWithoutExt;
};

/**
 * Generate thumbnail source URL
 * @param {string} filePath - Original file path
 * @param {string} thumbnailStore - Thumbnail store path
 * @param {boolean} hasThumbnail - Whether thumbnail exists
 * @returns {string} Thumbnail URL
 */
export const getThumbnailSrc = (filePath, thumbnailStore, hasThumbnail = true) => {
  if (!filePath || !hasThumbnail) {
    return filePath; // Return original if no thumbnail
  }
  
  const uuid = extractUUIDFromPath(filePath);
  if (!uuid) {
    return filePath;
  }
  
  const thumbnailPath = `${thumbnailStore}/${uuid}.webp`;
  return thumbnailPath;
};

/**
 * Generate multiple thumbnail sizes
 * @param {string} filePath - Original file path
 * @param {string} thumbnailStore - Thumbnail store path
 * @param {Array<string>} sizes - Array of size suffixes (e.g., ['_small', '_medium', '_large'])
 * @returns {Object} Object with size keys and thumbnail URLs
 */
export const getThumbnailSources = (filePath, thumbnailStore, sizes = ['_small', '_medium', '_large']) => {
  const uuid = extractUUIDFromPath(filePath);
  if (!uuid) {
    return { original: filePath };
  }
  
  const sources = { original: filePath };
  
  sizes.forEach(size => {
    const sizeKey = size.replace('_', '');
    sources[sizeKey] = `${thumbnailStore}/${uuid}${size}.webp`;
  });
  
  return sources;
};

/**
 * Extract date from photo path (assuming date is encoded in the path)
 * @param {string} filePath - Photo file path
 * @returns {string|null} Date string or null if not found
 */
export const extractDateFromPath = (filePath) => {
  if (!filePath) return null;
  
  // Look for date patterns in the path (YYYY-MM-DD, YYYY/MM/DD, etc.)
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,  // YYYY-MM-DD
    /(\d{4}\/\d{2}\/\d{2})/, // YYYY/MM/DD
    /(\d{4}_\d{2}_\d{2})/,  // YYYY_MM_DD
    /(\d{8})/               // YYYYMMDD
  ];
  
  for (const pattern of datePatterns) {
    const match = filePath.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Check if thumbnail exists for a given photo
 * @param {string} filePath - Original file path
 * @param {string} thumbnailStore - Thumbnail store path
 * @returns {Promise<boolean>} Promise resolving to true if thumbnail exists
 */
export const checkThumbnailExists = async (filePath, thumbnailStore) => {
  if (!filePath || !thumbnailStore) return false;
  
  try {
    const uuid = extractUUIDFromPath(filePath);
    if (!uuid) return false;
    
    const thumbnailPath = `${thumbnailStore}/${uuid}.webp`;
    
    // This would need to be implemented with Tauri's file system API
    // For now, return true and let the image loading handle errors
    return true;
  } catch (error) {
    logger.warn('thumbnailUtils', 'thumbnail_check_error', 'Error checking thumbnail existence', { filePath, thumbnailStore, error: error.message });
    return false;
  }
};

/**
 * Create thumbnail loading strategy with fallbacks
 * @param {string} filePath - Original file path
 * @param {string} thumbnailStore - Thumbnail store path
 * @param {boolean} hasThumbnail - Whether thumbnail is expected to exist
 * @returns {Object} Loading strategy with primary and fallback sources
 */
export const createThumbnailLoadingStrategy = (filePath, thumbnailStore, hasThumbnail = true) => {
  const strategy = {
    primary: filePath,
    fallback: filePath,
    sources: []
  };
  
  if (hasThumbnail && thumbnailStore) {
    const thumbnailSrc = getThumbnailSrc(filePath, thumbnailStore, hasThumbnail);
    strategy.primary = thumbnailSrc;
    strategy.sources = [thumbnailSrc, filePath];
  } else {
    strategy.sources = [filePath];
  }
  
  return strategy;
};