import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TagChip from './TagChip.jsx';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';
import './AdvancedFilters.css';

const AdvancedFilters = ({
  onFiltersChange,
  initialFilters = {},
  filterOptions,
  onLoadFilterOptions,
  isLoading
}) => {
  const [filters, setFilters] = useState({
    camera: '',
    lens: '',
    isoRange: { min: '', max: '' },
    apertureRange: { min: '', max: '' },
    shutterSpeedRange: { min: '', max: '' },
    focalLengthRange: { min: '', max: '' },
    dateRange: { start: '', end: '' },
    hasComment: false,
    starRating: 0,
    fileExtension: '',
    selectedTags: [],
    ...initialFilters
  });

  const [availableTags, setAvailableTags] = useState([]);

  // Update filters when initialFilters change
  useEffect(() => {
    setFilters({
      camera: '',
      lens: '',
      isoRange: { min: '', max: '' },
      apertureRange: { min: '', max: '' },
      shutterSpeedRange: { min: '', max: '' },
      focalLengthRange: { min: '', max: '' },
      dateRange: { start: '', end: '' },
      hasComment: false,
      starRating: 0,
      fileExtension: '',
      selectedTags: [],
      ...initialFilters
    });
  }, [initialFilters]);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await unifiedCollectionService.getTags();
        logger.debug('AdvancedFilters', 'tags_loaded', 'Tags loaded from service', {
          tagCount: tags.length
        });

        // Convert to format expected by TagChip: [{id, name, color}, ...]
        const formattedTags = tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color || null
        }));

        logger.info('AdvancedFilters', 'tags_formatted', 'Tags formatted for display', {
          count: formattedTags.length
        });

        setAvailableTags(formattedTags);
      } catch (error) {
        logger.error('AdvancedFilters', 'load_tags_failed', 'Failed to load tags for filter', {
          error: error.message || error.toString()
        });
      }
    };

    loadTags();
  }, []);
 
  // Component mount effect to request filter options if not loaded
  useEffect(() => {
    if (!filterOptions && !isLoading && onLoadFilterOptions) {
      onLoadFilterOptions();
    }
  }, [filterOptions, onLoadFilterOptions, isLoading]);

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    logger.debug('AdvancedFilters', 'filter_updated', 'Filter updated', {
      key,
      oldValue: filters[key],
      newValue: value,
      allFilters: newFilters
    });
    onFiltersChange(newFilters);
  };

  const updateRangeFilter = (key, subKey, value) => {
    // Convert empty string to empty string (not 0) for proper backend handling
    const processedValue = value === '' ? '' : value;
    const newFilters = {
      ...filters,
      [key]: { ...filters[key], [subKey]: processedValue }
    };
    setFilters(newFilters);
    logger.debug('AdvancedFilters', 'range_filter_updated', 'Range filter updated', {
      key,
      subKey,
      originalValue: value,
      processedValue,
      allFilters: newFilters
    });
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      camera: '',
      lens: '',
      isoRange: { min: '', max: '' },
      apertureRange: { min: '', max: '' },
      shutterSpeedRange: { min: '', max: '' },
      focalLengthRange: { min: '', max: '' },
      dateRange: { start: '', end: '' },
      hasComment: false,
      starRating: 0,
      fileExtension: '',
      selectedTags: []
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const handleTagToggle = (tag) => {
    const isSelected = filters.selectedTags.some(t => t.id === tag.id);
    const newSelectedTags = isSelected
      ? filters.selectedTags.filter(t => t.id !== tag.id)
      : [...filters.selectedTags, tag];
   
    updateFilter('selectedTags', newSelectedTags);
  };

  if (!filterOptions && isLoading) {
    return <div className="advanced-filters loading">Loading filter options...</div>;
  }
 
  // Fallback to empty arrays if filterOptions is not available
  const availableOptions = filterOptions || {
    cameras: [],
    lenses: [],
    extensions: []
  };

  return (
    <div className="advanced-filters">
      <div className="filters-header">
        <h3>Search Options</h3>
        <div className="filter-actions">
          <button onClick={clearFilters} className="clear-filters-button">
            Clear All
          </button>
        </div>
      </div>

      <div className="filter-sections">
        {/* Camera Equipment */}
        <div className="filter-section">
          <h4>Camera Equipment</h4>
         
          <div className="filter-group">
            <label>Camera:</label>
            <select
              value={filters.camera}
              onChange={(e) => {
                logger.debug('AdvancedFilters', 'camera_filter_changed', 'Camera filter changed', {
                  selectedValue: e.target.value,
                  availableCameras: availableOptions.cameras?.slice(0, 3), // Log first 3 for debugging
                  totalCameras: availableOptions.cameras?.length
                });
                updateFilter('camera', e.target.value);
              }}
            >
              <option value="">All Cameras</option>
              {availableOptions.cameras.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.make} {camera.model} ({camera.count} photos)
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Lens:</label>
            <select
              value={filters.lens}
              onChange={(e) => updateFilter('lens', e.target.value)}
            >
              <option value="">All Lenses</option>
              {availableOptions.lenses.map(lens => (
                <option key={lens.id} value={lens.id}>
                  {lens.model} ({lens.count} photos)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Technical Settings */}
        <div className="filter-section">
          <h4>Technical Settings</h4>
         
          <div className="filter-group">
            <label>ISO Range:</label>
            <div className="range-inputs">
              <input
                type="number"
                placeholder="Min"
                value={filters.isoRange.min}
                onChange={(e) => updateRangeFilter('isoRange', 'min', e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.isoRange.max}
                onChange={(e) => updateRangeFilter('isoRange', 'max', e.target.value)}
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Aperture Range:</label>
            <div className="range-inputs">
              <input
                type="number"
                step="0.1"
                placeholder="Min f/"
                value={filters.apertureRange.min}
                onChange={(e) => updateRangeFilter('apertureRange', 'min', e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                step="0.1"
                placeholder="Max f/"
                value={filters.apertureRange.max}
                onChange={(e) => updateRangeFilter('apertureRange', 'max', e.target.value)}
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Focal Length Range (mm):</label>
            <div className="range-inputs">
              <input
                type="number"
                placeholder="Min"
                value={filters.focalLengthRange.min}
                onChange={(e) => updateRangeFilter('focalLengthRange', 'min', e.target.value)}
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.focalLengthRange.max}
                onChange={(e) => updateRangeFilter('focalLengthRange', 'max', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="filter-section">
          <h4>Date Range</h4>
         
          <div className="filter-group">
            <label>From:</label>
            <div className="date-input-wrapper">
              <DatePicker
                selected={filters.dateRange.start ? new Date(filters.dateRange.start) : null}
                onChange={(date) => {
                  const dateStr = date ? date.toISOString().split('T')[0] : '';
                  updateRangeFilter('dateRange', 'start', dateStr);
                }}
                dateFormat="yyyy-MM-dd"
                dateFormatCalendar="MMMM yyyy"
                placeholderText="Select start date"
                isClearable
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                yearDropdownItemNumber={100}
                scrollableYearDropdown
                className="date-picker-input"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>To:</label>
            <div className="date-input-wrapper">
              <DatePicker
                selected={filters.dateRange.end ? new Date(filters.dateRange.end) : null}
                onChange={(date) => {
                  const dateStr = date ? date.toISOString().split('T')[0] : '';
                  updateRangeFilter('dateRange', 'end', dateStr);
                }}
                dateFormat="yyyy-MM-dd"
                dateFormatCalendar="MMMM yyyy"
                placeholderText="Select end date"
                isClearable
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                yearDropdownItemNumber={100}
                scrollableYearDropdown
                minDate={filters.dateRange.start ? new Date(filters.dateRange.start) : null}
                className="date-picker-input"
              />
            </div>
          </div>
        </div>

        {/* Tags Filter */}
        <div className="filter-section">
          <h4>Tags</h4>
         
          <div className="filter-group">
            <label>Filter by Tags:</label>
            {availableTags.length > 0 ? (
              <div className="tag-filter-container">
                <div className="available-tags">
                  <div className="tag-filter-label">Available Tags:</div>
                  <div className="tag-filter-list">
                    {availableTags.map(tag => {
                      const isSelected = filters.selectedTags.some(t => t.id === tag.id);
                      return (
                        <TagChip
                          key={tag.id}
                          tag={tag}
                          onClick={() => handleTagToggle(tag)}
                          style={{
                            opacity: isSelected ? 1 : 0.6,
                            border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                            cursor: 'pointer'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
               
                {filters.selectedTags.length > 0 && (
                  <div className="selected-tags">
                    <div className="tag-filter-label">Selected Tags ({filters.selectedTags.length}):</div>
                    <div className="tag-filter-list">
                      {filters.selectedTags.map(tag => (
                        <TagChip
                          key={tag.id}
                          tag={tag}
                          isRemovable={true}
                          onRemove={() => handleTagToggle(tag)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-tags-message">
                No tags available. Create tags in Preferences to use tag filtering.
              </div>
            )}
          </div>
        </div>

        {/* Other Filters */}
        <div className="filter-section">
          <h4>Other Filters</h4>
         
          <div className="filter-group">
            <label>File Extension:</label>
            <select
              value={filters.fileExtension}
              onChange={(e) => updateFilter('fileExtension', e.target.value)}
            >
              <option value="">All Types</option>
              {availableOptions.extensions.map(ext => (
                <option key={ext.extension} value={ext.extension}>
                  {ext.extension.toUpperCase()} ({ext.count} photos)
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Star Rating:</label>
            <select
              value={filters.starRating}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                const starValue = isNaN(value) ? 0 : value;
                logger.debug('AdvancedFilters', 'star_rating_changed', 'Star rating changed', {
                  originalValue: e.target.value,
                  processedValue: starValue
                });
                updateFilter('starRating', starValue);
              }}
            >
              <option value={0}>All Ratings</option>
              <option value={1}>1 Star+</option>
              <option value={2}>2 Stars+</option>
              <option value={3}>3 Stars+</option>
              <option value={4}>4 Stars+</option>
              <option value={5}>5 Stars</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={filters.hasComment}
                onChange={(e) => updateFilter('hasComment', e.target.checked)}
              />
              Has Comments
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilters;
