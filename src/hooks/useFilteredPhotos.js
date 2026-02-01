/**
 * useFilteredPhotos - Hook for computing filtered and sorted photos
 */
import { useMemo } from 'react';
import { convertJSONToPhotoEntities } from '../utils/PhotoProcessingUtils.js';
import { Photo } from '../domain/Photo.js';
import { logger } from '../services/LoggerService.js';

/**
 * Hook for computing filtered and sorted photos based on view mode
 * @param {Object} options
 * @param {ViewMode} options.viewModeObj - Current view mode object
 * @param {Array} options.albumPhotos - Photos in current album
 * @param {Array} options.tagPhotos - Photos with current tag
 * @param {Object} options.photoCollection - Photo collection object
 * @param {Array} options.allPhotosForCurrentFetch - All fetched photos
 * @param {Function} options.applyFiltersWithConfig - Filter application function
 * @param {number} options.importSortOfPhotos - Import mode sort value
 * @param {number} options.sortOfPhotos - General sort value
 * @param {Object} options.appConfig - Application config
 * @param {Array} options.searchResults - Search results from useSearch
 * @returns {Array} Filtered and sorted photos
 */
export function useFilteredPhotos({
    viewModeObj,
    albumPhotos,
    tagPhotos,
    photoCollection,
    allPhotosForCurrentFetch,
    applyFiltersWithConfig,
    importSortOfPhotos,
    sortOfPhotos,
    appConfig,
    searchResults = []
}) {
    return useMemo(() => {
        // Use appropriate photo source based on current mode
        // For search mode, use searchResults if available
        const sourcePhotos = viewModeObj.isSearchMode() && searchResults.length > 0 ? searchResults :
            (viewModeObj.isAlbumMode() ? albumPhotos :
                (viewModeObj.isTagMode() ? tagPhotos :
                    (viewModeObj.isTrashMode() ? (photoCollection?.photos || []) :
                        allPhotosForCurrentFetch)));

        const usingSearchResults = viewModeObj.isSearchMode() && searchResults.length > 0;

        logger.debug('useFilteredPhotos', 'source_selection', 'Using photo source for filtering', {
            mode: viewModeObj.mode,
            sourceCount: sourcePhotos.length,
            isAlbumMode: viewModeObj.isAlbumMode(),
            isTagMode: viewModeObj.isTagMode(),
            isTrashMode: viewModeObj.isTrashMode(),
            isSearchMode: viewModeObj.isSearchMode(),
            searchResultsCount: searchResults.length,
            usingSearchResults
        });

        // Convert source photos to Photo entities
        // For search results (raw backend data), use Photo.fromBackendData
        // For other sources, use convertJSONToPhotoEntities
        let photosWithMethods;
        if (usingSearchResults && appConfig) {
            photosWithMethods = sourcePhotos
                .map(photoData => {
                    try {
                        return Photo.fromBackendData(photoData, appConfig, false);
                    } catch (e) {
                        logger.warn('useFilteredPhotos', 'conversion_error', 'Failed to convert search result', {
                            error: e.message
                        });
                        return null;
                    }
                })
                .filter(photo => photo !== null);
        } else {
            photosWithMethods = convertJSONToPhotoEntities(sourcePhotos, appConfig);
        }

        // Apply frontend filters
        let result = applyFiltersWithConfig(photosWithMethods);

        // Apply frontend sorting for import mode
        if (viewModeObj.isImportMode()) {
            const sortComparator = getImportSortComparator(importSortOfPhotos);
            if (sortComparator) {
                result = [...result].sort(sortComparator);
                logger.debug('useFilteredPhotos', 'import_sorted', 'Applied frontend sort to import photos', {
                    sortValue: importSortOfPhotos,
                    photoCount: result.length
                });
            }
        }

        logger.debug('useFilteredPhotos', 'filtering_complete', 'Filtering completed', {
            inputCount: sourcePhotos.length,
            outputCount: result.length
        });

        return result;
    }, [viewModeObj, albumPhotos, tagPhotos, photoCollection?.photos, allPhotosForCurrentFetch, applyFiltersWithConfig, importSortOfPhotos, sortOfPhotos, appConfig, searchResults]);
}

/**
 * Get sort comparator for import mode
 * @param {number} sortValue - Sort value
 * @returns {Function|null} Comparator function or null
 */
function getImportSortComparator(sortValue) {
    const comparators = {
        2: (a, b) => {
            // Added Time (desc) - newest first
            const aTime = a.created_at || '';
            const bTime = b.created_at || '';
            return bTime.localeCompare(aTime);
        },
        3: (a, b) => {
            // Added Time (asc) - oldest first
            const aTime = a.created_at || '';
            const bTime = b.created_at || '';
            return aTime.localeCompare(bTime);
        },
        6: (a, b) => {
            // File Name (desc) - Z→A
            return (b.name || '').localeCompare(a.name || '');
        },
        7: (a, b) => {
            // File Name (asc) - A→Z
            return (a.name || '').localeCompare(b.name || '');
        }
    };
    return comparators[sortValue] || null;
}

export default useFilteredPhotos;
