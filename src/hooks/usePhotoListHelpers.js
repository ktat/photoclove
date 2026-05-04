/**
 * usePhotoListHelpers Hook
 *
 * Provides helper functions for photo list operations including:
 * - Star rating updates
 * - Comment updates
 * - Photo selection
 * - Album management
 *
 * Extracted from PhotosList.jsx to reduce file size and improve maintainability.
 */

import { useCallback } from 'react';
import { VIEW_MODES } from '../constants/viewModes.js';
import { logger } from '../services/LoggerService.js';
import { isStarSort, getPhotoSortComparator, findInsertIndex } from '../utils/PhotoSort.js';

/**
 * Custom hook for photo list helper functions
 *
 * @param {Object} params
 * @param {Function} params.setStar - Set star rating state
 * @param {Array} params.photosListMiniAllPhotos - All photos for mini display
 * @param {Function} params.setPhotosListMiniAllPhotos - Update mini photos
 * @param {Photo|null} params.currentPhoto - Current photo entity
 * @param {Array} params.allPhotosForCurrentFetch - All current photos
 * @param {Function} params.setAllPhotosForCurrentFetch - Update all photos
 * @param {string} params.viewMode - Current view mode
 * @param {Function} params.loadAlbums - Load albums function
 * @param {string} params.currentAlbumId - Current album ID
 * @param {Function} params.loadAlbumPhotos - Load album photos function
 * @param {Object} params.photoSelectionDict - Photo selection dictionary
 * @param {Function} params.togglePhotoSelection - Toggle photo selection
 * @param {Function} params.changeTab - Change tab function
 * @param {boolean} params.infiniteScrollEnabled - Infinite scroll enabled
 * @param {Array} params.displayedPhotos - Displayed photos
 * @param {Array} params.filteredPhotos - Filtered photos
 * @param {Function} params.selectAllPhotos - Select all photos function
 * @returns {Object} Helper functions
 */
export function usePhotoListHelpers({
    setStar,
    photosListMiniAllPhotos,
    setPhotosListMiniAllPhotos,
    currentPhoto,
    allPhotosForCurrentFetch,
    setAllPhotosForCurrentFetch,
    viewMode,
    loadAlbums,
    currentAlbumId,
    loadAlbumPhotos,
    photoSelectionDict,
    togglePhotoSelection,
    changeTab,
    infiniteScrollEnabled,
    displayedPhotos,
    filteredPhotos,
    selectAllPhotos,
    tabClass,
    photosCache,
    currentViewKey,
    sortOfPhotos,
    setSortDirty,
    photosListMiniCurrentIndex,
    setPhotosListMiniCurrentIndex,
    currentPhotoIndex,
    setCurrentPhotoIndex,
    displayedPhotoCount,
    setDisplayedPhotoCount,
    sortDirty
}) {
    // Patch the View Cache entry for the current view so that switching
    // away and back doesn't restore stale (pre-edit) photos. Phase 1
    // introduced the cache; without this, edits become invisible after a
    // round-trip through another view.
    const patchCacheCurrentView = useCallback((updater) => {
        if (!photosCache?.patch || !currentViewKey) return;
        photosCache.patch(currentViewKey, updater);
    }, [photosCache, currentViewKey]);
    /**
     * Enhanced setStar function that updates photosListMiniAllPhotos
     * @param {Array} newStar - New star rating array
     */
    const setStarWithUpdate = useCallback((newStar) => {
        setStar(newStar);

        // Calculate star value from array
        let starValue = 0;
        for (let i = 0; i < 5; i++) {
            if (newStar[i]) {
                starValue = i + 1;
            } else {
                break;
            }
        }

        // Update the star value in photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === currentPhoto?.originalPath) {
                return { ...photoJSON, star: starValue };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === currentPhoto?.originalPath) {
                return { ...photo, star: starValue };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);

        // Keep the View Cache for this view in sync so a future switch
        // back doesn't restore the pre-edit star value.
        patchCacheCurrentView(prev => prev.map(photo => {
            if (photo.originalPath === currentPhoto?.originalPath) {
                return { ...photo, star: starValue };
            }
            return photo;
        }));

        // Phase 2: if current sort is star-based the on-screen order is now
        // stale. closePhotoDisplay will apply a local re-sort.
        if (isStarSort(sortOfPhotos) && setSortDirty) {
            setSortDirty(true);
        }
    }, [setStar, photosListMiniAllPhotos, setPhotosListMiniAllPhotos, currentPhoto, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch, patchCacheCurrentView, sortOfPhotos, setSortDirty]);

    /**
     * Update comment in photo lists
     * @param {string} photoPath - Photo path
     * @param {boolean} hasComment - Whether photo has comment
     */
    const updatePhotoComment = useCallback((photoPath, hasComment) => {
        // Update photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === photoPath) {
                return { ...photoJSON, comment: hasComment ? "has comment" : null };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === photoPath) {
                return { ...photo, comment: hasComment ? "has comment" : null };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);

        // Keep the View Cache for this view in sync.
        patchCacheCurrentView(prev => prev.map(photo => {
            if (photo.originalPath === photoPath) {
                return { ...photo, comment: hasComment ? "has comment" : null };
            }
            return photo;
        }));
    }, [photosListMiniAllPhotos, setPhotosListMiniAllPhotos, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch, patchCacheCurrentView]);

    /**
     * Update tags for a photo in both the grid (allPhotosForCurrentFetch),
     * the navigation strip (photosListMiniAllPhotos), and the View Cache.
     *
     * Tag arrays don't change array length or sort order, so navigation
     * indices stay valid. The hasTagFilter filter (in useFilteredPhotos)
     * will exclude/include the photo automatically post-close.
     *
     * @param {string} photoPath
     * @param {Array<{id, name, color}>} tagsArray
     */
    const updatePhotoTags = useCallback((photoPath, tagsArray) => {
        const updatedPhotos = photosListMiniAllPhotos.map(photoJSON => {
            if (photoJSON.originalPath === photoPath) {
                return { ...photoJSON, tags: tagsArray };
            }
            return photoJSON;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);

        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.originalPath === photoPath) {
                return { ...photo, tags: tagsArray };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);

        patchCacheCurrentView(prev => prev.map(photo => {
            if (photo.originalPath === photoPath) {
                return { ...photo, tags: tagsArray };
            }
            return photo;
        }));
    }, [photosListMiniAllPhotos, setPhotosListMiniAllPhotos, allPhotosForCurrentFetch, setAllPhotosForCurrentFetch, patchCacheCurrentView]);

    /**
     * Update album membership for a photo. albumIds is the FULL new list
     * of album IDs the photo belongs to. inAlbum is a derived "membership
     * in any album" boolean used by some filters / UI badges.
     *
     * Note: Photo entity currently models a single albumId (string|null).
     * For multi-album membership the helper takes the first id; if the
     * Photo entity is later extended to multi-album the helper should be
     * updated accordingly.
     *
     * @param {string} photoPath
     * @param {string[]} albumIds
     */
    const updatePhotoAlbums = useCallback((photoPath, albumIds) => {
        const inAlbum = albumIds.length > 0;
        const apply = (photo) => photo.originalPath === photoPath
            ? { ...photo, albumId: albumIds[0] ?? null, inAlbum }
            : photo;

        setPhotosListMiniAllPhotos(prev => prev.map(apply));
        setAllPhotosForCurrentFetch(prev => prev.map(apply));
        patchCacheCurrentView(prev => prev.map(apply));
    }, [setPhotosListMiniAllPhotos, setAllPhotosForCurrentFetch, patchCacheCurrentView]);

    /**
     * Update cssStyle (saved CSS transform/filter/clip-path) for a photo.
     * Persists to backend separately (save_css_style); this helper only
     * updates in-memory state so the grid reflects the change on close
     * without a refetch.
     *
     * Sets BOTH css_style (snake_case, used in JSON-shape arrays like
     * photosListMiniAllPhotos) and cssStyle (camelCase, used by Photo
     * entity internals via convertJSONToPhotoEntities).
     *
     * Backend regenerates the thumbnail asynchronously. Grid display
     * reads cssStyle live from in-memory data so the visual update
     * lands immediately on close.
     *
     * @param {string} photoPath
     * @param {string} css
     */
    const updatePhotoCssStyle = useCallback((photoPath, css) => {
        const apply = (photo) => photo.originalPath === photoPath
            ? { ...photo, css_style: css, cssStyle: css }
            : photo;

        setPhotosListMiniAllPhotos(prev => prev.map(apply));
        setAllPhotosForCurrentFetch(prev => prev.map(apply));
        patchCacheCurrentView(prev => prev.map(apply));
    }, [setPhotosListMiniAllPhotos, setAllPhotosForCurrentFetch, patchCacheCurrentView]);

    /**
     * Insert a newly created photo (Save as Copy result) into both the
     * grid (allPhotosForCurrentFetch) and the navigation strip
     * (photosListMiniAllPhotos) at the position dictated by the current
     * sort. View Cache is also patched. Navigation index is adjusted so
     * the user stays on their current photo.
     *
     * - currentPhoto entity itself is NOT changed (Photo identity preserved).
     * - If sortDirty is true (star edits made order stale) we apply a local
     *   re-sort first so binary-search runs against a sorted array.
     *
     * @param {object} newPhotoData JSON-shape photo (matches Photo.toJSON())
     */
    const addPhotoToList = useCallback((newPhotoData) => {
        const comparator = getPhotoSortComparator(sortOfPhotos);

        // If sortDirty, re-sort first so insert position is accurate.
        let workingAll = allPhotosForCurrentFetch;
        let workingMini = photosListMiniAllPhotos;
        if (sortDirty && comparator) {
            workingAll = [...allPhotosForCurrentFetch].sort(comparator);
            workingMini = [...photosListMiniAllPhotos].sort(comparator);
            setAllPhotosForCurrentFetch(workingAll);
            setPhotosListMiniAllPhotos(workingMini);
            // Cache must also be sorted before the binary-search splice below.
            patchCacheCurrentView(prev => [...prev].sort(comparator));
            if (setSortDirty) setSortDirty(false);
        }

        const insertIdxAll = findInsertIndex(workingAll, newPhotoData, comparator);
        const insertIdxMini = findInsertIndex(workingMini, newPhotoData, comparator);

        setAllPhotosForCurrentFetch(prev => {
            const next = [...prev];
            next.splice(insertIdxAll, 0, newPhotoData);
            return next;
        });
        setPhotosListMiniAllPhotos(prev => {
            const next = [...prev];
            next.splice(insertIdxMini, 0, newPhotoData);
            return next;
        });

        patchCacheCurrentView(prev => {
            const next = [...prev];
            const cacheIdx = findInsertIndex(next, newPhotoData, comparator);
            next.splice(cacheIdx, 0, newPhotoData);
            return next;
        });

        // Navigation indices: any insert at or before the current index
        // pushes the current photo right by 1.
        if (typeof photosListMiniCurrentIndex === 'number' && insertIdxMini <= photosListMiniCurrentIndex) {
            setPhotosListMiniCurrentIndex(prev => (prev ?? 0) + 1);
        }
        if (typeof currentPhotoIndex === 'number' && insertIdxAll <= currentPhotoIndex) {
            setCurrentPhotoIndex(prev => (prev ?? 0) + 1);
        }

        // Infinite scroll: bump display window if insertion landed within
        // the visible slice so the new photo isn't hidden post-close.
        if (infiniteScrollEnabled && insertIdxMini < (displayedPhotoCount ?? 0)) {
            setDisplayedPhotoCount(prev => prev + 1);
        }
    }, [
        sortOfPhotos,
        sortDirty,
        setSortDirty,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        patchCacheCurrentView,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        currentPhotoIndex,
        setCurrentPhotoIndex,
        displayedPhotoCount,
        setDisplayedPhotoCount,
        infiniteScrollEnabled
    ]);

    /**
     * Refresh album list after metadata update.
     *
     * Album-level metadata changes (cover, name, description) don't change
     * the photo membership, so we don't reload the photos themselves —
     * useViewModeSync drives that via the cache/refresh path. Only the
     * album list (used by sidebar / pickers) needs to refresh here.
     */
    const handleAlbumUpdate = useCallback(() => {
        if (viewMode === VIEW_MODES.ALBUM_LIST) {
            loadAlbums();
        }
        logger.info('usePhotoListHelpers', 'album_updated', 'Album list refreshed after metadata update', { currentAlbumId });
    }, [viewMode, loadAlbums, currentAlbumId]);

    /**
     * Add or remove photo from selection and switch to selection tab
     * @param {boolean} t - True to add, false to remove
     * @param {string} f - Photo path
     */
    const addSelection = useCallback((t, f) => {
        if (t) {
            if (!photoSelectionDict[f]) {
                togglePhotoSelection(f);
            }
            // Don't switch to Selection tab if Share tab is active
            if (!tabClass?.share) {
                changeTab(undefined, "#tab-selection");
            }
        } else {
            if (photoSelectionDict[f]) {
                togglePhotoSelection(f);
            }
        }
    }, [photoSelectionDict, togglePhotoSelection, changeTab, tabClass]);

    /**
     * Toggle photo selection and return new state
     * @param {string} f - Photo path
     * @returns {boolean} New selection state
     */
    const toggleSelection = useCallback((f) => {
        const wasSelected = photoSelectionDict[f];
        togglePhotoSelection(f);
        return !wasSelected;
    }, [photoSelectionDict, togglePhotoSelection]);

    /**
     * Select all photos currently shown in the grid
     * PhotoGrid displays all filteredPhotos via react-window virtualization,
     * so we select filteredPhotos (not displayedPhotos which is only a 50-item slice).
     * Re-clicking after filteredPhotos grows (e.g. new imports) adds the new ones.
     */
    const selectAllPhotoToSelection = useCallback(() => {
        selectAllPhotos(filteredPhotos);
    }, [filteredPhotos, selectAllPhotos]);

    return {
        setStarWithUpdate,
        updatePhotoComment,
        updatePhotoTags,
        updatePhotoAlbums,
        updatePhotoCssStyle,
        addPhotoToList,
        handleAlbumUpdate,
        addSelection,
        toggleSelection,
        selectAllPhotoToSelection
    };
}
