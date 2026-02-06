import { useState, useCallback } from "react";

// Timing constants
const SCROLL_LOCK_DELAY_MS = 100;

/**
 * Hook for managing photo zoom and drag functionality in PhotoDisplay
 */
export function usePhotoDisplayZoom({ photoZoom, setPhotoZoom, photoZoomReady, SetImgStyle, setDisplayedImageSize }) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
    const [scrollLock, setScrollLock] = useState(false);

    // Start photo drag
    const dragPhotoStart = useCallback((e, setPhotoDisplayImgClass) => {
        setPhotoDisplayImgClass("photo_dragging");
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }, []);

    // Handle photo drag
    const dragPhoto = useCallback((e) => {
        if (dragPhotoInfo.is_dragging) {
            let x = e.clientX - dragPhotoInfo.x;
            let y = e.clientY - dragPhotoInfo.y;
            // Use the wrapper div as the scrollable container
            let display = document.querySelector('#imageWrapper') || e.currentTarget.parentElement;
            display.scrollTop -= y / 20;
            display.scrollLeft -= x / 20;
        }
    }, [dragPhotoInfo]);

    // End photo drag
    const dragPhotoEnd = useCallback((setPhotoDisplayImgClass) => {
        setPhotoDisplayImgClass("");
        setDragPhotoInfo({});
    }, []);

    // Handle photo scroll/zoom
    const photoScroll = useCallback((e) => {
        if (scrollLock || !photoZoomReady) {
            return;
        }

        setScrollLock(true);
        let zoom = photoZoom === "auto" ? 100 : parseInt(photoZoom.replace("%", ""));

        const imgTag = document.querySelector(".photo img");
        const wrapperDiv = document.querySelector('#imageWrapper');

        if (!imgTag || !wrapperDiv) {
            setScrollLock(false);
            return;
        }

        // Get current zoom scale before update
        const currentZoom = zoom;

        // Calculate dynamic zoom speed based on current zoom level
        // Base speed increases with zoom level for more natural feel
        const baseSpeed = 10;
        const zoomFactor = Math.max(1, currentZoom / 100);
        const zoomSpeed = Math.round(baseSpeed * zoomFactor);

        // Update zoom level with dynamic speed
        if (e.deltaY > 0) {
            zoom -= zoomSpeed;
            if (zoom <= 100) {
                zoom = 100;
            }
        } else if (e.deltaY < 0) {
            zoom += zoomSpeed;
        }

        // If zoom hasn't changed, return
        if (zoom === currentZoom) {
            setScrollLock(false);
            return;
        }

        setPhotoZoom(zoom + "%");

        // Get wrapper base dimensions (100% size)
        const wrapperWidth = parseFloat(wrapperDiv.style.width);
        const wrapperHeight = parseFloat(wrapperDiv.style.height);

        // Calculate old and new dimensions
        const oldScale = currentZoom / 100;
        const newScale = zoom / 100;

        const oldWidth = wrapperWidth * oldScale;
        const oldHeight = wrapperHeight * oldScale;
        const newWidth = wrapperWidth * newScale;
        const newHeight = wrapperHeight * newScale;

        // Get mouse position relative to image
        const rect = imgTag.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate position ratios
        const xRatio = x / oldWidth;
        const yRatio = y / oldHeight;

        // Apply new size
        SetImgStyle({
            width: newWidth + 'px',
            height: newHeight + 'px',
            opacity: '100%'
        });

        // Update displayed image size for face bounding box overlay
        setDisplayedImageSize({ width: newWidth, height: newHeight });

        // Calculate scroll to keep mouse point stable
        setTimeout(() => {
            const newX = newWidth * xRatio;
            const newY = newHeight * yRatio;

            const deltaX = newX - x;
            const deltaY = newY - y;

            wrapperDiv.scrollLeft += deltaX;
            wrapperDiv.scrollTop += deltaY;
        }, 0);

        setTimeout(() => { setScrollLock(false) }, SCROLL_LOCK_DELAY_MS);
        window.onscroll = function () { };
    }, [scrollLock, photoZoom, photoZoomReady, setPhotoZoom, SetImgStyle, setDisplayedImageSize]);

    return {
        dragPhotoInfo,
        dragPhotoStart,
        dragPhoto,
        dragPhotoEnd,
        photoScroll
    };
}
