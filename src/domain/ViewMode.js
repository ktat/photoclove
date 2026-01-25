/**
 * ViewMode Domain Value Object
 * Encapsulates view mode behavior and domain logic using Domain-Driven Design principles.
 */

import { VIEW_MODES } from '../constants/viewModes.js';

/**
 * ViewMode Value Object - Immutable value object that encapsulates view mode state and behavior
 */
export class ViewMode {
    constructor(mode, data = {}) {
        if (!Object.values(VIEW_MODES).includes(mode)) {
            throw new Error(`Invalid view mode: ${mode}`);
        }
        this._mode = mode;
        this._data = { ...data };
        Object.freeze(this);
    }

    get mode() { return this._mode; }
    get data() { return { ...this._data }; }

    // Mode checking methods
    isAlbumMode() { return this._mode === VIEW_MODES.ALBUM; }
    isAlbumListMode() { return this._mode === VIEW_MODES.ALBUM_LIST; }
    isTagMode() { return this._mode === VIEW_MODES.TAG; }
    isTagListMode() { return this._mode === VIEW_MODES.TAG_LIST; }
    isSearchMode() { return this._mode === VIEW_MODES.SEARCH; }
    isAdvancedSearchMode() { return this._mode === VIEW_MODES.SEARCH; }
    isTrashMode() { return this._mode === VIEW_MODES.TRASH; }
    isDateMode() { return this._mode === VIEW_MODES.DATE; }
    isRecentMode() { return this._mode === VIEW_MODES.RECENT; }
    isHomeMode() { return this._mode === VIEW_MODES.HOME; }
    isImportMode() { return this._mode === VIEW_MODES.IMPORT; }
    isPreferencesMode() { return this._mode === VIEW_MODES.PREFERENCES; }
    isJobQueueMode() { return this._mode === VIEW_MODES.JOB_QUEUE; }
    isLoginMode() { return this._mode === VIEW_MODES.LOGIN; }
    isInBurstGroupMode() { return this._mode === VIEW_MODES.IN_BURST_GROUP; }
    isFaceListMode() { return this._mode === VIEW_MODES.FACE_LIST; }
    isPersonMode() { return this._mode === VIEW_MODES.PERSON; }

    // Complex mode categories
    isPhotoViewingMode() {
        return [VIEW_MODES.DATE, VIEW_MODES.RECENT, VIEW_MODES.SEARCH, VIEW_MODES.ALBUM,
                VIEW_MODES.TAG, VIEW_MODES.PERSON, VIEW_MODES.TRASH, VIEW_MODES.IN_BURST_GROUP].includes(this._mode);
    }

    isListMode() {
        return [VIEW_MODES.ALBUM_LIST, VIEW_MODES.TAG_LIST, VIEW_MODES.FACE_LIST].includes(this._mode);
    }

    usesPhotosList() { return this.isPhotoViewingMode() || this.isListMode(); }

    showsPhotosList() {
        return [VIEW_MODES.DATE, VIEW_MODES.RECENT, VIEW_MODES.ALBUM, VIEW_MODES.ALBUM_LIST,
                VIEW_MODES.TAG, VIEW_MODES.TAG_LIST, VIEW_MODES.FACE_LIST, VIEW_MODES.PERSON,
                VIEW_MODES.TRASH, VIEW_MODES.IN_BURST_GROUP].includes(this._mode);
    }

    // Data attribute generation for component identification
    getDataAttribute() {
        switch (this._mode) {
            case VIEW_MODES.SEARCH: return "search_results";
            case VIEW_MODES.ALBUM_LIST: return "albums";
            case VIEW_MODES.ALBUM: return this._data.albumId ? `album_${this._data.albumId}` : "album";
            case VIEW_MODES.TAG_LIST: return "tags";
            case VIEW_MODES.TAG: return this._data.tagId ? `tag_${this._data.tagId}` : "tag";
            case VIEW_MODES.FACE_LIST: return "faces";
            case VIEW_MODES.PERSON: return this._data.personId ? `person_${this._data.personId}` : "person";
            case VIEW_MODES.TRASH: return "trash";
            case VIEW_MODES.DATE: return this._data.date || "date";
            case VIEW_MODES.RECENT: return "recent";
            case VIEW_MODES.HOME: return "home";
            case VIEW_MODES.IMPORT: return "import";
            case VIEW_MODES.PREFERENCES: return "preferences";
            case VIEW_MODES.JOB_QUEUE: return "job_queue";
            case VIEW_MODES.LOGIN: return "login";
            default: return this._mode;
        }
    }

    // Loading function determination
    getLoaderFunction(loaderMap) {
        if (!loaderMap || typeof loaderMap !== 'object') return null;
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
            showFacesList: this.isFaceListMode(),
            showPreferences: this.isPreferencesMode(),
            showJobQueue: this.isJobQueueMode(),
            showLogin: this.isLoginMode(),
            showHome: this.isHomeMode()
        };
    }

    // Context-specific data extraction
    getCurrentAlbumId() {
        if (this.isAlbumMode()) return this._data.albumId || null;
        // In burst group mode, return albumId from return mode data if opened from album
        if (this.isInBurstGroupMode() && this._data.returnMode === VIEW_MODES.ALBUM) {
            return this._data.returnModeData?.albumId || null;
        }
        return null;
    }

    getCurrentTagId() {
        if (this.isTagMode()) return this._data.tagId || null;
        // In burst group mode, return tagId from return mode data if opened from tag
        if (this.isInBurstGroupMode() && this._data.returnMode === VIEW_MODES.TAG) {
            return this._data.returnModeData?.tagId || null;
        }
        return null;
    }

    getCurrentPersonId() {
        if (this.isPersonMode()) return this._data.personId || null;
        return null;
    }

    getCurrentPersonName() {
        if (this.isPersonMode()) return this._data.personName || null;
        return null;
    }

    getCurrentDate() {
        return this.isDateMode() ? this._data.date || null : null;
    }

    getSearchQuery() {
        return this.isSearchMode() ? this._data.searchQuery || "" : "";
    }

    // Collection abstraction (Album or Tag)
    getCollectionId() {
        if (this.isAlbumMode()) return this._data.albumId || null;
        if (this.isTagMode()) return this._data.tagId || null;
        return null;
    }

    getCollectionName() {
        if (this.isAlbumMode()) return this._data.albumName || null;
        if (this.isTagMode()) return this._data.tagName || null;
        // In burst group mode, return collection name from return mode data
        if (this.isInBurstGroupMode()) {
            if (this._data.returnMode === VIEW_MODES.ALBUM) return this._data.returnModeData?.albumName || null;
            if (this._data.returnMode === VIEW_MODES.TAG) return this._data.returnModeData?.tagName || null;
        }
        return null;
    }

    getCollectionType() {
        if (this.isAlbumMode()) return 'album';
        if (this.isTagMode()) return 'tag';
        return null;
    }

    // UI state methods
    shouldShowAlbumTab() { return this.isAlbumMode(); }
    shouldShowSearchTools() { return this.isSearchMode(); }
    shouldShowTrashOperations() { return this.isTrashMode(); }
    shouldShowMaintenanceTab() { return this.isDateMode(); }

    // Operations available in current mode
    getAvailableOperations() {
        return {
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
    }

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
        const burstModeEnabled = additionalParams.burstModeEnabled || false;

        switch (this._mode) {
            case VIEW_MODES.DATE:
                return { ...baseParams, search_type: burstModeEnabled ? "burst_date" : "date", query: this._data.date };
            case VIEW_MODES.RECENT:
                return { ...baseParams, search_type: "recent" };
            case VIEW_MODES.ALBUM:
                return { ...baseParams, search_type: burstModeEnabled ? "burst_album" : "album_photos", params: { album_id: this._data.albumId } };
            case VIEW_MODES.ALBUM_LIST:
                return { ...baseParams, search_type: "all_albums" };
            case VIEW_MODES.TAG:
                return { ...baseParams, search_type: burstModeEnabled ? "burst_tag" : "tag", query: this._data.tagId?.toString() };
            case VIEW_MODES.TAG_LIST:
                return { ...baseParams, search_type: "all_tags" };
            case VIEW_MODES.FACE_LIST:
                return { ...baseParams, search_type: "all_persons" };
            case VIEW_MODES.PERSON:
                return { ...baseParams, search_type: "person_photos", params: { person_id: this._data.personId } };
            case VIEW_MODES.SEARCH:
                return { ...baseParams, search_type: "search", query: this._data.searchQuery, params: this._data.searchParams };
            case VIEW_MODES.TRASH:
                return { ...baseParams, search_type: "trash" };
            case VIEW_MODES.IMPORT:
                throw new Error(`IMPORT mode uses ImportState.changeDirectory(), not get_photos_unified`);
            case VIEW_MODES.IN_BURST_GROUP:
                return { ...baseParams, search_type: "burst_group", query: this._data.burstGroupId };
            default:
                throw new Error(`No photo params defined for mode: ${this._mode}`);
        }
    }

    getModeTitle() {
        switch (this._mode) {
            case VIEW_MODES.ALBUM_LIST: return 'Albums';
            case VIEW_MODES.TAG_LIST: return 'Tags';
            case VIEW_MODES.FACE_LIST: return 'Faces';
            case VIEW_MODES.PERSON: return this._data.personName || 'Person';
            case VIEW_MODES.TRASH: return 'Trash';
            case VIEW_MODES.SEARCH: return 'Search';
            case VIEW_MODES.DATE: return this._data.date || 'Photos';
            case VIEW_MODES.RECENT: return 'Recent Photos';
            case VIEW_MODES.ALBUM: return this._data.albumName || 'Album';
            case VIEW_MODES.TAG: return this._data.tagName || 'Tag';
            case VIEW_MODES.HOME: return 'Home';
            case VIEW_MODES.IMPORT: return 'Import';
            case VIEW_MODES.PREFERENCES: return 'Preferences';
            case VIEW_MODES.JOB_QUEUE: return 'Job Queue';
            case VIEW_MODES.LOGIN: return 'Login';
            case VIEW_MODES.IN_BURST_GROUP:
                // Show album/tag name from return mode data or fallback
                if (this._data.albumName) return `${this._data.albumName} (Burst Group)`;
                if (this._data.tagName) return `${this._data.tagName} (Burst Group)`;
                if (this._data.returnModeData?.albumName) return `${this._data.returnModeData.albumName} (Burst Group)`;
                if (this._data.returnModeData?.tagName) return `${this._data.returnModeData.tagName} (Burst Group)`;
                return 'Burst Group';
            default: return 'Photos';
        }
    }

    getModeConfig() {
        return {
            showCreateButton: this.isAlbumListMode() || this.isTagListMode(),
            showSearchBar: this.isSearchMode(),
            allowSelection: this.isPhotoViewingMode(),
            canViewMetadata: this.isPhotoViewingMode(),
            showTrashOperations: this.isTrashMode(),
            showAlbumOperations: this.isAlbumMode(),
            showPersonOperations: this.isPersonMode(),
            showImportOperations: this.isImportMode(),
            enablePhotoNavigation: this.isPhotoViewingMode(),
            showBulkOperations: this.isPhotoViewingMode() || this.isListMode(),
            canEdit: !this.isTrashMode() && !this.isImportMode()
        };
    }

    shouldShowSideMenuByDefault() {
        const config = this.getModeConfig();
        return config.canEdit && (this.isSearchMode() || this.isImportMode());
    }

    getFilterParams(appConfig = null) {
        const baseParams = {};
        switch (this._mode) {
            case VIEW_MODES.DATE:
                return { ...baseParams, date: this._data.date, fetch_method: 'date' };
            case VIEW_MODES.RECENT:
                return { ...baseParams, fetch_method: 'recent', limit: appConfig?.max_photos_per_fetch || 1000 };
            case VIEW_MODES.SEARCH:
                return { ...baseParams, search_query: this._data.searchQuery, ...this._data.filters, fetch_method: 'search' };
            case VIEW_MODES.ALBUM:
                return { ...baseParams, album_id: this._data.albumId, fetch_method: 'album' };
            case VIEW_MODES.TAG:
                return { ...baseParams, tag_id: this._data.tagId, fetch_method: 'tag' };
            case VIEW_MODES.TRASH:
                return { ...baseParams, fetch_method: 'trash' };
            case VIEW_MODES.ALBUM_LIST:
                return { ...baseParams, fetch_method: 'albums' };
            case VIEW_MODES.TAG_LIST:
                return { ...baseParams, fetch_method: 'tags' };
            case VIEW_MODES.FACE_LIST:
                return { ...baseParams, fetch_method: 'faces' };
            case VIEW_MODES.PERSON:
                return { ...baseParams, person_id: this._data.personId, fetch_method: 'person' };
            default:
                return baseParams;
        }
    }

    withData(newData) { return new ViewMode(this._mode, { ...this._data, ...newData }); }
    transitionTo(newMode, newData = {}) { return new ViewMode(newMode, newData); }

    equals(other) {
        if (!(other instanceof ViewMode)) return false;
        return this._mode === other._mode && JSON.stringify(this._data) === JSON.stringify(other._data);
    }

    toString() {
        const dataStr = Object.keys(this._data).length > 0
            ? ` (${Object.entries(this._data).map(([k, v]) => `${k}=${v}`).join(', ')})`
            : '';
        return `ViewMode[${this._mode}${dataStr}]`;
    }

    static isValid(mode) { return Object.values(VIEW_MODES).includes(mode); }

    static fromString(modeString, data = {}) {
        if (!ViewMode.isValid(modeString)) throw new Error(`Invalid view mode string: ${modeString}`);
        return new ViewMode(modeString, data);
    }

    // Factory methods for common modes
    static home() { return new ViewMode(VIEW_MODES.HOME); }
    static date(date) { return new ViewMode(VIEW_MODES.DATE, { date }); }
    static recent() { return new ViewMode(VIEW_MODES.RECENT); }
    static search(searchQuery = "", isAdvanced = false) { return new ViewMode(VIEW_MODES.SEARCH, { searchQuery, isAdvanced }); }
    static album(albumId) { return new ViewMode(VIEW_MODES.ALBUM, { albumId }); }
    static albumList() { return new ViewMode(VIEW_MODES.ALBUM_LIST); }
    static tag(tagId) { return new ViewMode(VIEW_MODES.TAG, { tagId }); }
    static tagList() { return new ViewMode(VIEW_MODES.TAG_LIST); }
    static faceList() { return new ViewMode(VIEW_MODES.FACE_LIST); }
    static person(personId, personName = null) { return new ViewMode(VIEW_MODES.PERSON, { personId, personName }); }
    static trash() { return new ViewMode(VIEW_MODES.TRASH); }

    // DirectoryMenu UI display conditions
    shouldShowDirectoryTab() { return this.isImportMode(); }
    shouldShowSelectionTab() { return this.isPhotoViewingMode() || this.isListMode(); }
    shouldShowImportOperations() { return this.isImportMode(); }
    shouldShowAlbumOperations() { return this.isAlbumMode() && !this.isImportMode(); }
    shouldShowTagOperations() { return this.isTagMode() && !this.isImportMode(); }
    shouldShowPersonOperations() { return this.isPersonMode() && !this.isImportMode(); }
    shouldShowStandardOperations() { return !this.isImportMode(); }
    shouldShowPhotoSelection() { return !this.isAlbumListMode() && !this.isTagListMode() && !this.isFaceListMode(); }
    shouldShowAlbumSelection() { return this.isAlbumListMode(); }
    shouldShowTagSelection() { return this.isTagListMode(); }
    shouldShowFaceSelection() { return this.isFaceListMode(); }
    shouldShowImportProgress() { return this.isImportMode(); }

    getEmptyStateMessage() {
        switch (this._mode) {
            case VIEW_MODES.SEARCH: return "No Search Result";
            case VIEW_MODES.ALBUM:
                return `No photos in album: ${this._data.albumName || 'Unknown Album'}`;
            case VIEW_MODES.TAG:
                return `No photos with tag: ${this._data.tagName || 'Unknown Tag'}`;
            case VIEW_MODES.FACE_LIST: return "No faces detected yet";
            case VIEW_MODES.PERSON:
                return `No photos for person: ${this._data.personName || 'Unknown Person'}`;
            case VIEW_MODES.TRASH: return "Trash is empty";
            case VIEW_MODES.DATE: return "No photos found for this date";
            case VIEW_MODES.RECENT: return "No recent photos";
            case VIEW_MODES.IMPORT: return "No photos to import";
            default: return "No Photo Found!";
        }
    }

    getBackNavigationInfo() {
        switch (this._mode) {
            case VIEW_MODES.ALBUM: return { label: "Back to Album List", action: "toggleAlbumListMode" };
            case VIEW_MODES.TAG: return { label: "Back to Tag List", action: "openTagsList" };
            case VIEW_MODES.PERSON: return { label: "Back to Faces List", action: "openFacesList" };
            case VIEW_MODES.TRASH: return { label: "Back to HOME", action: "toggleHome" };
            default: return null;
        }
    }

    // Operation-specific display methods
    showImportSelected() { return this.isImportMode(); }
    showSelectAllInDirectory() { return this.isImportMode(); }
    showSelectAllInPage() { return this.isImportMode(); }
    showRemoveFromAlbum() { return this.isAlbumMode() && !this.isImportMode(); }
    showRemoveFromTag() { return this.isTagMode() && !this.isImportMode(); }
    showUploadToGooglePhotos() { return !this.isImportMode() && !this.isTrashMode(); }
    showDeleteFiles() { return !this.isImportMode() && !this.isTrashMode(); }
    showPermanentDelete() { return this.isTrashMode(); }
    showRestoreFromTrash() { return this.isTrashMode(); }
    showCreateAlbum() { return !this.isImportMode() && !this.isTrashMode(); }
    showAddToAlbum() { return !this.isImportMode() && !this.isTrashMode(); }
    showAddTags() { return !this.isImportMode() && !this.isTrashMode(); }
    showEditTags() { return !this.isImportMode(); }
    showEditRatings() { return !this.isImportMode(); }
    showViewEXIF() { return !this.isImportMode(); }

    // Burst group operations
    showBurstGroupOperations() { return !this.isImportMode() && !this.isTrashMode() && !this.isListMode(); }
    showCreateBurstGroup() { return this.showBurstGroupOperations(); }
    showRemoveFromBurstGroup() { return this.isInBurstGroupMode(); }
}

export default ViewMode;
