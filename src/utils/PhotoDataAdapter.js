/**
 * Photo Data Adapter for converting different photo data formats to a standardized BasePhoto format
 */

/**
 * Base photo interface structure
 * @typedef {Object} BasePhoto
 * @property {Object} file - File information
 * @property {string} file.path - Full file path
 * @property {string} file.name - File name
 * @property {boolean} has_thumbnail - Whether thumbnail exists
 * @property {string} [css_style] - CSS style string
 * @property {number} [star_rating] - Star rating (0-5)
 * @property {string} [comment] - Photo comment
 * @property {string} [camera_make] - Camera manufacturer
 * @property {string} [camera_model] - Camera model
 * @property {string} [date_taken] - Date photo was taken
 * @property {number} [search_relevance] - Search relevance score
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * PhotoDataAdapter class for converting different photo data formats
 */
export class PhotoDataAdapter {
  /**
   * Convert date-based photo data to BasePhoto format
   * @param {Array} photos - Array of photos from date list
   * @param {string} currentDate - Current date context
   * @returns {Array<BasePhoto>} Array of BasePhoto objects
   */
  static fromDateList(photos, currentDate) {
    if (!Array.isArray(photos)) return [];
    
    return photos.map((photo, index) => {
      // Handle different possible photo data structures
      const filePath = photo.file?.path || photo.path || photo.file_path || '';
      const fileName = photo.file?.name || photo.name || photo.filename || 
                      (filePath ? filePath.split('/').pop() : '');
      
      return {
        file: {
          path: filePath,
          name: fileName
        },
        has_thumbnail: photo.has_thumbnail ?? true,
        css_style: photo.css_style || photo.style || '',
        star_rating: photo.star_rating || photo.rating || 0,
        comment: photo.comment || photo.description || '',
        camera_make: photo.camera_make || photo.make || '',
        camera_model: photo.camera_model || photo.model || '',
        date_taken: photo.date_taken || photo.date || currentDate || '',
        metadata: {
          original_index: index,
          source: 'date_list',
          date_context: currentDate,
          ...photo.metadata
        }
      };
    });
  }
  
  /**
   * Convert search results to BasePhoto format
   * @param {Array} searchResults - Array of search result photos
   * @param {string} searchQuery - The search query used
   * @returns {Array<BasePhoto>} Array of BasePhoto objects
   */
  static fromSearchResults(searchResults, searchQuery = '') {
    if (!Array.isArray(searchResults)) return [];
    
    return searchResults.map((result, index) => {
      const filePath = result.file?.path || result.path || result.file_path || '';
      const fileName = result.file?.name || result.name || result.filename || 
                      (filePath ? filePath.split('/').pop() : '');
      
      return {
        file: {
          path: filePath,
          name: fileName
        },
        has_thumbnail: result.has_thumbnail ?? true,
        css_style: result.css_style || result.style || '',
        star_rating: result.star_rating || result.rating || 0,
        comment: result.comment || result.description || '',
        camera_make: result.camera_make || result.make || '',
        camera_model: result.camera_model || result.model || '',
        date_taken: result.date_taken || result.date || '',
        search_relevance: result.relevance || result.score || 1.0,
        metadata: {
          original_index: index,
          source: 'search_results',
          search_query: searchQuery,
          match_type: result.match_type || 'unknown',
          ...result.metadata
        }
      };
    });
  }
  
  /**
   * Convert generic photo array to BasePhoto format
   * @param {Array} photos - Array of photo objects
   * @param {Object} options - Conversion options
   * @returns {Array<BasePhoto>} Array of BasePhoto objects
   */
  static fromGenericArray(photos, options = {}) {
    if (!Array.isArray(photos)) return [];
    
    const { source = 'generic', context = {} } = options;
    
    return photos.map((photo, index) => {
      const filePath = photo.file?.path || photo.path || photo.file_path || '';
      const fileName = photo.file?.name || photo.name || photo.filename || 
                      (filePath ? filePath.split('/').pop() : '');
      
      return {
        file: {
          path: filePath,
          name: fileName
        },
        has_thumbnail: photo.has_thumbnail ?? true,
        css_style: photo.css_style || photo.style || '',
        star_rating: photo.star_rating || photo.rating || 0,
        comment: photo.comment || photo.description || '',
        camera_make: photo.camera_make || photo.make || '',
        camera_model: photo.camera_model || photo.model || '',
        date_taken: photo.date_taken || photo.date || '',
        metadata: {
          original_index: index,
          source: source,
          context: context,
          ...photo.metadata
        }
      };
    });
  }
  
  /**
   * Convert single photo to BasePhoto format
   * @param {Object} photo - Single photo object
   * @param {Object} options - Conversion options
   * @returns {BasePhoto} BasePhoto object
   */
  static fromSinglePhoto(photo, options = {}) {
    if (!photo) return null;
    
    const result = this.fromGenericArray([photo], options);
    return result.length > 0 ? result[0] : null;
  }
  
  /**
   * Filter photos by criteria
   * @param {Array<BasePhoto>} photos - Array of BasePhoto objects
   * @param {Object} criteria - Filter criteria
   * @returns {Array<BasePhoto>} Filtered array
   */
  static filter(photos, criteria = {}) {
    if (!Array.isArray(photos)) return [];
    
    return photos.filter(photo => {
      // Filter by file type
      if (criteria.fileType) {
        const ext = photo.file.name.toLowerCase().split('.').pop();
        if (criteria.fileType === 'image' && !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          return false;
        }
        if (criteria.fileType === 'video' && !['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
          return false;
        }
      }
      
      // Filter by star rating
      if (criteria.minRating && photo.star_rating < criteria.minRating) {
        return false;
      }
      
      // Filter by date range
      if (criteria.dateFrom || criteria.dateTo) {
        const photoDate = new Date(photo.date_taken);
        if (criteria.dateFrom && photoDate < new Date(criteria.dateFrom)) {
          return false;
        }
        if (criteria.dateTo && photoDate > new Date(criteria.dateTo)) {
          return false;
        }
      }
      
      // Filter by search relevance
      if (criteria.minRelevance && photo.search_relevance < criteria.minRelevance) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Sort photos by criteria
   * @param {Array<BasePhoto>} photos - Array of BasePhoto objects
   * @param {string} sortBy - Sort criteria
   * @param {string} order - Sort order ('asc' or 'desc')
   * @returns {Array<BasePhoto>} Sorted array
   */
  static sort(photos, sortBy = 'date_taken', order = 'desc') {
    if (!Array.isArray(photos)) return [];
    
    const sortedPhotos = [...photos];
    
    sortedPhotos.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'name':
          valueA = a.file.name.toLowerCase();
          valueB = b.file.name.toLowerCase();
          break;
        case 'date_taken':
          valueA = new Date(a.date_taken || 0);
          valueB = new Date(b.date_taken || 0);
          break;
        case 'star_rating':
          valueA = a.star_rating || 0;
          valueB = b.star_rating || 0;
          break;
        case 'search_relevance':
          valueA = a.search_relevance || 0;
          valueB = b.search_relevance || 0;
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return order === 'asc' ? -1 : 1;
      if (valueA > valueB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortedPhotos;
  }
}