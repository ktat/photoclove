/**
 * PhotoCollection Fetchers - Fetch methods for different collection modes
 * Extracted from PhotoCollection.js for better maintainability
 */

import { Photo } from './Photo.js';
import { invoke } from "@tauri-apps/api/core";
import { logger } from '../services/LoggerService.js';

/**
 * Check if filters have any active/meaningful values
 */
export function hasActiveFilters(filters) {
    if (!filters) return false;

    return !!(
        filters.camera ||
        filters.lens ||
        (filters.isoRange?.min) || (filters.isoRange?.max) ||
        (filters.apertureRange?.min) || (filters.apertureRange?.max) ||
        (filters.shutterSpeedRange?.min) || (filters.shutterSpeedRange?.max) ||
        (filters.focalLengthRange?.min) || (filters.focalLengthRange?.max) ||
        filters.dateRange?.start || filters.dateRange?.end ||
        filters.hasComment ||
        (filters.starRating && filters.starRating > 0) ||
        (filters.fileExtension && filters.fileExtension !== '') ||
        (filters.selectedTags && filters.selectedTags.length > 0)
    );
}

/**
 * Transform frontend filter format to backend format
 */
export function transformFiltersToBackend(frontendFilters) {
    if (!frontendFilters) return null;

    const backendFilters = {};

    // Camera and lens (already matching)
    if (frontendFilters.camera) backendFilters.camera = frontendFilters.camera;
    if (frontendFilters.lens) backendFilters.lens = frontendFilters.lens;

    // ISO range: isoRange.min/max -> iso_min/iso_max
    if (frontendFilters.isoRange?.min) backendFilters.iso_min = parseInt(frontendFilters.isoRange.min);
    if (frontendFilters.isoRange?.max) backendFilters.iso_max = parseInt(frontendFilters.isoRange.max);

    // Aperture range: apertureRange.min/max -> aperture_min/aperture_max
    if (frontendFilters.apertureRange?.min) backendFilters.aperture_min = parseFloat(frontendFilters.apertureRange.min);
    if (frontendFilters.apertureRange?.max) backendFilters.aperture_max = parseFloat(frontendFilters.apertureRange.max);

    // Focal length range: focalLengthRange.min/max -> focal_length_min/focal_length_max
    if (frontendFilters.focalLengthRange?.min) backendFilters.focal_length_min = parseFloat(frontendFilters.focalLengthRange.min);
    if (frontendFilters.focalLengthRange?.max) backendFilters.focal_length_max = parseFloat(frontendFilters.focalLengthRange.max);

    // Date range: dateRange.start/end -> start_date/end_date
    if (frontendFilters.dateRange?.start) backendFilters.start_date = frontendFilters.dateRange.start;
    if (frontendFilters.dateRange?.end) backendFilters.end_date = frontendFilters.dateRange.end;

    // Star rating: starRating -> min_rating
    if (frontendFilters.starRating && frontendFilters.starRating > 0) {
        backendFilters.min_rating = frontendFilters.starRating;
    }

    // Has comment: hasComment -> has_comments
    if (frontendFilters.hasComment) backendFilters.has_comments = frontendFilters.hasComment;

    // File extension: fileExtension -> extension
    if (frontendFilters.fileExtension && frontendFilters.fileExtension !== '') {
        backendFilters.extension = frontendFilters.fileExtension;
    }

    // Tags: selectedTags (array of tag objects) -> tag_ids (array of integers)
    if (frontendFilters.selectedTags && frontendFilters.selectedTags.length > 0) {
        backendFilters.tag_ids = frontendFilters.selectedTags.map(tag => tag.id);
    }

    return Object.keys(backendFilters).length > 0 ? backendFilters : null;
}

/**
 * Fetch photos for date mode
 */
export async function fetchDatePhotos(collection, page, pageSize, filters) {
    const result = await invoke("get_photos_unified", {
        request: {
            type: "search",
            search_type: "date",
            query: collection.metadata.date,
            sort_value: collection.metadata.sortValue || 0,
            page: 1,
            limit: Math.min(9999, pageSize || 1000),
            offset: 0,
            star: filters.star || -1,
            has_comment: filters.hasComment || false,
            extension: filters.extension || "all"
        }
    });

    const data = JSON.parse(result);

    logger.debug('PhotoCollectionFetchers', 'fetchDatePhotos_parsed', 'Date mode JSON parsed', {
        dataType: typeof data,
        hasPhotos: !!data?.photos,
        photosLength: data?.photos?.length,
        dataKeys: data ? Object.keys(data) : 'null',
        firstPhotoStructure: data?.photos?.[0] ? Object.keys(data.photos[0]) : 'no photos',
        firstPhotoFile: data?.photos?.[0]?.file,
        firstPhotoPath: data?.photos?.[0]?.file?.path || data?.photos?.[0]?.path
    });

    const config = collection.metadata.config;
    logger.debug('PhotoCollectionFetchers', 'fetchDatePhotos_creating', 'Creating Photo entities from date backend data', {
        mode: collection.mode,
        date: collection.metadata.date,
        photoCount: (data.photos || []).length,
        hasConfig: !!config,
        configThumbnailStore: config?.thumbnail_store,
        configTrashPath: config?.trash_path
    });

    const photoEntities = (data.photos || [])
        .map(photoData => Photo.fromBackendData(photoData, config, false))
        .filter(photo => photo !== null);

    return {
        photos: photoEntities,
        metadata: {
            hasNext: data.has_next || false,
            hasPrev: false,
            currentPage: page,
            totalCount: data.total_count || photoEntities.length
        }
    };
}

/**
 * Fetch photos for recent mode
 */
export async function fetchRecentPhotos(collection, page, pageSize, filters) {
    const result = await invoke("get_photos_unified", {
        request: {
            type: "search",
            search_type: "recent",
            limit: Math.min(60, pageSize || 60),
            sort_value: collection.metadata.sortValue || 0,
            star: filters.star || -1,
            has_comment: filters.hasComment || false,
            extension: filters.extension || "all"
        }
    });

    const data = JSON.parse(result);
    const config = collection.metadata.config;
    const photoEntities = (data.photos || [])
        .map(photoData => Photo.fromBackendData(photoData, config, false))
        .filter(photo => photo !== null);

    return {
        photos: photoEntities,
        metadata: {
            hasNext: false,
            hasPrev: false,
            currentPage: 1,
            totalCount: photoEntities.length
        }
    };
}

/**
 * Fetch photos for search mode
 */
export async function fetchSearchPhotos(collection, page, pageSize, filters) {
    const hasQuery = collection.metadata.searchParams?.query?.trim();
    const hasFiltersActive = hasActiveFilters(collection.metadata.searchParams?.filters);

    if (!collection.metadata.searchParams || (!hasQuery && !hasFiltersActive)) {
        logger.info('PhotoCollectionFetchers', 'fetchSearchPhotos_no_params', 'No search params or all empty', {
            hasSearchParams: !!collection.metadata.searchParams,
            hasQuery: !!hasQuery,
            hasFilters: !!hasFiltersActive,
            filters: collection.metadata.searchParams?.filters
        });
        return {
            photos: [],
            metadata: {
                hasNext: false,
                hasPrev: false,
                currentPage: page,
                totalCount: 0
            }
        };
    }

    logger.info('PhotoCollectionFetchers', 'fetchSearchPhotos_start', 'Starting search', {
        query: collection.metadata.searchParams.query,
        searchType: collection.metadata.searchParams.searchType,
        hasFilters: !!collection.metadata.searchParams.filters,
        filters: collection.metadata.searchParams.filters
    });

    const transformedFilters = transformFiltersToBackend(collection.metadata.searchParams.filters);

    logger.debug('PhotoCollectionFetchers', 'fetchSearchPhotos_filters_transformed', 'Filters transformed', {
        frontendFilters: collection.metadata.searchParams.filters,
        backendFilters: transformedFilters
    });

    const requestParams = {
        request: {
            type: "search",
            search_type: collection.metadata.searchParams.searchType || "all",
            query: collection.metadata.searchParams.query || "",
            params: transformedFilters ? {
                filters: JSON.stringify(transformedFilters)
            } : undefined,
            sort_value: collection.metadata.sortValue || 0,
            page: 1,
            limit: 9999,
            offset: 0,
            star: filters.star || -1,
            has_comment: filters.hasComment || false,
            extension: filters.extension || "all"
        }
    };

    logger.info('PhotoCollectionFetchers', 'fetchSearchPhotos_request', 'Request params', {
        requestParams: JSON.stringify(requestParams)
    });

    let result;
    try {
        result = await invoke("get_photos_unified", requestParams);
        logger.info('PhotoCollectionFetchers', 'fetchSearchPhotos_result', 'Search completed', {
            resultLength: result?.length,
            resultSample: result?.substring(0, 100)
        });
    } catch (error) {
        logger.error('PhotoCollectionFetchers', 'fetchSearchPhotos_error', 'Search failed', {
            error: error?.message || String(error)
        });
        throw error;
    }

    const data = JSON.parse(result);
    logger.info('PhotoCollectionFetchers', 'fetchSearchPhotos_parsed', 'Result parsed', {
        hasPhotos: !!data.photos,
        photoCount: data.photos?.length || 0
    });

    const config = collection.metadata.config;
    const photoEntities = (data.photos || [])
        .map(photoData => Photo.fromBackendData(photoData, config, false))
        .filter(photo => photo !== null);

    return {
        photos: photoEntities,
        metadata: {
            hasNext: false,
            hasPrev: false,
            currentPage: page,
            totalCount: photoEntities.length
        }
    };
}

/**
 * Fetch photos for album mode
 */
export async function fetchAlbumPhotos(collection, page, pageSize, filters) {
    const result = await invoke("get_photos_unified", {
        request: {
            type: "search",
            search_type: "album_photos",
            params: {
                album_id: collection.metadata.albumId
            },
            star: filters.star || -1,
            has_comment: filters.hasComment || false,
            extension: filters.extension || "all"
        }
    });

    const data = JSON.parse(result);
    const config = collection.metadata.config;
    const photoEntities = (data.photos || [])
        .map(photoData => Photo.fromBackendData(photoData, config, false))
        .filter(photo => photo !== null);

    return {
        photos: photoEntities,
        metadata: {
            hasNext: data.has_next || false,
            hasPrev: false,
            currentPage: page,
            totalCount: data.total_count || photoEntities.length
        }
    };
}

/**
 * Fetch photos for tag mode
 */
export async function fetchTagPhotos(collection, page, pageSize, filters) {
    const result = await invoke("get_photos_unified", {
        request: {
            type: "search",
            search_type: "tag",
            query: collection.metadata.tagIds ? collection.metadata.tagIds.join(',') : '',
            star: filters.star || -1,
            has_comment: filters.hasComment || false,
            extension: filters.extension || "all"
        }
    });

    const data = JSON.parse(result);
    const config = collection.metadata.config;
    const photoEntities = (data.photos || [])
        .map(photoData => Photo.fromBackendData(photoData, config, false))
        .filter(photo => photo !== null);

    return {
        photos: photoEntities,
        metadata: {
            hasNext: data.has_next || false,
            hasPrev: false,
            currentPage: page,
            totalCount: data.total_count || photoEntities.length
        }
    };
}

/**
 * Fetch photos for trash mode
 */
export async function fetchTrashPhotos(collection, page, pageSize, filters) {
    const result = await invoke("get_photos_unified", {
        request: {
            type: "search",
            search_type: "trash",
            star: filters.star || -1,
            has_comment: filters.hasComment || false,
            extension: filters.extension || "all"
        }
    });

    const data = JSON.parse(result);
    const config = collection.metadata.config;

    const photoEntities = (data.photos || [])
        .map((photoData, index) => {
            try {
                const result = Photo.fromBackendData(photoData, config, true);
                return result;
            } catch (error) {
                return null;
            }
        })
        .filter(photo => photo !== null);

    return {
        photos: photoEntities,
        metadata: {
            hasNext: data.has_next || false,
            hasPrev: false,
            currentPage: page,
            totalCount: data.total_count || photoEntities.length
        }
    };
}

/**
 * Fetch photos for import mode
 */
export async function fetchImportPhotos(collection, page, pageSize, filters) {
    // Try to use cached data from ImportState.changeDirectory() to avoid duplicate backend call
    const importState = collection.metadata.importState;
    let importerData = null;
    if (importState && page === 1) {
        importerData = importState.consumeCachedImporterData(
            collection.metadata.currentImportPath,
            collection.metadata.importFilter
        );
    }

    if (!importerData) {
        const result = await invoke('show_importer', {
            pathStr: collection.metadata.currentImportPath,
            page: page,
            num: pageSize,
            dateStr: collection.metadata.importFilter
        });
        importerData = JSON.parse(result);
    }
    logger.debug('PhotoCollectionFetchers', 'fetchImportPhotos_parsed', 'Import mode JSON parsed', {
        dataType: typeof importerData,
        hasDirsFiles: !!importerData?.dirs_files,
        dirsFilesKeys: importerData?.dirs_files ? Object.keys(importerData.dirs_files) : 'null',
        filesLength: importerData?.dirs_files?.files?.files ? importerData.dirs_files.files.files.length : 'no files',
        firstFileStructure: importerData?.dirs_files?.files?.files?.[0] ? Object.keys(importerData.dirs_files.files.files[0]) : 'no files'
    });

    const rawPhotos = importerData.dirs_files.files.files || [];
    const config = collection.metadata.config;
    const normalizedPhotos = rawPhotos.map(photo => {
        const photoEntity = new Photo({
            file: {
                path: photo.path,
                name: photo.path.split('/').pop() || '',
                size: photo.size || 0
            },
            path: photo.path,
            has_thumbnail: false,
            created_at: photo.created_at,
            star: 0,
            comment: '',
            import_source: true,
            original_path: photo.path,
        }, config);

        return photoEntity;
    });

    logger.debug('PhotoCollectionFetchers', 'fetchImportPhotos_normalized', 'Import mode photos normalized', {
        originalFileCount: rawPhotos.length,
        normalizedPhotoCount: normalizedPhotos.length,
        firstNormalizedPhoto: normalizedPhotos[0] || null
    });

    return {
        photos: normalizedPhotos,
        metadata: {
            hasNext: importerData.dirs_files.has_next_file || false,
            hasPrev: importerData.dirs_files.has_prev_file || false,
            currentPage: importerData.page || page,
            directories: importerData.dirs_files.dirs.dirs || [],
            importPaths: importerData.paths || collection.metadata.importPaths,
            currentImportPath: importerData.dirs_files.dir.path || collection.metadata.currentImportPath,
            totalCount: normalizedPhotos.length
        }
    };
}
