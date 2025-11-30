import { Photo } from './Photo.js';
import { invoke } from "@tauri-apps/api/core";
import { logger } from '../services/LoggerService.js';

/**
 * PhotoCollection - Domain object representing a collection of photos with mode-specific behavior
 */
export class PhotoCollection {
    constructor(photos, mode, metadata = {}) {
        this.photos = photos || [];
        this.mode = mode; // 'album', 'date', 'search', 'trash', 'recent', 'tag'
        this.metadata = metadata; // title, albumId, date, query, etc.
    }

    /**
     * Get display title for the collection
     */
    getTitle() {
        switch (this.mode) {
            case 'album':
                return this.metadata.albumName || 'Album';
            case 'date':
                return this.metadata.date || 'Date';
            case 'search':
                return `Search: "${this.metadata.query || ''}"`;
            case 'trash':
                return 'Trash Bin';
            case 'recent':
                return 'Recent Photos';
            case 'tag':
                return `Tag: ${this.metadata.tagName || 'Unknown'}`;
            default:
                return 'Photos';
        }
    }

    /**
     * Get available tabs for this mode
     */
    getAvailableTabs() {
        const baseTabs = [
            { id: 'home', label: 'Home', icon: '🏠' },
            { id: 'recent', label: 'Recent', icon: '📅' },
            { id: 'albums', label: 'Albums', icon: '📚' },
            { id: 'tags', label: 'Tags', icon: '🏷️' },
            { id: 'search', label: 'Search', icon: '🔍' },
            { id: 'trash', label: 'Trash', icon: '🗑️' }
        ];

        // Mode-specific tab availability
        switch (this.mode) {
            case 'album':
                return baseTabs.filter(tab => ['home', 'albums', 'search', 'trash'].includes(tab.id));
            case 'trash':
                return baseTabs.filter(tab => ['home', 'recent', 'albums', 'search'].includes(tab.id));
            case 'search':
                return baseTabs;
            default:
                return baseTabs;
        }
    }

    /**
     * Get keyboard shortcuts for this mode
     */
    getKeyboardShortcuts() {
        const baseShortcuts = {
            'Escape': 'Close current view',
            'ArrowLeft': 'Previous photo',
            'ArrowRight': 'Next photo',
            'ArrowUp': 'Show thumbnails',
            'ArrowDown': 'Hide thumbnails',
            'f': 'Toggle favorite',
            '?': 'Show help'
        };

        const modeSpecificShortcuts = {
            album: {
                'Delete': 'Remove from album',
                'Ctrl+Delete': 'Delete file permanently'
            },
            trash: {
                'Delete': 'Delete permanently',
                'r': 'Restore from trash'
            },
            search: {
                'Ctrl+f': 'Focus search box'
            }
        };

        return {
            ...baseShortcuts,
            ...(modeSpecificShortcuts[this.mode] || {})
        };
    }

    /**
     * Get dropdown menu items for this mode
     */
    getDropdownItems() {
        const baseItems = [
            { id: 'select_all', label: 'Select All', icon: '☑️' },
            { id: 'deselect_all', label: 'Deselect All', icon: '⬜' },
            { id: 'export', label: 'Export Selected', icon: '📤' }
        ];

        const modeSpecificItems = {
            album: [
                { id: 'remove_from_album', label: 'Remove from Album', icon: '➖' },
                { id: 'delete_files', label: 'Delete Files', icon: '🗑️' }
            ],
            trash: [
                { id: 'restore_selected', label: 'Restore Selected', icon: '↩️' },
                { id: 'delete_permanently', label: 'Delete Permanently', icon: '💀' }
            ],
            date: [
                { id: 'create_album', label: 'Create Album from Date', icon: '📚' },
                { id: 'move_to_trash', label: 'Move to Trash', icon: '🗑️' }
            ]
        };

        return [
            ...baseItems,
            ...(modeSpecificItems[this.mode] || [])
        ];
    }

    /**
     * Get tutorial steps for this mode
     */
    getTutorialSteps() {
        const tutorials = {
            album: [
                'Click photos to view them in detail',
                'Use Delete to remove from album, Ctrl+Delete to delete file',
                'Drag photos to reorder them in the album'
            ],
            trash: [
                'Photos in trash can be restored or permanently deleted',
                'Press R to restore, Delete to permanently delete',
                'Trash is automatically cleaned after 30 days'
            ],
            search: [
                'Use filters to narrow down your search',
                'Search by date, tags, star rating, or comments',
                'Save frequently used searches as bookmarks'
            ]
        };

        return tutorials[this.mode] || [
            'Click photos to view them',
            'Use arrow keys to navigate',
            'Press F to favorite photos'
        ];
    }

    /**
     * Get display key for state management
     */
    getDisplayKey() {
        switch (this.mode) {
            case 'recent':
                return 'recent';
            case 'search':
                return 'search_results';
            case 'album':
                return `album_${this.metadata.albumId}`;
            case 'tag':
                return `tag_${this.metadata.tagId}`;
            case 'trash':
                return 'trash';
            case 'date':
            default:
                return this.metadata.date || new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Check if infinite scroll is available for this mode
     */
    hasInfiniteScroll() {
        return ['date', 'recent', 'search'].includes(this.mode);
    }

    /**
     * Get pagination info for this mode
     */
    getPaginationInfo() {
        return {
            hasNext: this.metadata.hasNext || false,
            hasPrev: this.metadata.hasPrev || false,
            currentPage: this.metadata.currentPage || 1,
            totalPages: this.metadata.totalPages || 1
        };
    }

    /**
     * Create a new collection with updated photos
     */
    withPhotos(newPhotos) {
        return new PhotoCollection(newPhotos, this.mode, this.metadata);
    }


    /**
     * Create a new collection with updated metadata
     */
    withMetadata(newMetadata) {
        return new PhotoCollection(this.photos, this.mode, { ...this.metadata, ...newMetadata });
    }

    /**
     * Factory methods for different modes
     */
    static createAlbumCollection(photos, albumId, albumName, config, sortValue = 0) {
        return new PhotoCollection(photos, 'album', { albumId, albumName, config, sortValue });
    }

    static createDateCollection(photos, date, config, sortValue = 0) {
        return new PhotoCollection(photos, 'date', { date, config, sortValue });
    }

    static createSearchCollection(photos, query, config, searchResults = null, sortValue = 0) {
        return new PhotoCollection(photos, 'search', { query, searchResults, config, sortValue });
    }

    static createTrashCollection(photos, config, sortValue = 0) {
        return new PhotoCollection(photos, 'trash', { config, sortValue });
    }

    static createRecentCollection(photos, config, sortValue = 0) {
        return new PhotoCollection(photos, 'recent', { config, sortValue });
    }

    static createTagCollection(photos, tagIds, tagName, config, sortValue = 0) {
        return new PhotoCollection(photos, 'tag', { tagIds, tagName, config, sortValue });
    }

    static createImportCollection(photos, currentImportPath, importPaths = [], importFilter = '', config, sortValue = 0) {
        return new PhotoCollection(photos, 'import', {
            currentImportPath,
            importPaths,
            importFilter,
            config,
            sortValue,
            // Progress state
            importProgress: null,
            isImporting: false
        });
    }

    /**
     * Fetch photos based on the collection's mode and metadata
     */
    async fetchPhotos(page = 1, pageSize = 20, filters = {}) {
        switch (this.mode) {
            case 'date':
                return await this._fetchDatePhotos(page, pageSize, filters);
            case 'recent':
                return await this._fetchRecentPhotos(page, pageSize, filters);
            case 'search':
                return await this._fetchSearchPhotos(page, pageSize, filters);
            case 'album':
                return await this._fetchAlbumPhotos(page, pageSize, filters);
            case 'tag':
                return await this._fetchTagPhotos(page, pageSize, filters);
            case 'trash':
                return await this._fetchTrashPhotos(page, pageSize, filters);
            case 'import':
                return await this._fetchImportPhotos(page, pageSize, filters);
            default:
                throw new Error(`Fetch not implemented for mode: ${this.mode}`);
        }
    }

    /**
     * Fetch photos for date mode
     */
    async _fetchDatePhotos(page, pageSize, filters) {
        const result = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "date",
                query: this.metadata.date,
                sort_value: this.metadata.sortValue || 0,
                page: 1,  // Original code always used page 1
                limit: Math.min(9999, pageSize || 1000),  // Match original behavior
                offset: 0,  // Original code always used offset 0
                star: filters.star || -1,
                has_comment: filters.hasComment || false,
                extension: filters.extension || "all"
            }
        });

        const data = JSON.parse(result);

        logger.debug('PhotoCollection', '_fetchDatePhotos_parsed', 'Date mode JSON parsed', {
            dataType: typeof data,
            hasPhotos: !!data?.photos,
            photosLength: data?.photos?.length,
            dataKeys: data ? Object.keys(data) : 'null',
            firstPhotoStructure: data?.photos?.[0] ? Object.keys(data.photos[0]) : 'no photos',
            firstPhotoFile: data?.photos?.[0]?.file,
            firstPhotoPath: data?.photos?.[0]?.file?.path || data?.photos?.[0]?.path
        });

        // Convert raw photos to Photo entities
        const config = this.metadata.config;
        logger.debug('PhotoCollection', 'fetch_date_photos_creating', 'Creating Photo entities from date backend data', {
            mode: this.mode,
            date: this.metadata.date,
            photoCount: (data.photos || []).length,
            hasConfig: !!config,
            configThumbnailStore: config?.thumbnail_store,
            configTrashPath: config?.trash_path
        });

        const photoEntities = (data.photos || [])
            .map(photoData => Photo.fromBackendData(photoData, config, false)) // isFromTrash = false
            .filter(photo => photo !== null); // Remove null entries from invalid data

        return this.withPhotos(photoEntities)
            .withMetadata({
                hasNext: data.has_next || false,
                hasPrev: false,  // Since we're getting all data, no pagination at API level
                currentPage: page,
                totalCount: data.total_count || photoEntities.length
            });
    }

    /**
     * Fetch photos for recent mode
     */
    async _fetchRecentPhotos(page, pageSize, filters) {
        const result = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "recent",
                limit: Math.min(60, pageSize || 60), // Match original behavior
                sort_value: this.metadata.sortValue || 0,
                star: filters.star || -1,
                has_comment: filters.hasComment || false,
                extension: filters.extension || "all"
            }
        });

        const data = JSON.parse(result);

        // Convert raw photos to Photo entities
        const config = this.metadata.config;
        const photoEntities = (data.photos || [])
            .map(photoData => Photo.fromBackendData(photoData, config, false)) // isFromTrash = false
            .filter(photo => photo !== null); // Remove null entries from invalid data


        return this.withPhotos(photoEntities)
            .withMetadata({
                hasNext: false, // Recent mode typically doesn't paginate
                hasPrev: false,
                currentPage: 1,
                totalCount: photoEntities.length
            });
    }

    /**
     * Fetch photos for search mode
     */
    async _fetchSearchPhotos(page, pageSize, filters) {
        // If we have cached search results, use them
        if (this.metadata.searchResults && Array.isArray(this.metadata.searchResults)) {
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const pagePhotos = this.metadata.searchResults.slice(startIndex, endIndex);

            return this.withPhotos(pagePhotos)
                .withMetadata({
                    hasNext: endIndex < this.metadata.searchResults.length,
                    hasPrev: page > 1,
                    currentPage: page,
                    totalCount: this.metadata.searchResults.length
                });
        }

        // Fallback to date-based search if no search results
        const result = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "date",
                query: this.metadata.query || this.metadata.date,
                sort_value: this.metadata.sortValue || 0,
                page: 1,  // Match original behavior
                limit: Math.min(9999, pageSize || 1000),  // Match original behavior
                offset: 0,  // Match original behavior
                star: filters.star || -1,
                has_comment: filters.hasComment || false,
                extension: filters.extension || "all"
            }
        });

        const data = JSON.parse(result);

        // Convert raw photos to Photo entities (same as other modes)
        const config = this.metadata.config;
        const photoEntities = (data.photos || [])
            .map(photoData => Photo.fromBackendData(photoData, config, false))
            .filter(photo => photo !== null);

        return this.withPhotos(photoEntities)
            .withMetadata({
                hasNext: data.has_next || false,
                hasPrev: page > 1,
                currentPage: page,
                totalCount: data.total_count || photoEntities.length
            });
    }

    /**
     * Fetch photos for album mode
     */
    async _fetchAlbumPhotos(page, pageSize, filters) {
        const result = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "album_photos",
                params: {
                    album_id: this.metadata.albumId
                },
                star: filters.star || -1,
                has_comment: filters.hasComment || false,
                extension: filters.extension || "all"
            }
        });

        const data = JSON.parse(result);

        // Convert raw photos to Photo entities  
        const config = this.metadata.config;
        const photoEntities = (data.photos || [])
            .map(photoData => Photo.fromBackendData(photoData, config, false))
            .filter(photo => photo !== null);

        return this.withPhotos(photoEntities)
            .withMetadata({
                hasNext: data.has_next || false,
                hasPrev: false,
                currentPage: page,
                totalCount: data.total_count || photoEntities.length
            });
    }

    /**
     * Fetch photos for tag mode
     */
    async _fetchTagPhotos(page, pageSize, filters) {
        const result = await invoke("get_photos_unified", {
            request: {
                type: "search",
                search_type: "tag",
                query: this.metadata.tagIds ? this.metadata.tagIds.join(',') : '',
                star: filters.star || -1,
                has_comment: filters.hasComment || false,
                extension: filters.extension || "all"
            }
        });

        const data = JSON.parse(result);

        // Convert raw photos to Photo entities
        const config = this.metadata.config;
        const photoEntities = (data.photos || [])
            .map(photoData => Photo.fromBackendData(photoData, config, false))
            .filter(photo => photo !== null);

        return this.withPhotos(photoEntities)
            .withMetadata({
                hasNext: data.has_next || false,
                hasPrev: false,
                currentPage: page,
                totalCount: data.total_count || photoEntities.length
            });
    }

    /**
     * Fetch photos for trash mode
     */
    async _fetchTrashPhotos(page, pageSize, filters) {

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


        // Convert raw photos to Photo entities
        const config = this.metadata.config;


        const photoEntities = (data.photos || [])
            .map((photoData, index) => {
                try {
                    const result = Photo.fromBackendData(photoData, config, true); // isFromTrash = true
                    return result;
                } catch (error) {
                    return null;
                }
            })
            .filter(photo => photo !== null);


        return this.withPhotos(photoEntities)
            .withMetadata({
                hasNext: data.has_next || false,
                hasPrev: false,
                currentPage: page,
                totalCount: data.total_count || photoEntities.length
            });
    }

    /**
     * Fetch photos for import mode
     */
    async _fetchImportPhotos(page, pageSize, filters) {
        const result = await invoke('show_importer', {
            pathStr: this.metadata.currentImportPath,
            page: page,
            num: pageSize,
            dateStr: this.metadata.importFilter
        })

        const importerData = JSON.parse(result);
        logger.debug('PhotoCollection', '_fetchImportPhotos_parsed', 'Import mode JSON parsed', {
            dataType: typeof importerData,
            hasDirsFiles: !!importerData?.dirs_files,
            dirsFilesKeys: importerData?.dirs_files ? Object.keys(importerData.dirs_files) : 'null',
            filesLength: importerData?.dirs_files?.files?.files ? importerData.dirs_files.files.files.length : 'no files',
            firstFileStructure: importerData?.dirs_files?.files?.files?.[0] ? Object.keys(importerData.dirs_files.files.files[0]) : 'no files'
        });
        // Normalize import photos to match standard photo structure
        const rawPhotos = importerData.dirs_files.files.files || [];
        const config = this.metadata.config;
        const normalizedPhotos = rawPhotos.map(photo => {
            const photoEntity = new Photo({
                // Standard photo structure
                file: {
                    path: photo.path,
                    name: photo.path.split('/').pop() || '',
                    size: photo.size || 0
                },
                path: photo.path,
                // Copy other properties that might exist
                has_thumbnail: false,  // Set to false for simplicity
                created_at: photo.created_at,
                star: 0,
                comment: '',
                // Additional import-specific properties
                import_source: true,
                original_path: photo.path,
            }, config);

            return photoEntity;
        });

        logger.debug('PhotoCollection', '_fetchImportPhotos_normalized', 'Import mode photos normalized', {
            originalFileCount: rawPhotos.length,
            normalizedPhotoCount: normalizedPhotos.length,
            firstNormalizedPhoto: normalizedPhotos[0] || null
        });

        return this.withPhotos(normalizedPhotos)
            .withMetadata({
                hasNext: importerData.dirs_files.has_next_file || false,
                hasPrev: importerData.dirs_files.has_prev_file || false,
                currentPage: importerData.page || page,
                directories: importerData.dirs_files.dirs.dirs || [],
                importPaths: importerData.paths || this.metadata.importPaths,
                currentImportPath: importerData.dirs_files.dir.path || this.metadata.currentImportPath,
                totalCount: normalizedPhotos.length
            });
    }


    /**
     * Get import-specific metadata
     */
    getImportMetadata() {
        if (this.mode !== 'import') {
            throw new Error('getImportMetadata() can only be called on import mode collections');
        }

        return {
            currentImportPath: this.metadata.currentImportPath || '',
            importPaths: this.metadata.importPaths || [],
            importFilter: this.metadata.importFilter || '',
            directories: this.metadata.directories || [],
            importProgress: this.metadata.importProgress,
            isImporting: this.metadata.isImporting || false
        };
    }
}