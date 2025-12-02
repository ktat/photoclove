import React from 'react';

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
    hasActiveFilters,
    isImportMode
}) {
    // Calculate active filter count
    const activeFilterCount = [
        starFilter > 0, 
        hasCommentFilter, 
        hasTagFilter, 
        extensionFilter !== "all"
    ].filter(Boolean).length;

    return (
        <div className="photo-operation">
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
                style={{
                    padding: '6px 10px',
                    marginLeft: '10px',
                    backgroundColor: hasActiveFilters ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
                title="Filter photos"
            >
                <span style={{ fontSize: '16px' }}>⚙️</span>
                Filter
                {hasActiveFilters && (
                    <span style={{
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        marginLeft: '4px'
                    }}>
                        {activeFilterCount}
                    </span>
                )}
            </button>
            {/* Num selector removed - not needed with infinite scroll */}
        </div>
    );
}

export default PhotosToolbar;