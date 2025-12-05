/**
 * ViewMode Domain Value Object
 * Encapsulates view mode behavior and domain logic using Domain-Driven Design principles.
 * 
 * This value object replaces scattered boolean variables and complex ternary expressions
 * with a centralized, maintainable domain model.
 */

import { VIEW_MODES } from '../constants/viewModes.js';

/**
 * ViewMode Value Object
 * Immutable value object that encapsulates view mode state and behavior
 */
export class ViewMode {
    constructor(mode, data = {}) {
        if (!Object.values(VIEW_MODES).includes(mode)) {
            throw new Error(`Invalid view mode: ${mode}`);
        }
        
        this._mode = mode;
        this._data = { ...data };
        
        // Freeze to ensure immutability
        Object.freeze(this);
    }

    // Core properties
    get mode() {
        return this._mode;
    }

    get data() {
        return { ...this._data };
    }

    // Mode checking methods
    isAlbumMode() {
        return this._mode === VIEW_MODES.ALBUM;
    }

    isAlbumListMode() {
        return this._mode === VIEW_MODES.ALBUM_LIST;
    }

    isTagMode() {
        return this._mode === VIEW_MODES.TAG;
    }

    isTagListMode() {
        return this._mode === VIEW_MODES.TAG_LIST;
    }

    isSearchMode() {
        return this._mode === VIEW_MODES.SEARCH || this._mode === VIEW_MODES.ADVANCED_SEARCH;
    }

    isAdvancedSearchMode() {
        return this._mode === VIEW_MODES.ADVANCED_SEARCH;
    }

    isTrashMode() {
        return this._mode === VIEW_MODES.TRASH;
    }

    isDateMode() {
        return this._mode === VIEW_MODES.DATE;
    }

    isRecentMode() {
        return this._mode === VIEW_MODES.RECENT;
    }

    isHomeMode() {
        return this._mode === VIEW_MODES.HOME;
    }

    isImportMode() {
        return this._mode === VIEW_MODES.IMPORT;
    }

    isPreferencesMode() {
        return this._mode === VIEW_MODES.PREFERENCES;
    }

    isJobQueueMode() {
        return this._mode === VIEW_MODES.JOB_QUEUE;
    }

    isLoginMode() {
        return this._mode === VIEW_MODES.LOGIN;
    }

    // Complex mode categories
    isPhotoViewingMode() {
        return [
            VIEW_MODES.DATE,
            VIEW_MODES.RECENT,
            VIEW_MODES.SEARCH,
            VIEW_MODES.ADVANCED_SEARCH,
            VIEW_MODES.ALBUM,
            VIEW_MODES.TAG,
            VIEW_MODES.TRASH
        ].includes(this._mode);
    }

    isListMode() {
        return [
            VIEW_MODES.ALBUM_LIST,
            VIEW_MODES.TAG_LIST
        ].includes(this._mode);
    }

    usesPhotosList() {
        return this.isPhotoViewingMode() || this.isListMode();
    }

    showsPhotosList() {
        return [
            VIEW_MODES.DATE,
            VIEW_MODES.RECENT,
            VIEW_MODES.ALBUM,
            VIEW_MODES.ALBUM_LIST,
            VIEW_MODES.TAG,
            VIEW_MODES.TAG_LIST,
            VIEW_MODES.TRASH
        ].includes(this._mode);
    }

    // Data attribute generation for component identification
    getDataAttribute() {
        switch (this._mode) {
            case VIEW_MODES.SEARCH:
            case VIEW_MODES.ADVANCED_SEARCH:
                return "search_results";
            case VIEW_MODES.ALBUM_LIST:
                return "albums";
            case VIEW_MODES.ALBUM:
                return this._data.albumId ? `album_${this._data.albumId}` : "album";
            case VIEW_MODES.TAG_LIST:
                return "tags";
            case VIEW_MODES.TAG:
                return this._data.tagId ? `tag_${this._data.tagId}` : "tag";
            case VIEW_MODES.TRASH:
                return "trash";
            case VIEW_MODES.DATE:
                return this._data.date || "date";
            case VIEW_MODES.RECENT:
                return "recent";
            case VIEW_MODES.HOME:
                return "home";
            case VIEW_MODES.IMPORT:
                return "import";
            case VIEW_MODES.PREFERENCES:
                return "preferences";
            case VIEW_MODES.JOB_QUEUE:
                return "job_queue";
            case VIEW_MODES.LOGIN:
                return "login";
            default:
                return this._mode;
        }
    }

    // Loading function determination
    getLoaderFunction(loaderMap) {
        if (!loaderMap || typeof loaderMap !== 'object') {
            return null;
        }
        
        return loaderMap[this._mode] || null;
    }

    // Screen visibility determination
    getScreenVisibility() {
        return {
            showImporter: this.isImportMode(),
            showPhotosList: this.showsPhotosList(),
            showSearchPage: this.isSearchMode(),
            showAlbumsList: this.isAlbumListMode(),
            showTagsList: this.isTagListMode(),
            showPreferences: this.isPreferencesMode(),
            showJobQueue: this.isJobQueueMode(),
            showLogin: this.isLoginMode(),
            showHome: this.isHomeMode()
        };
    }

    // Context-specific data extraction
    getCurrentAlbumId() {
        return this.isAlbumMode() ? this._data.albumId || null : null;
    }

    getCurrentTagId() {
        return this.isTagMode() ? this._data.tagId || null : null;
    }

    getCurrentDate() {
        return this.isDateMode() ? this._data.date || null : null;
    }

    getSearchQuery() {
        return this.isSearchMode() ? this._data.searchQuery || "" : "";
    }

    // UI state methods
    shouldShowAlbumTab() {
        return this.isAlbumMode();
    }

    shouldShowSearchTools() {
        return this.isSearchMode();
    }

    shouldShowTrashOperations() {
        return this.isTrashMode();
    }

    // Operations available in current mode
    getAvailableOperations() {
        const operations = {
            canSelectPhotos: this.isPhotoViewingMode(),
            canCreateAlbum: this.isPhotoViewingMode(),
            canAddToAlbum: this.isPhotoViewingMode(),
            canRemoveFromAlbum: this.isAlbumMode(),
            canUploadToGoogle: this.isPhotoViewingMode(),
            canDeleteFiles: this.isPhotoViewingMode() && !this.isTrashMode(),
            canRestoreFiles: this.isTrashMode(),
            canPermanentDelete: this.isTrashMode(),
            canEditTags: this.isPhotoViewingMode(),
            canEditRatings: this.isPhotoViewingMode(),
            canViewEXIF: this.isPhotoViewingMode(),
            canSearch: !this.isListMode() && !this.isImportMode() && !this.isPreferencesMode(),
            canNavigatePhotos: this.isPhotoViewingMode()
        };

        return operations;
    }

    /**
     * Generate parameters for get_photos_unified (absorbs fetchConfig role)
     */
    getUnifiedPhotoParams(appConfig, additionalParams = {}) {
        const baseParams = {
            type: "search",
            sort_value: additionalParams.sort_value || 0,
            page: additionalParams.page || 1,
            limit: additionalParams.limit || appConfig?.max_photos_per_fetch || 1000,
            offset: additionalParams.offset || 0,
            star: additionalParams.star || -1,
            has_comment: additionalParams.has_comment || false,
            extension: additionalParams.extension || "all"
        };

        switch (this._mode) {
            case VIEW_MODES.DATE:
                return { ...baseParams, search_type: "date", query: this._data.date };
            case VIEW_MODES.RECENT:
                return { ...baseParams, search_type: "recent" };
            case VIEW_MODES.ALBUM:
                return { ...baseParams, search_type: "album_photos", params: { album_id: this._data.albumId } };
            case VIEW_MODES.ALBUM_LIST:
                return { ...baseParams, search_type: "all_albums" };
            case VIEW_MODES.TAG:
                return { ...baseParams, search_type: "tag", query: this._data.tagId?.toString() };
            case VIEW_MODES.TAG_LIST:
                return { ...baseParams, search_type: "all_tags_with_count" };
            case VIEW_MODES.SEARCH:
            case VIEW_MODES.ADVANCED_SEARCH:
                return { ...baseParams, search_type: "search", query: this._data.searchQuery, params: this._data.searchParams };
            case VIEW_MODES.TRASH:
                return { ...baseParams, search_type: "trash" };
            default:
                throw new Error(`No photo params defined for mode: ${this._mode}`);
        }
    }

    /**
     * Get UI display title (absorbs fetchConfig.title role)
     */
    getModeTitle() {
        switch (this._mode) {
            case VIEW_MODES.ALBUM_LIST: return 'Albums';
            case VIEW_MODES.TAG_LIST: return 'Tags';
            case VIEW_MODES.TRASH: return 'Trash';
            case VIEW_MODES.SEARCH: return 'Search Results';
            case VIEW_MODES.ADVANCED_SEARCH: return 'Advanced Search';
            case VIEW_MODES.DATE: return this._data.date || 'Photos';
            case VIEW_MODES.RECENT: return 'Recent Photos';
            case VIEW_MODES.ALBUM: return this._data.albumName || 'Album';
            case VIEW_MODES.TAG: return this._data.tagName || 'Tag';
            case VIEW_MODES.HOME: return 'Home';
            case VIEW_MODES.IMPORT: return 'Import';
            case VIEW_MODES.PREFERENCES: return 'Preferences';
            case VIEW_MODES.JOB_QUEUE: return 'Job Queue';
            case VIEW_MODES.LOGIN: return 'Login';
            default: return 'Photos';
        }
    }

    /**
     * Get mode-specific configuration
     */
    getModeConfig() {
        return {
            showCreateButton: this.isAlbumListMode() || this.isTagListMode(),
            showSearchBar: this.isSearchMode(),
            allowSelection: this.isPhotoViewingMode(),
            showMetadata: this.isPhotoViewingMode(),
            showTrashOperations: this.isTrashMode(),
            showAlbumOperations: this.isAlbumMode(),
            showImportOperations: this.isImportMode(),
            enablePhotoNavigation: this.isPhotoViewingMode(),
            showBulkOperations: this.isPhotoViewingMode() || this.isListMode()
        };
    }

    // Filter parameters for photo fetching
    getFilterParams(appConfig = null) {
        const baseParams = {};

        switch (this._mode) {
            case VIEW_MODES.DATE:
                return {
                    ...baseParams,
                    date: this._data.date,
                    fetch_method: 'date'
                };
            case VIEW_MODES.RECENT:
                return {
                    ...baseParams,
                    fetch_method: 'recent',
                    limit: appConfig?.max_photos_per_fetch || 1000
                };
            case VIEW_MODES.SEARCH:
                return {
                    ...baseParams,
                    search_query: this._data.searchQuery,
                    fetch_method: 'search'
                };
            case VIEW_MODES.ADVANCED_SEARCH:
                return {
                    ...baseParams,
                    ...this._data.filters,
                    fetch_method: 'advanced_search'
                };
            case VIEW_MODES.ALBUM:
                return {
                    ...baseParams,
                    album_id: this._data.albumId,
                    fetch_method: 'album'
                };
            case VIEW_MODES.TAG:
                return {
                    ...baseParams,
                    tag_id: this._data.tagId,
                    fetch_method: 'tag'
                };
            case VIEW_MODES.TRASH:
                return {
                    ...baseParams,
                    fetch_method: 'trash'
                };
            case VIEW_MODES.ALBUM_LIST:
                return {
                    ...baseParams,
                    fetch_method: 'albums'
                };
            case VIEW_MODES.TAG_LIST:
                return {
                    ...baseParams,
                    fetch_method: 'tags'
                };
            default:
                return baseParams;
        }
    }

    // Create new ViewMode with updated data (immutable update)
    withData(newData) {
        return new ViewMode(this._mode, { ...this._data, ...newData });
    }

    // Create new ViewMode with different mode
    transitionTo(newMode, newData = {}) {
        return new ViewMode(newMode, newData);
    }

    // Equality comparison
    equals(other) {
        if (!(other instanceof ViewMode)) {
            return false;
        }
        
        return this._mode === other._mode && 
               JSON.stringify(this._data) === JSON.stringify(other._data);
    }

    // String representation
    toString() {
        const dataStr = Object.keys(this._data).length > 0 
            ? ` (${Object.entries(this._data).map(([k, v]) => `${k}=${v}`).join(', ')})`
            : '';
        return `ViewMode[${this._mode}${dataStr}]`;
    }

    // Validation methods
    static isValid(mode) {
        return Object.values(VIEW_MODES).includes(mode);
    }

    static fromString(modeString, data = {}) {
        if (!ViewMode.isValid(modeString)) {
            throw new Error(`Invalid view mode string: ${modeString}`);
        }
        return new ViewMode(modeString, data);
    }

    // Factory methods for common modes
    static home() {
        return new ViewMode(VIEW_MODES.HOME);
    }

    static date(date) {
        return new ViewMode(VIEW_MODES.DATE, { date });
    }

    static recent() {
        return new ViewMode(VIEW_MODES.RECENT);
    }

    static search(searchQuery = "", isAdvanced = false) {
        const mode = isAdvanced ? VIEW_MODES.ADVANCED_SEARCH : VIEW_MODES.SEARCH;
        return new ViewMode(mode, { searchQuery, isAdvanced });
    }

    static album(albumId) {
        return new ViewMode(VIEW_MODES.ALBUM, { albumId });
    }

    static albumList() {
        return new ViewMode(VIEW_MODES.ALBUM_LIST);
    }

    static tag(tagId) {
        return new ViewMode(VIEW_MODES.TAG, { tagId });
    }

    static tagList() {
        return new ViewMode(VIEW_MODES.TAG_LIST);
    }

    static trash() {
        return new ViewMode(VIEW_MODES.TRASH);
    }

    // DirectoryMenu UI display conditions
    shouldShowDirectoryTab() {
        return this.isImportMode();
    }

    shouldShowSelectionTab() {
        return this.isPhotoViewingMode() || this.isListMode();
    }

    shouldShowImportOperations() {
        return this.isImportMode();
    }

    shouldShowAlbumOperations() {
        return this.isAlbumMode() && !this.isImportMode();
    }

    shouldShowStandardOperations() {
        return !this.isImportMode();
    }

    shouldShowPhotoSelection() {
        return !this.isAlbumListMode() && !this.isTagListMode();
    }

    shouldShowAlbumSelection() {
        return this.isAlbumListMode();
    }

    shouldShowTagSelection() {
        return this.isTagListMode();
    }

    shouldShowImportProgress() {
        return this.isImportMode();
    }

    /**
     * Get empty state message for when no photos are found
     * @returns {string} The appropriate message based on current view mode
     */
    getEmptyStateMessage() {
        switch (this._mode) {
            case VIEW_MODES.SEARCH:
            case VIEW_MODES.ADVANCED_SEARCH:
                return "No Search Result";
            case VIEW_MODES.ALBUM:
                const albumName = this._data.albumName || 'Unknown Album';
                return `No photos in album: ${albumName}`;
            case VIEW_MODES.TAG:
                const tagName = this._data.tagName || 'Unknown Tag';
                return `No photos with tag: ${tagName}`;
            case VIEW_MODES.TRASH:
                return "Trash is empty";
            case VIEW_MODES.DATE:
                return "No photos found for this date";
            case VIEW_MODES.RECENT:
                return "No recent photos";
            case VIEW_MODES.IMPORT:
                return "No photos to import";
            default:
                return "No Photo Found!";
        }
    }

    /**
     * Get back navigation info for empty states
     * Returns null if no back navigation should be shown
     */
    getBackNavigationInfo() {
        switch (this._mode) {
            case VIEW_MODES.SEARCH:
            case VIEW_MODES.ADVANCED_SEARCH:
                return {
                    label: "Back to HOME",
                    action: "clearSearch"
                };
            case VIEW_MODES.ALBUM:
                return {
                    label: "Back to Album List",
                    action: "toggleAlbumListMode"
                };
            case VIEW_MODES.TAG:
                return {
                    label: "Back to Tag List",
                    action: "openTagsList"
                };
            case VIEW_MODES.TRASH:
                return {
                    label: "Back to HOME",
                    action: "toggleHome"
                };
            default:
                return null; // No back navigation for other modes
        }
    }

    // Operation-specific display methods
    showImportSelected() {
        return this.isImportMode();
    }

    showSelectAllInDirectory() {
        return this.isImportMode();
    }

    showSelectAllInPage() {
        return this.isImportMode();
    }

    showRemoveFromAlbum() {
        return this.isAlbumMode() && !this.isImportMode();
    }

    showUploadToGooglePhotos() {
        return !this.isImportMode() && !this.isTrashMode();
    }

    showDeleteFiles() {
        return !this.isImportMode() && !this.isTrashMode();
    }

    showPermanentDelete() {
        return this.isTrashMode();
    }

    showRestoreFromTrash() {
        return this.isTrashMode();
    }

    showCreateAlbum() {
        return !this.isImportMode() && !this.isTrashMode();
    }

    showAddToAlbum() {
        return !this.isImportMode() && !this.isTrashMode();
    }

    showEditTags() {
        return !this.isImportMode();
    }

    showEditRatings() {
        return !this.isImportMode();
    }

    showViewEXIF() {
        return !this.isImportMode();
    }
}

export default ViewMode;