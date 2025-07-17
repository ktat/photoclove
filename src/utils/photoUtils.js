/**
 * Shared photo utility functions for handling photo operations
 */

/**
 * Parse CSS style string and convert to style object
 * @param {string} cssString - CSS string to parse
 * @returns {object} Style object
 */
export const parseCssStyle = (cssString) => {
  if (!cssString) return {};
  
  const styles = {};
  const declarations = cssString.split(';').filter(decl => decl.trim());
  
  declarations.forEach(declaration => {
    const [property, value] = declaration.split(':').map(s => s.trim());
    if (property && value) {
      // Convert kebab-case to camelCase
      const camelProperty = property.replace(/-([a-z])/g, (match, letter) => 
        letter.toUpperCase()
      );
      styles[camelProperty] = value;
    }
  });
  
  return styles;
};

/**
 * Check if file is a video based on extension
 * @param {string} filePath - Path to file
 * @returns {boolean} True if file is a video
 */
export const isVideoFile = (filePath) => {
  if (!filePath) return false;
  const ext = filePath.toLowerCase().split('.').pop();
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
};

/**
 * Check if file is an image based on extension
 * @param {string} filePath - Path to file
 * @returns {boolean} True if file is an image
 */
export const isImageFile = (filePath) => {
  if (!filePath) return false;
  const ext = filePath.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
};

/**
 * Handle image loading errors with fallback
 * @param {Event} event - Error event
 * @param {string} fallbackSrc - Fallback image source
 */
export const handleImageError = (event, fallbackSrc) => {
  if (event.target.src !== fallbackSrc) {
    event.target.src = fallbackSrc;
  } else {
    // If even fallback fails, hide the image
    event.target.style.display = 'none';
  }
};

/**
 * Get file extension from path
 * @param {string} filePath - Path to file
 * @returns {string} File extension
 */
export const getFileExtension = (filePath) => {
  if (!filePath) return '';
  return filePath.toLowerCase().split('.').pop() || '';
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Extract filename from path
 * @param {string} filePath - Full file path
 * @returns {string} Filename without path
 */
export const getFileName = (filePath) => {
  if (!filePath) return '';
  return filePath.split('/').pop() || filePath.split('\\').pop() || '';
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