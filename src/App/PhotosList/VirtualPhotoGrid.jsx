import React, { useMemo, useRef, useEffect, useState, memo, useCallback } from 'react';
import { Grid } from 'react-window';
import PhotoCard from "./PhotoCard.jsx";
import { Photo } from "../../domain/Photo.js";
import { useOverlayMargin } from "../../hooks/useOverlayMargin.js";
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
    onOpenBurstGroup,
    isInBurstGroupMode,
    burstModeEnabled,
    setShowSideMenu,
    importState,
    thumbnailOrientationCorrection
}) {
    const index = rowIndex * columnCount + columnIndex;
    const photoData = photos[index];

    // Convert JSON to Photo entity if needed (for methods like thumbnailPath, displayPath)
    // This is important for trash photos which need displayPath() to get trash-relative path
    const photo = useMemo(() => {
        // Return null if index exceeds photo count or no photoData
        if (index >= photos.length || !photoData) {
            return null;
        }
        // If already a Photo instance (has displayPath method), use as is
        if (typeof photoData.displayPath === 'function') {
            return photoData;
        }
        // Convert JSON to Photo entity
        if (photoData.originalPath) {
            return Photo.fromJSON(photoData);
        }
        return photoData;
    }, [index, photos.length, photoData]);

    // Return empty cell if index exceeds photo count
    if (index >= photos.length) {
        return <div style={style} />;
    }

    if (!photo) {
        return <div style={style} />;
    }

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
                onOpenBurstGroup={onOpenBurstGroup}
                isInBurstGroupMode={isInBurstGroupMode}
                burstModeEnabled={burstModeEnabled}
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
    iconSize,
    photoSelectionDict,
    onAddSelection,
    onDisplayPhoto,
    onOpenBurstGroup,
    isInBurstGroupMode = false,
    burstModeEnabled = false,
    setShowSideMenu,
    showSideMenu,
    importState,
    thumbnailOrientationCorrection = false,
    containerRef: _containerRef
}) {
    const gridRef = useRef(null);
    const localContainerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
    const [shadow, setShadow] = useState({ top: false, bottom: true });
    const overlayMargin = useOverlayMargin();
    const [gridTheme, setGridTheme] = useState(() =>
        document.documentElement.getAttribute('data-grid-theme') || 'default'
    );

    // Listen for theme changes via MutationObserver
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'data-grid-theme') {
                    const newTheme = document.documentElement.getAttribute('data-grid-theme') || 'default';
                    setGridTheme(newTheme);
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

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

    // Calculate extra space needed for each theme beyond base iconSize
    // Each theme has different margin, padding, border requirements
    // Values calibrated from actual rendering (default 61px confirmed working)
    const themeExtraSpace = useMemo(() => {
        switch (gridTheme) {
            case 'slide-mount':
            case 'slide-35mm':
                // Similar to default but with larger margins/padding
                return { width: 61, height: 48 };
            case 'lightbox':
                // Similar to default
                return { width: 61, height: 16 };
            case 'filmstrip':
                // No margin, minimal padding - should be smaller than default
                return { width: 40, height: 24 };
            default:
                return { width: 61, height: 0 };
        }
    }, [gridTheme]);

    const cellWidth = iconSize + themeExtraSpace.width;
    const cellHeight = iconSize + 60 + themeExtraSpace.height;

    // Calculate column count based on container width
    const columnCount = useMemo(() => {
        const availableWidth = containerSize.width - 20; // Account for padding
        return Math.max(1, Math.floor(availableWidth / cellWidth));
    }, [containerSize.width, cellWidth]);

    // Calculate row count
    const rowCount = useMemo(() => {
        return Math.ceil(displayedPhotos.length / columnCount);
    }, [displayedPhotos.length, columnCount]);

    // Update container size on mount, resize, and side menu toggle
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

            // Measure actual widths of left and right columns from DOM
            const leftMenu = document.getElementById('leftMenu');
            const rightMenu = document.querySelector('.rightMenu');
            const verticalTabBar = document.querySelector('.directory-vertical-tabs');
            const photoOptionTabs = document.querySelector('[class*="vertical-tabs"]'); // PhotoOption tabs

            // Get actual left menu width
            // On narrow screens (< 1000px), when left menu is expanded it becomes position: absolute (overlay mode)
            // In overlay mode, marginLeft is handled by useOverlayMargin hook
            let leftMenuWidth = 0;
            if (leftMenu) {
                const isNarrowScreen = window.innerWidth < 1000;
                const isCollapsed = leftMenu.classList.contains('collapsed');
                // On narrow screens, expanded left menu (not collapsed) is in overlay mode
                const isOverlay = isNarrowScreen && !isCollapsed;
                if (isOverlay) {
                    // In overlay mode, don't subtract left menu width (margin handles positioning)
                    leftMenuWidth = 0;
                } else {
                    const leftRect = leftMenu.getBoundingClientRect();
                    leftMenuWidth = leftRect.width;
                }
            }

            // Get actual right side width (rightMenu content + tab bar)
            let rightSideWidth = 0;
            if (rightMenu) {
                const rightRect = rightMenu.getBoundingClientRect();
                rightSideWidth = rightRect.width;
            }
            // Add vertical tab bar width if it exists and is separate from rightMenu
            if (verticalTabBar && !rightMenu) {
                const tabBarRect = verticalTabBar.getBoundingClientRect();
                rightSideWidth = tabBarRect.width;
            }
            // Check for PhotoOption vertical tabs (in PhotoViewer mode)
            if (photoOptionTabs && !rightMenu && !verticalTabBar) {
                const photoOptionRect = photoOptionTabs.getBoundingClientRect();
                rightSideWidth = Math.max(rightSideWidth, photoOptionRect.width);
            }

            const padding = 40; // Account for padding and margins
            let availableWidth = window.innerWidth - leftMenuWidth - rightSideWidth - padding;

            setContainerSize({
                width: Math.max(400, availableWidth),
                height: Math.max(400, availableHeight)
            });
        };

        // Initial size calculation with delay to allow DOM to render
        const timeoutId = setTimeout(updateSize, 150);

        window.addEventListener('resize', updateSize);

        // Watch for class changes on inner-container (left menu collapse state)
        const innerContainer = document.querySelector('.inner-container');
        const leftMenu = document.getElementById('leftMenu');
        let observers = [];

        if (innerContainer) {
            const innerObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.attributeName === 'class') {
                        // Delay to allow CSS transition to complete
                        setTimeout(updateSize, 350);
                    }
                }
            });
            innerObserver.observe(innerContainer, { attributes: true });
            observers.push(innerObserver);
        }

        // Also watch left menu for size/style changes (only on wide screens)
        // On narrow screens, overlay margin is handled by useOverlayMargin hook
        if (leftMenu) {
            const leftMenuObserver = new MutationObserver(() => {
                // Only recalculate grid size on wide screens
                if (window.innerWidth >= 1000) {
                    setTimeout(updateSize, 350);
                }
            });
            leftMenuObserver.observe(leftMenu, { attributes: true, attributeFilter: ['class', 'style'] });
            observers.push(leftMenuObserver);
        }

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updateSize);
            observers.forEach(obs => obs.disconnect());
        };
    }, [showSideMenu]); // Re-run when side menu toggles

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
        onOpenBurstGroup,
        isInBurstGroupMode,
        burstModeEnabled,
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
        onOpenBurstGroup,
        isInBurstGroupMode,
        burstModeEnabled,
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
                overflow: 'hidden',
                marginLeft: overlayMargin > 0 ? `${overlayMargin}px` : undefined
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

        </div>
    );
}

export default VirtualPhotoGrid;
