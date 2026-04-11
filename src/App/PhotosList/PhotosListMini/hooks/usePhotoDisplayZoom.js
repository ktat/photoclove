import { useState, useCallback, useEffect, useRef } from "react";

// Timing constants
const SCROLL_LOCK_DELAY_MS = 50;

/**
 * Hook for managing photo zoom and drag functionality in PhotoDisplay
 *
 * Zoom uses CSS transform: scale() applied directly to the DOM for immediate visual feedback.
 * This bypasses React's state update pipeline to avoid async rendering delays.
 */
export function usePhotoDisplayZoom({ photoZoom, setPhotoZoom }) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState({});
    const scrollLockRef = useRef(false);
    const zoomLevelRef = useRef(1); // 1 = 100%, 1.5 = 150%, etc.

    // Native non-passive wheel listener for Ctrl+Wheel zoom
    // Uses CSS transform: scale() for immediate visual feedback
    useEffect(() => {
        const handleWheel = (e) => {
            if (!e.ctrlKey) return;

            const wrapper = document.querySelector('#imageWrapper');
            if (!wrapper || !wrapper.contains(e.target)) return;

            e.preventDefault();
            e.stopPropagation();

            if (scrollLockRef.current) return;
            scrollLockRef.current = true;

            const imgTag = wrapper.querySelector('img');
            if (!imgTag) {
                scrollLockRef.current = false;
                return;
            }

            let currentScale = zoomLevelRef.current;

            // Dynamic zoom speed
            const baseStep = 0.1;
            const step = baseStep * Math.max(1, currentScale);

            let newScale;
            if (e.deltaY > 0) {
                // Zoom out
                newScale = Math.max(1, currentScale - step);
            } else {
                // Zoom in
                newScale = currentScale + step;
            }

            // Clamp
            newScale = Math.round(newScale * 100) / 100;
            if (newScale === currentScale) {
                scrollLockRef.current = false;
                return;
            }

            zoomLevelRef.current = newScale;

            // Calculate transform-origin relative to the image element
            const imgRect = imgTag.getBoundingClientRect();
            const originX = e.clientX - imgRect.left;
            const originY = e.clientY - imgRect.top;

            // Convert from screen coordinates to image percentage
            const originXPct = (originX / imgRect.width) * 100;
            const originYPct = (originY / imgRect.height) * 100;

            // Apply zoom directly via CSS transform (immediate, no React re-render needed)
            if (newScale <= 1) {
                // Reset to normal
                imgTag.style.transform = '';
                imgTag.style.transformOrigin = '';
                zoomLevelRef.current = 1;
                setPhotoZoom("auto");
            } else {
                imgTag.style.transformOrigin = `${originXPct}% ${originYPct}%`;
                imgTag.style.transform = `scale(${newScale})`;
                setPhotoZoom(Math.round(newScale * 100) + "%");
            }

            setTimeout(() => {
                scrollLockRef.current = false;
            }, SCROLL_LOCK_DELAY_MS);
        };

        document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
        return () => document.removeEventListener('wheel', handleWheel, { passive: false, capture: true });
    }, [setPhotoZoom]);

    // Reset zoom when photo changes (detected via photoZoom being set to "auto" externally)
    useEffect(() => {
        if (photoZoom === "auto") {
            zoomLevelRef.current = 1;
            const imgTag = document.querySelector('.photo img');
            if (imgTag) {
                imgTag.style.transform = '';
                imgTag.style.transformOrigin = '';
            }
        }
    }, [photoZoom]);

    // Start photo drag
    const dragPhotoStart = useCallback((e, setPhotoDisplayImgClass) => {
        setPhotoDisplayImgClass("photo_dragging");
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }, []);

    // Handle photo drag - pan the zoomed image by shifting transform-origin
    const dragPhoto = useCallback((e) => {
        if (dragPhotoInfo.is_dragging && zoomLevelRef.current > 1) {
            const imgTag = document.querySelector('.photo img');
            if (!imgTag) return;

            const dx = e.clientX - dragPhotoInfo.x;
            const dy = e.clientY - dragPhotoInfo.y;

            // Get current transform-origin
            const origin = imgTag.style.transformOrigin;
            const match = origin.match(/([\d.]+)%\s+([\d.]+)%/);
            if (match) {
                const imgRect = imgTag.getBoundingClientRect();
                const scale = zoomLevelRef.current;

                // Convert pixel drag to percentage shift (inverted: drag right = origin moves left)
                const pctX = (dx / imgRect.width) * 100 / scale;
                const pctY = (dy / imgRect.height) * 100 / scale;

                let newOriginX = parseFloat(match[1]) - pctX;
                let newOriginY = parseFloat(match[2]) - pctY;

                // Clamp to 0-100%
                newOriginX = Math.max(0, Math.min(100, newOriginX));
                newOriginY = Math.max(0, Math.min(100, newOriginY));

                imgTag.style.transformOrigin = `${newOriginX}% ${newOriginY}%`;
            }

            setDragPhotoInfo(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
        } else if (dragPhotoInfo.is_dragging) {
            // Normal drag (no zoom) - scroll the wrapper
            let x = e.clientX - dragPhotoInfo.x;
            let y = e.clientY - dragPhotoInfo.y;
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

    return {
        dragPhotoInfo,
        dragPhotoStart,
        dragPhoto,
        dragPhotoEnd,
    };
}
