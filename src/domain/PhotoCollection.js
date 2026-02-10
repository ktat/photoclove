import { logger } from '../services/LoggerService.js';
import {
    fetchDatePhotos,
    fetchRecentPhotos,
    fetchSearchPhotos,
    fetchAlbumPhotos,
    fetchTagPhotos,
    fetchTrashPhotos,
    fetchImportPhotos
} from './PhotoCollectionFetchers.js';

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

    static createSearchCollection(photos, query, config, searchParams = null, sortValue = 0) {
        return new PhotoCollection(photos, 'search', { query, searchParams, config, sortValue });
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

    static createImportCollection(photos, currentImportPath, importPaths = [], importFilter = '', config, sortValue = 0, importState = null) {
        return new PhotoCollection(photos, 'import', {
            currentImportPath,
            importPaths,
            importFilter,
            config,
            sortValue,
            importProgress: null,
            isImporting: false,
            importState
        });
    }

    /**
     * Fetch photos based on the collection's mode and metadata
     */
    async fetchPhotos(page = 1, pageSize = 20, filters = {}) {
        let result;

        switch (this.mode) {
            case 'date':
                result = await fetchDatePhotos(this, page, pageSize, filters);
                break;
            case 'recent':
                result = await fetchRecentPhotos(this, page, pageSize, filters);
                break;
            case 'search':
                result = await fetchSearchPhotos(this, page, pageSize, filters);
                break;
            case 'album':
                result = await fetchAlbumPhotos(this, page, pageSize, filters);
                break;
            case 'tag':
                result = await fetchTagPhotos(this, page, pageSize, filters);
                break;
            case 'trash':
                result = await fetchTrashPhotos(this, page, pageSize, filters);
                break;
            case 'import':
                result = await fetchImportPhotos(this, page, pageSize, filters);
                break;
            default:
                throw new Error(`Fetch not implemented for mode: ${this.mode}`);
        }

        return this.withPhotos(result.photos).withMetadata(result.metadata);
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
