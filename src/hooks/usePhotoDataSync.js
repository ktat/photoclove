/**
 * usePhotoDataSync Hook
 *
 * Manages synchronization between photo data and display state.
 * Extracted from PhotosList.jsx to reduce component complexity.
 *
 * Responsibilities:
 * - Convert filtered photos to JSON format for PhotosListMini
 * - Sync filtered photos with displayed photos
 * - Handle infinite scroll photo count updates
 * - Update photos list when displayed photos change
 *
 * Phase 2: While PhotoDisplay is open (currentPhotoPath != null) the
 * filtered-to-mini sync is FROZEN. Edit helpers (setStarWithUpdate,
 * updatePhotoTags, etc.) write photosListMiniAllPhotos directly so
 * navigation indices stay stable. The effect re-runs on close
 * (currentPhotoPath -> null), which reconciles the mini list with the
 * latest filter/sort result.
 */

import { useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

/**
 * Syncs filtered photos to PhotosListMini format
 */
export function useFilteredPhotosSync({
    filteredPhotos,
    allPhotosForCurrentFetch,
    infiniteScrollEnabled,
    setPhotosListMiniAllPhotos,
    setDisplayedPhotoCount,
    currentPhotoPath
}) {
    useEffect(() => {
        if (currentPhotoPath) return; // Phase 2: freeze sync while PhotoDisplay is open
        if (filteredPhotos.length > 0 || allPhotosForCurrentFetch.length > 0) {
            // Convert Photo entities to JSON for PhotosListMini (with safety check)
            const photosAsJSON = filteredPhotos
                .filter(photo => photo && typeof photo.toJSON === 'function')
                .map(photo => photo.toJSON());

            logger.debug('usePhotoDataSync', 'photos_json_conversion', 'Converting photos to JSON', {
                totalPhotos: filteredPhotos.length,
                validPhotos: photosAsJSON.length,
                skippedPhotos: filteredPhotos.length - photosAsJSON.length,
                firstPhotoType: filteredPhotos.length > 0 ? filteredPhotos[0].constructor.name : 'none',
                hasToJSONMethod: filteredPhotos.length > 0 ? typeof filteredPhotos[0].toJSON : 'none'
            });

            setPhotosListMiniAllPhotos(photosAsJSON);

            // Reset display count for infinite scroll when filters change
            if (infiniteScrollEnabled) {
                setDisplayedPhotoCount(Math.min(50, filteredPhotos.length));
            }
        }
    }, [
        filteredPhotos,
        infiniteScrollEnabled,
        allPhotosForCurrentFetch,
        currentPhotoPath
        // Note: Intentionally excluding setter functions to prevent infinite loops
    ]);
}

/**
 * Syncs displayed photos to photos list state
 */
export function useDisplayedPhotosSync({
    displayedPhotos,
    setPhotosList
}) {
    useEffect(() => {
        if (displayedPhotos.length > 0) {
            setPhotosList({ photos: displayedPhotos, has_next: false, has_prev: false });
        }
    }, [displayedPhotos]);
}

/**
 * Combined hook for photo data synchronization
 */
export function usePhotoDataSync({
    filteredPhotos,
    displayedPhotos,
    allPhotosForCurrentFetch,
    infiniteScrollEnabled,
    setPhotosListMiniAllPhotos,
    setDisplayedPhotoCount,
    setPhotosList,
    currentPhotoPath
}) {
    useFilteredPhotosSync({
        filteredPhotos,
        allPhotosForCurrentFetch,
        infiniteScrollEnabled,
        setPhotosListMiniAllPhotos,
        setDisplayedPhotoCount,
        currentPhotoPath
    });

    useDisplayedPhotosSync({
        displayedPhotos,
        setPhotosList
    });
}

export default usePhotoDataSync;
