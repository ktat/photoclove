import React from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { VIEW_MODES, supportsBurstGrouping } from '../../constants/viewModes.js';
import styles from './PhotosToolbar.module.css';

/**
 * PhotosToolbar Component
 * Extracted from PhotosList.jsx to reduce component complexity
 * Handles icon size, sorting, and filter controls
 */
function PhotosToolbar({
    iconSize,
    setIconSize,
    sortOfPhotos,
    setSort,
    showFilterPopover,
    setShowFilterPopover,
    filterButtonRef,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    hasActiveFilters
}) {
    // Determine mode from viewMode
    const { viewMode, burstModeEnabled, toggleBurstMode } = useUI();
    const isImportMode = viewMode === VIEW_MODES.IMPORT;
    const showBurstToggle = supportsBurstGrouping(viewMode);

    // Calculate active filter count (mode-aware)
    const activeFilterCount = isImportMode
        ? [extensionFilter !== "all"].filter(Boolean).length  // Import mode: only extension filter
        : [starFilter > 0, hasCommentFilter, hasTagFilter, extensionFilter !== "all"].filter(Boolean).length;  // Normal mode: all filters

    return (
        <div className="photo-operation">
            {showBurstToggle && (
                <button
                    className={burstModeEnabled ? styles.burstButtonActive : styles.burstButton}
                    onClick={toggleBurstMode}
                    title={burstModeEnabled ? "Show all photos" : "Group burst photos"}
                >
                    {burstModeEnabled ? "Burst ON" : "Burst"}
                </button>
            )}
            Icon:<select
                name="icon_size"
                value={iconSize}
                onChange={(e) => setIconSize(parseInt(e.target.value))}
            >
                <option value={50}>small</option>
                <option value={100}>normal</option>
                <option value={200}>large</option>
                <option value={300}>huge</option>
            </select>
            
            Sort:<select
                name="sort"
                value={sortOfPhotos}
                onChange={(e) => setSort(parseInt(e.target.value))}
            >
                {!isImportMode && <option value={0}>Shot Time (desc)</option>}
                {!isImportMode && <option value={1}>Shot Time (asc)</option>}
                <option value={2}>Added Time (desc)</option>
                <option value={3}>Added Time (asc)</option>
                {!isImportMode && <option value={4}>Star Rating (desc)</option>}
                {!isImportMode && <option value={5}>Star Rating (asc)</option>}
                <option value={6}>File Name (desc)</option>
                <option value={7}>File Name (asc)</option>
            </select>
            
            <button
                ref={filterButtonRef}
                onClick={() => setShowFilterPopover(!showFilterPopover)}
                className={hasActiveFilters ? styles.filterButtonActive : styles.filterButton}
                title="Filter photos"
            >
                <span className={styles.filterIcon}>⚙️</span>
                Filter
                {hasActiveFilters && (
                    <span className={styles.filterBadge}>
                        {activeFilterCount}
                    </span>
                )}
            </button>
            {/* Num selector removed - not needed with infinite scroll */}
        </div>
    );
}

export default PhotosToolbar;