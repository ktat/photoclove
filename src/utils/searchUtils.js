// Search utility functions

/**
 * Debounce function to limit search requests
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

/**
 * Parse search query for special operators
 */
export const parseSearchQuery = (query) => {
  const operators = {
    exact: [],
    exclude: [],
    wildcard: [],
    dateRange: null,
    camera: null,
    lens: null,
    iso: null,
    aperture: null
  };

  // Extract quoted strings for exact matches
  const exactMatches = query.match(/"([^"]+)"/g);
  if (exactMatches) {
    exactMatches.forEach(match => {
      operators.exact.push(match.slice(1, -1));
      query = query.replace(match, '');
    });
  }

  // Extract excluded terms (prefixed with -)
  const excludeMatches = query.match(/-(\w+)/g);
  if (excludeMatches) {
    excludeMatches.forEach(match => {
      operators.exclude.push(match.slice(1));
      query = query.replace(match, '');
    });
  }

  // Extract wildcard terms (containing *)
  const wildcardMatches = query.match(/\w*\*\w*/g);
  if (wildcardMatches) {
    wildcardMatches.forEach(match => {
      operators.wildcard.push(match);
      query = query.replace(match, '');
    });
  }

  // Extract date range queries
  const dateRangeMatch = query.match(/date:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/);
  if (dateRangeMatch) {
    operators.dateRange = {
      start: dateRangeMatch[1],
      end: dateRangeMatch[2]
    };
    query = query.replace(dateRangeMatch[0], '');
  }

  // Extract camera queries
  const cameraMatch = query.match(/camera:(\w+)/);
  if (cameraMatch) {
    operators.camera = cameraMatch[1];
    query = query.replace(cameraMatch[0], '');
  }

  // Extract lens queries
  const lensMatch = query.match(/lens:(\w+)/);
  if (lensMatch) {
    operators.lens = lensMatch[1];
    query = query.replace(lensMatch[0], '');
  }

  // Extract ISO queries
  const isoMatch = query.match(/iso:(\d+)/);
  if (isoMatch) {
    operators.iso = parseInt(isoMatch[1]);
    query = query.replace(isoMatch[0], '');
  }

  // Extract aperture queries
  const apertureMatch = query.match(/aperture:f?(\d+\.?\d*)/);
  if (apertureMatch) {
    operators.aperture = parseFloat(apertureMatch[1]);
    query = query.replace(apertureMatch[0], '');
  }

  return {
    ...operators,
    remainingQuery: query.trim()
  };
};

/**
 * Build search filters from parsed query
 */
export const buildSearchFilters = (parsedQuery, additionalFilters = {}) => {
  const filters = { ...additionalFilters };

  if (parsedQuery.dateRange) {
    filters.dateRange = parsedQuery.dateRange;
  }

  if (parsedQuery.camera) {
    filters.camera = parsedQuery.camera;
  }

  if (parsedQuery.lens) {
    filters.lens = parsedQuery.lens;
  }

  if (parsedQuery.iso) {
    filters.isoRange = { min: parsedQuery.iso, max: parsedQuery.iso };
  }

  if (parsedQuery.aperture) {
    filters.apertureRange = { min: parsedQuery.aperture, max: parsedQuery.aperture };
  }

  return filters;
};

/**
 * Highlight search terms in text
 */
export const highlightSearchTerms = (text, searchTerms) => {
  if (!searchTerms || searchTerms.length === 0 || !text) {
    return text;
  }

  const terms = Array.isArray(searchTerms) ? searchTerms : [searchTerms];
  const escapedTerms = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
};

/**
 * Calculate search relevance score
 */
export const calculateRelevance = (item, query, searchType) => {
  let score = 0;
  const queryLower = query.toLowerCase();

  // Exact filename match gets highest score
  if (item.file?.name?.toLowerCase() === queryLower) {
    score += 100;
  }

  // Filename contains query
  if (item.file?.name?.toLowerCase().includes(queryLower)) {
    score += 50;
  }

  // Path contains query
  if (item.file?.path?.toLowerCase().includes(queryLower)) {
    score += 30;
  }

  // Comment contains query
  if (item.comment?.toLowerCase().includes(queryLower)) {
    score += 40;
  }

  // Camera make/model contains query
  if (item.camera_make?.toLowerCase().includes(queryLower) || 
      item.camera_model?.toLowerCase().includes(queryLower)) {
    score += 35;
  }

  // Lens contains query
  if (item.lens_model?.toLowerCase().includes(queryLower)) {
    score += 30;
  }

  // Boost score for star ratings
  if (item.star_rating && item.star_rating > 0) {
    score += item.star_rating * 5;
  }

  // Boost score for photos with comments
  if (item.comment && item.comment.length > 0) {
    score += 10;
  }

  // Recent photos get slight boost
  if (item.date_taken) {
    const daysSinceCapture = (new Date() - new Date(item.date_taken)) / (1000 * 60 * 60 * 24);
    if (daysSinceCapture < 30) {
      score += 5;
    }
  }

  return Math.min(score, 100) / 100; // Normalize to 0-1
};

/**
 * Format search suggestions
 */
export const formatSearchSuggestions = (suggestions, currentQuery) => {
  return suggestions.map(suggestion => ({
    ...suggestion,
    displayText: highlightSearchTerms(suggestion.query, currentQuery),
    formattedTimestamp: new Date(suggestion.timestamp).toLocaleDateString()
  }));
};

/**
 * Validate search filters
 */
export const validateSearchFilters = (filters) => {
  const errors = {};

  // Validate date range
  if (filters.dateRange?.start && filters.dateRange?.end) {
    const start = new Date(filters.dateRange.start);
    const end = new Date(filters.dateRange.end);
    
    if (start > end) {
      errors.dateRange = 'Start date must be before end date';
    }
  }

  // Validate numeric ranges
  if (filters.isoRange?.min && filters.isoRange?.max) {
    if (filters.isoRange.min > filters.isoRange.max) {
      errors.isoRange = 'Minimum ISO must be less than maximum ISO';
    }
  }

  if (filters.apertureRange?.min && filters.apertureRange?.max) {
    if (filters.apertureRange.min > filters.apertureRange.max) {
      errors.apertureRange = 'Minimum aperture must be less than maximum aperture';
    }
  }

  if (filters.focalLengthRange?.min && filters.focalLengthRange?.max) {
    if (filters.focalLengthRange.min > filters.focalLengthRange.max) {
      errors.focalLengthRange = 'Minimum focal length must be less than maximum focal length';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Generate search query from filters
 */
export const generateQueryFromFilters = (filters) => {
  const queryParts = [];

  if (filters.camera) {
    queryParts.push(`camera:${filters.camera}`);
  }

  if (filters.lens) {
    queryParts.push(`lens:${filters.lens}`);
  }

  if (filters.dateRange?.start && filters.dateRange?.end) {
    queryParts.push(`date:${filters.dateRange.start}..${filters.dateRange.end}`);
  }

  if (filters.isoRange?.min && filters.isoRange?.max) {
    if (filters.isoRange.min === filters.isoRange.max) {
      queryParts.push(`iso:${filters.isoRange.min}`);
    } else {
      queryParts.push(`iso:${filters.isoRange.min}-${filters.isoRange.max}`);
    }
  }

  if (filters.apertureRange?.min && filters.apertureRange?.max) {
    if (filters.apertureRange.min === filters.apertureRange.max) {
      queryParts.push(`aperture:${filters.apertureRange.min}`);
    } else {
      queryParts.push(`aperture:${filters.apertureRange.min}-${filters.apertureRange.max}`);
    }
  }

  if (filters.starRating && filters.starRating > 0) {
    queryParts.push(`stars:${filters.starRating}`);
  }

  if (filters.hasComment) {
    queryParts.push('has:comment');
  }

  if (filters.fileExtension) {
    queryParts.push(`ext:${filters.fileExtension}`);
  }

  return queryParts.join(' ');
};

export default {
  debounce,
  parseSearchQuery,
  buildSearchFilters,
  highlightSearchTerms,
  calculateRelevance,
  formatSearchSuggestions,
  validateSearchFilters,
  generateQueryFromFilters
};