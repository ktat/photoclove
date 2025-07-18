import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const AdvancedFilters = ({ onFiltersChange, initialFilters = {} }) => {
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
    ...initialFilters
  });

  const [filterOptions, setFilterOptions] = useState({
    cameras: [],
    lenses: [],
    extensions: []
  });

  const [isLoading, setIsLoading] = useState(false);

  // Load filter options from backend
  useEffect(() => {
    const loadFilterOptions = async () => {
      setIsLoading(true);
      try {
        const [cameras, lenses, extensions] = await Promise.all([
          invoke('get_filter_options', { filterType: 'cameras' }),
          invoke('get_filter_options', { filterType: 'lenses' }),
          invoke('get_filter_options', { filterType: 'extensions' })
        ]);

        setFilterOptions({
          cameras: JSON.parse(cameras),
          lenses: JSON.parse(lenses),
          extensions: JSON.parse(extensions)
        });
      } catch (error) {
        console.error('Failed to load filter options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    console.log('Filter updated:', key, value, 'All filters:', newFilters);
    onFiltersChange(newFilters);
  };

  const updateRangeFilter = (key, subKey, value) => {
    const newFilters = {
      ...filters,
      [key]: { ...filters[key], [subKey]: value }
    };
    setFilters(newFilters);
    console.log('Range filter updated:', key, subKey, value, 'All filters:', newFilters);
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
      fileExtension: ''
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  if (isLoading) {
    return <div className="advanced-filters loading">Loading filter options...</div>;
  }

  return (
    <div className="advanced-filters">
      <div className="filters-header">
        <h3>Advanced Filters</h3>
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
              onChange={(e) => updateFilter('camera', e.target.value)}
            >
              <option value="">All Cameras</option>
              {filterOptions.cameras.map(camera => (
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
              {filterOptions.lenses.map(lens => (
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
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => updateRangeFilter('dateRange', 'start', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To:</label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => updateRangeFilter('dateRange', 'end', e.target.value)}
            />
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
              {filterOptions.extensions.map(ext => (
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
              onChange={(e) => updateFilter('starRating', parseInt(e.target.value))}
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