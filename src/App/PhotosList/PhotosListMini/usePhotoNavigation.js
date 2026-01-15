/**
 * Custom hook for photo navigation in PhotosListMini
 * Handles next/previous photo navigation and thumbnail window shifting
 */
import { useCallback, useRef } from 'react';
import { convertFileSrc } from "@tauri-apps/api/core";
import { calculateSimpleThumbnailDisplay, calculateThumbnailDisplayWithViewOffset } from "./photoUtils.js";

/**
 * Hook for managing photo navigation
 * @param {Object} options
 * @param {Array} options.photos - Array of Photo entities
 * @param {number} options.currentIndex - Current photo index
 * @param {Function} options.setCurrentIndex - Set current photo index
 * @param {Function} options.setCurrentPhotoPath - Set current photo path
 * @param {Function} options.setImgStyle - Set image style
 * @param {Array} options.currentPhotoSize - Current photo dimensions [width, height]
 * @param {Object} options.datePage - Date page mapping
 * @param {Function} options.getDateKey - Get current date key
 * @param {number} options.num - Number of photos per page
 * @param {Object} options.imgCacheMap - Image cache map
 * @param {Function} options.setImgCacheMap - Set image cache map
 * @param {number|null} options.viewStartIndex - Current view window start index
 * @param {Function} options.setViewStartIndex - Set view window start index
 * @param {Function} options.beforeNavigate - Optional callback before navigation, returns false to cancel
 * @returns {Object} Navigation functions and state
 */
export function usePhotoNavigation({
    photos,
    currentIndex,
    setCurrentIndex,
    setCurrentPhotoPath,
    setImgStyle,
    currentPhotoSize,
    datePage,
    getDateKey,
    num,
    imgCacheMap,
    setImgCacheMap,
    viewStartIndex,
    setViewStartIndex,
    beforeNavigate
}) {
    const navigateLock = useRef(false);

    /**
     * Lock navigation to prevent rapid-fire navigation
     * @param {Function} fn - Navigation function to execute
     */
    const lockNavigate = useCallback((fn) => {
        if (navigateLock.current) return;
        navigateLock.current = true;
        fn();
        setTimeout(() => {
            navigateLock.current = false;
        }, 100);
    }, []);

    /**
     * Set image cache for nearby photos
     * @param {number} index - Current photo index
     * @param {number} direction - Navigation direction (-1: backward, 0: neutral, 1: forward)
     */
    const setImageCache = useCallback(async (index, direction) => {
        let minIndex = index - (direction === -1 ? 4 : 2);
        let maxIndex = index + (direction === 1 ? 4 : 2);
        const cacheCandidates = [];
        const thisTimeCacheMap = {};

        if (minIndex < 0) minIndex = 0;
        if (maxIndex >= photos.length) maxIndex = photos.length - 1;

        for (let j = minIndex; j <= maxIndex; j++) {
            if (!photos[j] || !photos[j].originalPath?.match(/\.jpe?g/i)) {
                continue;
            }
            const f = photos[j].originalPath;
            thisTimeCacheMap[f] = true;
            if (!imgCacheMap[f]) {
                cacheCandidates.push(j);
            }
        }

        for (let j = 0; j < cacheCandidates.length; j++) {
            const photoIndex = cacheCandidates[j];
            const photo = photos[photoIndex];
            const f = photo.originalPath;
            const displayPath = photo.displayPath();
            const response = await fetch(convertFileSrc(displayPath), { cache: "force-cache" });
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);
            imgCacheMap[f] = [objectURL];
            setImgCacheMap(imgCacheMap);
        }

        const keys = Object.keys(imgCacheMap);
        keys.forEach((v) => {
            if (!thisTimeCacheMap[v]) {
                delete imgCacheMap[v];
            }
        });
        setImgCacheMap(imgCacheMap);
    }, [photos, imgCacheMap, setImgCacheMap]);

    /**
     * Internal function to navigate to next or previous photo
     * @param {number} index - Target photo index
     */
    const navigateToPhoto = useCallback((index) => {
        const currentW = currentPhotoSize[0];
        const currentH = currentPhotoSize[1];

        if (currentW && currentH) {
            setImgStyle(prev => ({ ...prev, opacity: 0 }));
        } else {
            setImgStyle(prev => ({ ...prev, opacity: 0 }));
        }

        if (photos[index]) {
            setCurrentPhotoPath(photos[index].originalPath);
            if (datePage && getDateKey) {
                datePage[getDateKey()] = Math.trunc(index / num) + 1;
            }
            setCurrentIndex(index);
        }
    }, [photos, currentPhotoSize, setImgStyle, setCurrentPhotoPath, datePage, getDateKey, num, setCurrentIndex]);

    /**
     * Navigate to next photo
     */
    const nextPhoto = useCallback(async () => {
        // Check beforeNavigate callback (may return Promise)
        if (beforeNavigate) {
            const canNavigate = await beforeNavigate();
            if (!canNavigate) {
                return;
            }
        }
        const nextIndex = currentIndex + 1;
        if (nextIndex < photos.length) {
            navigateToPhoto(nextIndex);
            setImageCache(nextIndex, 1);
        }
    }, [currentIndex, photos.length, navigateToPhoto, setImageCache, beforeNavigate]);

    /**
     * Navigate to previous photo
     */
    const prevPhoto = useCallback(async () => {
        // Check beforeNavigate callback (may return Promise)
        if (beforeNavigate) {
            const canNavigate = await beforeNavigate();
            if (!canNavigate) {
                return;
            }
        }
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
            navigateToPhoto(prevIndex);
            setImageCache(prevIndex, -1);
        }
    }, [currentIndex, navigateToPhoto, setImageCache, beforeNavigate]);

    /**
     * Shift thumbnail window backward (does not change selected photo)
     */
    const backwardPhotos = useCallback(() => {
        const { showPrev, startIndex } = calculateThumbnailDisplayWithViewOffset(photos, currentIndex, viewStartIndex);
        if (!showPrev) return;

        // Only shift the view window, do not change selected photo
        const newViewStartIndex = Math.max(0, startIndex - 1);
        setViewStartIndex(newViewStartIndex);
    }, [photos, currentIndex, viewStartIndex, setViewStartIndex]);

    /**
     * Shift thumbnail window forward (does not change selected photo)
     */
    const forwardPhotos = useCallback(() => {
        const NUM_OF_PHOTO_LIST = 9;
        const { showNext, startIndex } = calculateThumbnailDisplayWithViewOffset(photos, currentIndex, viewStartIndex);
        if (!showNext) return;

        // Only shift the view window, do not change selected photo
        const maxStartIndex = Math.max(0, photos.length - NUM_OF_PHOTO_LIST);
        const newViewStartIndex = Math.min(maxStartIndex, startIndex + 1);
        setViewStartIndex(newViewStartIndex);
    }, [photos, currentIndex, viewStartIndex, setViewStartIndex]);

    /**
     * Navigate directly to a specific photo
     * @param {number} index - Target photo index
     */
    const goToPhoto = useCallback(async (index) => {
        // Check beforeNavigate callback (may return Promise)
        if (beforeNavigate) {
            const canNavigate = await beforeNavigate();
            if (!canNavigate) {
                return;
            }
        }
        if (index >= 0 && index < photos.length && photos[index]) {
            setCurrentIndex(index);
            setCurrentPhotoPath(photos[index].originalPath);
            if (datePage && getDateKey) {
                datePage[getDateKey()] = Math.trunc(index / num) + 1;
            }
            setImageCache(index, 0);
            // Reset view offset to auto-center on selected photo
            setViewStartIndex(null);
        }
    }, [photos, setCurrentIndex, setCurrentPhotoPath, datePage, getDateKey, num, setImageCache, setViewStartIndex, beforeNavigate]);

    return {
        nextPhoto,
        prevPhoto,
        backwardPhotos,
        forwardPhotos,
        goToPhoto,
        setImageCache,
        lockNavigate,
        hasNext: currentIndex < photos.length - 1,
        hasPrevious: currentIndex > 0
    };
}

export default usePhotoNavigation;
