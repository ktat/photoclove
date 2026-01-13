import React, { useMemo } from 'react';
import Scrollable from "../../Scrollable.jsx";
import PhotoCard from "./PhotoCard.jsx";
import styles from './PhotoGrid.module.css';

/**
 * PhotoGrid Component
 * Renders a grid of photo thumbnails with infinite scroll support
 * Refactored to use PhotoCard component for individual photo rendering
 */
function PhotoGrid({
    displayedPhotos,
    totalPhotosCount,
    iconSize,
    photoSelectionDict,
    onAddSelection,
    onDisplayPhoto,
    onInfiniteScroll,
    isLimitedByConfig,
    configLimit,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    onClearFilters,
    showSideMenu,
    setShowSideMenu,
    importState,
    isLoading = false,
    thumbnailOrientationCorrection = false
}) {

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
        <div className={styles.container}>
            {/* Header with photo count and filters info */}
            <div className={styles.header}>
                {displayedPhotos.length > 0 ? (
                    <>
                        <span>Showing {displayedPhotos.length} photo{displayedPhotos.length !== 1 ? 's' : ''}</span>
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

            {/* Photo Grid - using global .photos class for complex grid layout */}
            <Scrollable f={onInfiniteScroll} className="photos">
                {displayedPhotos.map((photo, index) => {
                    // Include tag count in key to force re-render when tags change
                    const tagCount = photo.getTags ? photo.getTags().length : (photo.tags?.length || 0);
                    const photoKey = `${photo.originalPath}_${tagCount}`;

                    return (
                        <PhotoCard
                            key={photoKey}
                            photo={photo}
                            index={index}
                            iconSize={iconSize}
                            isSelected={photoSelectionDict[photo.originalPath] || false}
                            onAddSelection={onAddSelection}
                            onDisplayPhoto={onDisplayPhoto}
                            setShowSideMenu={setShowSideMenu}
                            importState={importState}
                            thumbnailOrientationCorrection={thumbnailOrientationCorrection}
                        />
                    );
                })}

                {/* Infinite scroll completion indicator */}
                {displayedPhotos.length > 0 && (
                    <div className={styles.scrollIndicator}>
                        {isLimitedByConfig ? (
                            <div>
                                <div>Showing {displayedPhotos.length} photos (limited by configuration)</div>
                                <div className={styles.scrollIndicatorSubtext}>
                                    Display limit: {configLimit} photos. There may be more photos available.
                                </div>
                            </div>
                        ) : (
                            displayedPhotos.length < totalPhotosCount ? (
                                <div className={styles.scrollToLoad}>
                                    <div className={styles.scrollArrow}>↓</div>
                                    <div>Scroll to load more</div>
                                    <div className={styles.scrollIndicatorSubtext}>
                                        {displayedPhotos.length} / {totalPhotosCount} photos
                                    </div>
                                </div>
                            ) : (
                                <div>All photos displayed ({displayedPhotos.length} photos)</div>
                            )
                        )}
                    </div>
                )}
            </Scrollable>
        </div>
    );
}

export default PhotoGrid;
