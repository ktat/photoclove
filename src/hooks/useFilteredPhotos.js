/**
 * useFilteredPhotos - Hook for computing filtered and sorted photos
 */
import { useMemo } from 'react';
import { convertJSONToPhotoEntities } from '../utils/PhotoProcessingUtils.js';
import { getPhotoSortComparator } from '../utils/PhotoSort.js';
import { logger } from '../services/LoggerService.js';

/**
 * Hook for computing filtered and sorted photos based on view mode.
 *
 * After Phase 1 unification, all view modes (album/tag/search/trash/etc.)
 * feed photos through allPhotosForCurrentFetch. This hook only filters
 * and (for import mode) sorts.
 *
 * @param {Object} options
 * @param {ViewMode} options.viewModeObj - Current view mode object
 * @param {Array} options.allPhotosForCurrentFetch - All fetched photos (single source)
 * @param {Function} options.applyFiltersWithConfig - Filter application function
 * @param {number} options.importSortOfPhotos - Import mode sort value
 * @param {number} options.sortOfPhotos - General sort value (unused here; backend applies)
 * @param {Object} options.appConfig - Application config
 * @returns {Array} Filtered and sorted photos
 */
export function useFilteredPhotos({
    viewModeObj,
    allPhotosForCurrentFetch,
    applyFiltersWithConfig,
    importSortOfPhotos,
    sortOfPhotos,
    appConfig
}) {
    return useMemo(() => {
        const sourcePhotos = allPhotosForCurrentFetch;

        logger.debug('useFilteredPhotos', 'source_selection', 'Using photo source for filtering', {
            mode: viewModeObj?.mode,
            sourceCount: sourcePhotos.length,
        });

        const photosWithMethods = convertJSONToPhotoEntities(sourcePhotos, appConfig);
        let result = applyFiltersWithConfig(photosWithMethods);

        if (viewModeObj?.isImportMode?.()) {
            const sortComparator = getPhotoSortComparator(importSortOfPhotos);
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
    }, [viewModeObj, allPhotosForCurrentFetch, applyFiltersWithConfig, importSortOfPhotos, sortOfPhotos, appConfig]);
}

export default useFilteredPhotos;
