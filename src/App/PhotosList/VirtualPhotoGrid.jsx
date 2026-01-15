import React, { useMemo, useRef, useEffect, useState, memo, useCallback } from 'react';
import { Grid } from 'react-window';
import PhotoCard from "./PhotoCard.jsx";
import styles from './PhotoGrid.module.css';

/**
 * Cell component for react-window Grid
 * Receives index via row/column and data via cellProps
 */
const PhotoCell = memo(function PhotoCell({
    rowIndex,
    columnIndex,
    style,
    // Props passed via cellProps
    photos,
    columnCount,
    iconSize,
    photoSelectionDict,
    onAddSelection,
    onDisplayPhoto,
    setShowSideMenu,
    importState,
    thumbnailOrientationCorrection
}) {
    const index = rowIndex * columnCount + columnIndex;

    // Return empty cell if index exceeds photo count
    if (index >= photos.length) {
        return <div style={style} />;
    }

    const photo = photos[index];
    const tagCount = photo.getTags ? photo.getTags().length : (photo.tags?.length || 0);
    const photoKey = `${photo.originalPath}_${tagCount}`;

    return (
        <div style={style}>
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
        </div>
    );
});

/**
 * VirtualPhotoGrid Component
 * Renders a virtualized grid of photo thumbnails using react-window
 * Only renders photos that are visible in the viewport + buffer
 *
 * Performance benefits:
 * - Constant DOM size regardless of total photos
 * - Smooth scrolling even with 10,000+ photos
 * - Lower memory usage
 */
function VirtualPhotoGrid({
    displayedPhotos,
    totalPhotosCount,
    iconSize,
    photoSelectionDict,
    onAddSelection,
    onDisplayPhoto,
    setShowSideMenu,
    importState,
    thumbnailOrientationCorrection = false,
    containerRef,
    isLimitedByConfig,
    configLimit
}) {
    const gridRef = useRef(null);
    const localContainerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
    const [shadow, setShadow] = useState({ top: false, bottom: true });

    // Update shadow state based on scroll position
    const updateShadow = useCallback(() => {
        const gridElement = localContainerRef.current?.querySelector('[class*="virtualGrid"]');
        if (!gridElement) return;

        const { scrollTop, scrollHeight, clientHeight } = gridElement;
        setShadow({
            top: scrollTop > 0,
            bottom: scrollTop + clientHeight < scrollHeight - 10
        });
    }, []);

    // Calculate cell dimensions based on iconSize
    // Each cell includes the photo + padding/margins
    const cellWidth = iconSize + 41; // Match the flex basis calculation from PhotoCard
    const cellHeight = iconSize + 60; // Height including metadata overlay and menu

    // Calculate column count based on container width
    const columnCount = useMemo(() => {
        const availableWidth = containerSize.width - 20; // Account for padding
        return Math.max(1, Math.floor(availableWidth / cellWidth));
    }, [containerSize.width, cellWidth]);

    // Calculate row count
    const rowCount = useMemo(() => {
        return Math.ceil(displayedPhotos.length / columnCount);
    }, [displayedPhotos.length, columnCount]);

    // Update container size on mount and resize
    useEffect(() => {
        const updateSize = () => {
            // Calculate available space based on viewport and UI elements
            // Find the photo-list-header element to get its bottom position
            const photoListHeader = document.querySelector('.photo-list-header');
            const footer = document.querySelector('footer');

            let topOffset = 150; // Default offset from top (header + toolbar)
            let bottomOffset = 50; // Default offset from bottom (footer + padding)

            if (photoListHeader) {
                const headerRect = photoListHeader.getBoundingClientRect();
                topOffset = headerRect.bottom;
            }

            if (footer) {
                const footerRect = footer.getBoundingClientRect();
                bottomOffset = window.innerHeight - footerRect.top + 10;
            }

            // Calculate available height
            const availableHeight = window.innerHeight - topOffset - bottomOffset;

            // Calculate width based on container parent or viewport
            let availableWidth = window.innerWidth - 300; // Default: minus left menu

            if (localContainerRef?.current?.parentElement) {
                const parentRect = localContainerRef.current.parentElement.getBoundingClientRect();
                if (parentRect.width > 0) {
                    availableWidth = parentRect.width - 20; // Account for padding
                }
            }

            setContainerSize({
                width: Math.max(400, availableWidth),
                height: Math.max(400, availableHeight)
            });
        };

        // Initial size calculation with delay to allow DOM to render
        const timeoutId = setTimeout(updateSize, 150);

        window.addEventListener('resize', updateSize);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updateSize);
        };
    }, []);

    // Attach scroll listener for shadow effects
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const gridElement = localContainerRef.current?.querySelector('[class*="virtualGrid"]');
            if (gridElement) {
                gridElement.addEventListener('scroll', updateShadow, { passive: true });
                updateShadow(); // Initial check
            }
        }, 200);

        return () => {
            clearTimeout(timeoutId);
            const gridElement = localContainerRef.current?.querySelector('[class*="virtualGrid"]');
            if (gridElement) {
                gridElement.removeEventListener('scroll', updateShadow);
            }
        };
    }, [updateShadow, containerSize]);

    // Cell props to pass to PhotoCell component
    const cellProps = useMemo(() => ({
        photos: displayedPhotos,
        columnCount,
        iconSize,
        photoSelectionDict,
        onAddSelection,
        onDisplayPhoto,
        setShowSideMenu,
        importState,
        thumbnailOrientationCorrection
    }), [
        displayedPhotos,
        columnCount,
        iconSize,
        photoSelectionDict,
        onAddSelection,
        onDisplayPhoto,
        setShowSideMenu,
        importState,
        thumbnailOrientationCorrection
    ]);

    return (
        <div
            ref={localContainerRef}
            className={`${styles.virtualGridContainer} scroll-wrapper`}
            style={{
                width: '100%',
                height: `${containerSize.height}px`,
                overflow: 'hidden'
            }}
        >
            {/* Fade effects for scroll indication */}
            {shadow.top && <div className="fade fade-top" />}
            {shadow.bottom && <div className="fade fade-bottom" />}

            <Grid
                ref={gridRef}
                className={styles.virtualGrid}
                cellComponent={PhotoCell}
                cellProps={cellProps}
                columnCount={columnCount}
                columnWidth={cellWidth}
                rowCount={rowCount}
                rowHeight={cellHeight}
                defaultWidth={containerSize.width}
                defaultHeight={containerSize.height}
                overscanCount={2}
                style={{ overflow: 'auto' }}
            />

            {/* Status indicator */}
            <div className={styles.virtualGridStatus}>
                {isLimitedByConfig ? (
                    <span>Showing {displayedPhotos.length} photos (limited to {configLimit})</span>
                ) : (
                    <span>Showing {displayedPhotos.length} of {totalPhotosCount} photos</span>
                )}
            </div>
        </div>
    );
}

export default VirtualPhotoGrid;
