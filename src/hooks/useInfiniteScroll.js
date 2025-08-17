import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Custom hook for infinite scroll functionality
 * Extracted from PhotosList.jsx to reduce component complexity and improve reusability
 */
export function useInfiniteScroll(filteredPhotos, initialCount = 50, batchSize = 50) {
    const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(true);
    const [displayedPhotoCount, setDisplayedPhotoCount] = useState(initialCount);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Calculate displayed photos based on scroll state
    const displayedPhotos = useMemo(() => {
        if (infiniteScrollEnabled) {
            const result = filteredPhotos.slice(0, displayedPhotoCount);
            return result;
        }
        return filteredPhotos; // Infinite scroll disabled shows all
    }, [filteredPhotos, displayedPhotoCount, infiniteScrollEnabled]);

    // Load more photos function
    const loadMorePhotos = useCallback(() => {
        if (isLoadingMore) {
            return;
        }

        setIsLoadingMore(true);

        // Async batch addition to prevent UI blocking
        setTimeout(() => {
            setDisplayedPhotoCount(prev => {
                // Use already filtered photos instead of re-filtering
                const newCount = Math.min(prev + batchSize, filteredPhotos.length);
                return newCount >= filteredPhotos.length ? filteredPhotos.length : newCount;
            });
            setIsLoadingMore(false);
        }, 100);
    }, [isLoadingMore, filteredPhotos, batchSize]);

    // Handle scroll events
    const handleInfiniteScroll = useCallback((e) => {
        const scrollContainer = e.target;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

        // Trigger load when 80% scrolled
        if (scrollTop + clientHeight >= scrollHeight * 0.8) {
            loadMorePhotos();
        }
    }, [loadMorePhotos]);

    // Reset displayed count when filtered photos change
    useEffect(() => {
        if (infiniteScrollEnabled) {
            setDisplayedPhotoCount(Math.min(initialCount, filteredPhotos.length));
        }
    }, [filteredPhotos, infiniteScrollEnabled, initialCount]);

    // Calculate scroll status
    const hasMorePhotos = displayedPhotoCount < filteredPhotos.length;
    const allPhotosLoaded = displayedPhotoCount >= filteredPhotos.length;

    return {
        // State
        infiniteScrollEnabled,
        setInfiniteScrollEnabled,
        displayedPhotoCount,
        setDisplayedPhotoCount,
        isLoadingMore,
        setIsLoadingMore,
        
        // Computed values
        displayedPhotos,
        hasMorePhotos,
        allPhotosLoaded,
        
        // Functions
        loadMorePhotos,
        handleInfiniteScroll,
        
        // Status info
        totalPhotos: filteredPhotos.length,
        displayedCount: displayedPhotos.length
    };
}

export default useInfiniteScroll;