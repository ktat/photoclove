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
    setDisplayedPhotoCount
}) {
    useEffect(() => {
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
    }, [
        filteredPhotos,
        infiniteScrollEnabled,
        allPhotosForCurrentFetch
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
    setPhotosList
}) {
    // Sync filtered photos to JSON format
    useFilteredPhotosSync({
        filteredPhotos,
        allPhotosForCurrentFetch,
        infiniteScrollEnabled,
        setPhotosListMiniAllPhotos,
        setDisplayedPhotoCount
    });

    // Sync displayed photos to photos list
    useDisplayedPhotosSync({
        displayedPhotos,
        setPhotosList
    });
}

export default usePhotoDataSync;
