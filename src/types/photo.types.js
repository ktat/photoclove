/**
 * Type definitions for photo-related data structures
 * These serve as documentation and validation for the BasePhoto interface
 */

/**
 * Base photo interface structure
 * @typedef {Object} BasePhoto
 * @property {Object} file - File information
 * @property {string} file.path - Full file path
 * @property {string} file.name - File name
 * @property {boolean} has_thumbnail - Whether thumbnail exists
 * @property {string} [css_style] - CSS style string for photo display
 * @property {number} [star_rating] - Star rating (0-5)
 * @property {string} [comment] - Photo comment/description
 * @property {string} [camera_make] - Camera manufacturer
 * @property {string} [camera_model] - Camera model
 * @property {string} [date_taken] - Date photo was taken (ISO string)
 * @property {number} [search_relevance] - Search relevance score (0-1)
 * @property {number} [file_size] - File size in bytes
 * @property {Object} [metadata] - Additional metadata
 * @property {number} [metadata.original_index] - Original index in source array
 * @property {string} [metadata.source] - Source of the photo data (date_list, search_results, etc.)
 * @property {string} [metadata.date_context] - Date context for date-based photos
 * @property {string} [metadata.search_query] - Search query for search results
 * @property {string} [metadata.match_type] - Type of match for search results
 */

/**
 * Photo display configuration
 * @typedef {Object} PhotoDisplayConfig
 * @property {boolean} [autoLoadFirst=true] - Auto-load first photo when photos change
 * @property {boolean} [enableKeyboardNav=true] - Enable keyboard navigation
 * @property {Function} [onPhotoChange] - Callback when photo changes
 * @property {number} [initialIndex=0] - Initial photo index
 */

/**
 * Thumbnail generation configuration
 * @typedef {Object} ThumbnailConfig
 * @property {boolean} [enableCaching=true] - Enable thumbnail caching
 * @property {boolean} [fallbackToOriginal=true] - Fallback to original file if thumbnail fails
 * @property {boolean} [preloadNext=true] - Preload next thumbnails for performance
 */

/**
 * Photo metadata configuration
 * @typedef {Object} PhotoMetadataConfig
 * @property {boolean} [autoSave=true] - Auto-save metadata changes
 * @property {number} [saveDelay=1000] - Delay before auto-save (milliseconds)
 * @property {Function} [onMetadataChange] - Callback when metadata changes
 */

/**
 * Thumbnail grid configuration
 * @typedef {Object} ThumbnailGridConfig
 * @property {string} [viewMode='grid'] - Display mode ('grid' or 'list')
 * @property {number} [thumbnailSize=150] - Thumbnail size in pixels
 * @property {boolean} [showFileName=true] - Show filename below thumbnail
 * @property {boolean} [showFileInfo=true] - Show file size and date info
 * @property {string} [sortBy='name'] - Sort criteria ('name', 'date', 'size', 'rating', 'relevance')
 * @property {string} [sortOrder='asc'] - Sort order ('asc' or 'desc')
 * @property {boolean} [enableSelection=true] - Enable photo selection
 * @property {boolean} [enablePagination=false] - Enable pagination
 * @property {number} [photosPerPage=50] - Photos per page when pagination enabled
 */

/**
 * Thumbnail strip configuration
 * @typedef {Object} ThumbnailStripConfig
 * @property {number} [thumbnailSize=80] - Thumbnail size in pixels
 * @property {number} [visibleCount=9] - Number of visible thumbnails
 * @property {boolean} [showFileName=false] - Show filename below thumbnail
 * @property {boolean} [showControls=true] - Show navigation controls
 * @property {string} [orientation='horizontal'] - Strip orientation ('horizontal' or 'vertical')
 */

/**
 * Right panel tab configuration
 * @typedef {Object} RightPanelTab
 * @property {string} id - Unique tab identifier
 * @property {string} label - Tab display label
 * @property {React.Component} component - Tab content component
 * @property {Object} [props] - Additional props for tab component
 */

/**
 * Right panel configuration
 * @typedef {Object} RightPanelConfig
 * @property {string} [context='photos'] - Panel context ('photos', 'search', etc.)
 * @property {RightPanelTab[]} tabs - Array of tab configurations
 * @property {string} [defaultActiveTab] - Default active tab ID
 * @property {Function} [onTabChange] - Callback when tab changes
 */

/**
 * Photo viewer configuration
 * @typedef {Object} PhotoViewerConfig
 * @property {string} [photoZoom='auto'] - Photo zoom level
 * @property {Function} [onPhotoLoad] - Callback when photo loads
 * @property {Function} [onPhotoError] - Callback when photo fails to load
 * @property {Function} [onPhotoClick] - Callback when photo is clicked
 * @property {boolean} [showControls=true] - Show viewer controls
 * @property {boolean} [enableZoom=true] - Enable zoom functionality
 */

/**
 * Photo filter criteria
 * @typedef {Object} PhotoFilterCriteria
 * @property {string} [fileType] - File type filter ('image', 'video')
 * @property {number} [minRating] - Minimum star rating
 * @property {string} [dateFrom] - Start date for date range filter
 * @property {string} [dateTo] - End date for date range filter
 * @property {number} [minRelevance] - Minimum search relevance score
 */

/**
 * Photo sorting options
 * @typedef {Object} PhotoSortOptions
 * @property {string} sortBy - Sort criteria ('name', 'date_taken', 'star_rating', 'search_relevance')
 * @property {string} order - Sort order ('asc' or 'desc')
 */

/**
 * Validation functions for photo data structures
 */

/**
 * Validate BasePhoto object structure
 * @param {any} photo - Object to validate
 * @returns {boolean} True if valid BasePhoto
 */
export function isValidBasePhoto(photo) {
  if (!photo || typeof photo !== 'object') return false;
  
  // Required fields
  if (!photo.file || typeof photo.file !== 'object') return false;
  if (!photo.file.path || typeof photo.file.path !== 'string') return false;
  if (!photo.file.name || typeof photo.file.name !== 'string') return false;
  if (typeof photo.has_thumbnail !== 'boolean') return false;
  
  // Optional fields validation
  if (photo.star_rating !== undefined) {
    if (typeof photo.star_rating !== 'number' || photo.star_rating < 0 || photo.star_rating > 5) {
      return false;
    }
  }
  
  if (photo.search_relevance !== undefined) {
    if (typeof photo.search_relevance !== 'number' || photo.search_relevance < 0 || photo.search_relevance > 1) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate array of BasePhoto objects
 * @param {any} photos - Array to validate
 * @returns {boolean} True if valid array of BasePhoto objects
 */
export function isValidBasePhotoArray(photos) {
  if (!Array.isArray(photos)) return false;
  return photos.every(photo => isValidBasePhoto(photo));
}

/**
 * Validate thumbnail grid configuration
 * @param {any} config - Configuration to validate
 * @returns {boolean} True if valid configuration
 */
export function isValidThumbnailGridConfig(config) {
  if (!config || typeof config !== 'object') return true; // Config is optional
  
  const validViewModes = ['grid', 'list'];
  const validSortBy = ['name', 'date', 'size', 'rating', 'relevance'];
  const validSortOrder = ['asc', 'desc'];
  
  if (config.viewMode && !validViewModes.includes(config.viewMode)) return false;
  if (config.sortBy && !validSortBy.includes(config.sortBy)) return false;
  if (config.sortOrder && !validSortOrder.includes(config.sortOrder)) return false;
  if (config.thumbnailSize && (typeof config.thumbnailSize !== 'number' || config.thumbnailSize <= 0)) return false;
  
  return true;
}

/**
 * Validate right panel tab configuration
 * @param {any} tab - Tab configuration to validate
 * @returns {boolean} True if valid tab configuration
 */
export function isValidRightPanelTab(tab) {
  if (!tab || typeof tab !== 'object') return false;
  if (!tab.id || typeof tab.id !== 'string') return false;
  if (!tab.label || typeof tab.label !== 'string') return false;
  if (!tab.component || typeof tab.component !== 'function') return false;
  
  return true;
}

/**
 * Default configurations for components
 */
export const DEFAULT_CONFIGS = {
  photoDisplay: {
    autoLoadFirst: true,
    enableKeyboardNav: true,
    initialIndex: 0
  },
  
  thumbnailGeneration: {
    enableCaching: true,
    fallbackToOriginal: true,
    preloadNext: true
  },
  
  photoMetadata: {
    autoSave: true,
    saveDelay: 1000
  },
  
  thumbnailGrid: {
    viewMode: 'grid',
    thumbnailSize: 150,
    showFileName: true,
    showFileInfo: true,
    sortBy: 'name',
    sortOrder: 'asc',
    enableSelection: true,
    enablePagination: false,
    photosPerPage: 50
  },
  
  thumbnailStrip: {
    thumbnailSize: 80,
    visibleCount: 9,
    showFileName: false,
    showControls: true,
    orientation: 'horizontal'
  },
  
  rightPanel: {
    context: 'photos',
    tabs: []
  },
  
  photoViewer: {
    photoZoom: 'auto',
    showControls: true,
    enableZoom: true
  }
};

/**
 * Create a default BasePhoto object
 * @param {string} filePath - File path
 * @param {string} fileName - File name
 * @param {Object} overrides - Property overrides
 * @returns {BasePhoto} Default BasePhoto object
 */
export function createDefaultBasePhoto(filePath, fileName, overrides = {}) {
  return {
    file: {
      path: filePath,
      name: fileName
    },
    has_thumbnail: true,
    css_style: '',
    star_rating: 0,
    comment: '',
    camera_make: '',
    camera_model: '',
    date_taken: '',
    search_relevance: 1.0,
    metadata: {
      original_index: 0,
      source: 'unknown'
    },
    ...overrides
  };
}