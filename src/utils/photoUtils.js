/**
 * Shared photo utility functions for handling photo operations
 */

import { Photo } from '../domain/Photo.js';

/**
 * Resolve a photo path from the list (which is relative to the library root,
 * or to the trash when browsing it) to an absolute path on disk.
 *
 * Paths that are already absolute - import candidates, for instance - are
 * returned untouched.
 *
 * @param {string} path - Path as stored in the photo list
 * @param {Object} [appConfig] - App config supplying the library/trash roots
 * @param {boolean} [inTrashBin=false] - Whether the path lives in the trash
 * @returns {string} Absolute path
 */
export const resolveAbsolutePhotoPath = (path, appConfig, inTrashBin = false) => {
  if (!path || path.startsWith('/')) return path;
  const photo = Photo.fromJSON({
    originalPath: path,
    name: path.replace(/^.+\//, ''),
    inTrashBin,
    configData: {
      import_to: appConfig?.import_to,
      thumbnail_store: appConfig?.thumbnail_store,
      trash_path: appConfig?.trash_path
    }
  });
  return photo?.displayPath() || path;
};

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
