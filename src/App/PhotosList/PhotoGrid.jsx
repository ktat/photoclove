import React, { useMemo, useRef } from 'react';
import VirtualPhotoGrid from "./VirtualPhotoGrid.jsx";
import styles from './PhotoGrid.module.css';

/**
 * PhotoGrid Component
 * Renders a virtualized grid of photo thumbnails
 * Uses react-window for efficient rendering of large photo collections
 */
function PhotoGrid({
    displayedPhotos,
    allPhotos,
    iconSize,
    onAddSelection,
    onDisplayPhoto,
    onOpenBurstGroup,
    isInBurstGroupMode = false,
    burstModeEnabled = false,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    onClearFilters,
    setShowSideMenu,
    showSideMenu,
    importState,
    thumbnailOrientationCorrection = false
}) {
    const containerRef = useRef(null);

    // Use all photos for virtualization
    const photos = allPhotos || displayedPhotos;

    // Check if any filters are active
    const hasActiveFilters = useMemo(() => {
        return starFilter > 0 || hasCommentFilter || hasTagFilter || extensionFilter !== 'all';
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    // Generate filter summary text
    const getFilterSummary = useMemo(() => {
        const filters = [];
        if (starFilter > 0) filters.push(`${starFilter}+ stars`);
        if (hasCommentFilter) filters.push('has comment');
        if (hasTagFilter) filters.push('has tags');
        if (extensionFilter !== 'all') filters.push(`${extensionFilter} files`);
        return `Filters applied: ${filters.join(', ')}`;
    }, [starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);

    return (
        <div className={styles.container} ref={containerRef}>
            {/* Header with photo count and filters info */}
            <div className={styles.header}>
                {photos.length > 0 ? (
                    <>
                        <span>Showing {photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
                        {hasActiveFilters && (
                            <div className={styles.filterSummary}>
                                {getFilterSummary}
                                <button
                                    className={styles.clearFiltersButton}
                                    onClick={onClearFilters}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            <VirtualPhotoGrid
                displayedPhotos={photos}
                iconSize={iconSize}
                onAddSelection={onAddSelection}
                onDisplayPhoto={onDisplayPhoto}
                onOpenBurstGroup={onOpenBurstGroup}
                isInBurstGroupMode={isInBurstGroupMode}
                burstModeEnabled={burstModeEnabled}
                setShowSideMenu={setShowSideMenu}
                showSideMenu={showSideMenu}
                importState={importState}
                thumbnailOrientationCorrection={thumbnailOrientationCorrection}
                containerRef={containerRef}
            />
        </div>
    );
}

export default PhotoGrid;
