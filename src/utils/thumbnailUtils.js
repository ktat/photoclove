/**
 * Thumbnail utility functions for handling thumbnail operations
 */

/**
 * Extract UUID from file path for thumbnail generation
 * @param {string} filePath - Full file path
 * @returns {string} UUID string
 */
const extractUUIDFromPath = (filePath) => {
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
