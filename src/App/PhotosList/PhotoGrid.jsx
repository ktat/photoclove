import React, { useMemo } from 'react';
import Scrollable from "../../Scrollable.jsx";
import PhotoCard from "./PhotoCard.jsx";

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
    isLoading = false
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
        <div className="photo-grid-container">
            {/* Header with photo count and filters info */}
            <div style={{ marginBottom: "10px", fontSize: "14px", color: "var(--text)" }}>
                {displayedPhotos.length > 0 ? (
                    <>
                        <span>Showing {displayedPhotos.length} photo{displayedPhotos.length !== 1 ? 's' : ''}</span>
                        {hasActiveFilters && (
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                                {getFilterSummary}
                                <button
                                    style={{ marginLeft: "10px", fontSize: "11px", padding: "2px 6px", cursor: "pointer" }}
                                    onClick={onClearFilters}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {!isLoading && (
                            <>
                                <div>No Photo Found!</div>
                                {hasActiveFilters && (
                                    <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                                        {getFilterSummary}
                                        <button
                                            style={{ marginLeft: "10px", fontSize: "11px", padding: "2px 6px", cursor: "pointer" }}
                                            onClick={onClearFilters}
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Photo Grid */}
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
                        />
                    );
                })}

                {/* Infinite scroll completion indicator */}
                {displayedPhotos.length > 0 && (
                    <div className="infinite-scroll-complete"
                        style={{ textAlign: 'center', padding: '20px', width: '100%', gridColumn: '1 / -1', color: '#666' }}>
                        {isLimitedByConfig ? (
                            <div>
                                <div>Showing {displayedPhotos.length} photos (limited by configuration)</div>
                                <div style={{ fontSize: '12px', marginTop: '5px', color: '#999' }}>
                                    Display limit: {configLimit} photos. There may be more photos available.
                                </div>
                            </div>
                        ) : (
                            displayedPhotos.length < totalPhotosCount ? (
                                <div>
                                    <div>Scroll to load more photos</div>
                                    <div style={{ fontSize: '12px', marginTop: '5px', color: '#999' }}>
                                        Showing {displayedPhotos.length} of {totalPhotosCount} photos
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
