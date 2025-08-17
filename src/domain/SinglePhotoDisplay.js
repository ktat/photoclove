/**
 * SinglePhotoDisplay - Domain object representing single photo display state
 */
export class SinglePhotoDisplay {
    constructor(photo, collection, currentIndex = 0) {
        this.photo = photo;
        this.collection = collection; // Parent PhotoCollection
        this.currentIndex = currentIndex;
    }

    /**
     * Get navigation info
     */
    getNavigationInfo() {
        const totalPhotos = this.collection.photos.length;
        return {
            currentIndex: this.currentIndex,
            totalPhotos,
            hasNext: this.currentIndex < totalPhotos - 1,
            hasPrev: this.currentIndex > 0,
            canNavigate: totalPhotos > 1
        };
    }

    /**
     * Navigate to next photo
     */
    next() {
        const nav = this.getNavigationInfo();
        if (nav.hasNext) {
            const nextPhoto = this.collection.photos[this.currentIndex + 1];
            return new SinglePhotoDisplay(nextPhoto, this.collection, this.currentIndex + 1);
        }
        return this;
    }

    /**
     * Navigate to previous photo
     */
    previous() {
        const nav = this.getNavigationInfo();
        if (nav.hasPrev) {
            const prevPhoto = this.collection.photos[this.currentIndex - 1];
            return new SinglePhotoDisplay(prevPhoto, this.collection, this.currentIndex - 1);
        }
        return this;
    }

    /**
     * Get keyboard shortcuts for single photo mode
     */
    getKeyboardShortcuts() {
        const baseShortcuts = {
            'Escape': 'Return to photo list',
            'ArrowLeft': 'Previous photo',
            'ArrowRight': 'Next photo',
            'ArrowUp': 'Show thumbnails',
            'ArrowDown': 'Hide thumbnails',
            'f': 'Toggle favorite',
            's': 'Toggle selection',
            '1-5': 'Set star rating',
            '?': 'Show help',
            'Space': 'Toggle info panel'
        };

        // Mode-specific shortcuts from collection
        const collectionShortcuts = this.collection.getKeyboardShortcuts();
        
        // Override or add mode-specific shortcuts
        const modeSpecificShortcuts = {
            album: {
                'Delete': 'Remove from album',
                'Ctrl+Delete': 'Delete file permanently'
            },
            trash: {
                'Delete': 'Delete permanently',
                'r': 'Restore from trash'
            }
        };

        return {
            ...baseShortcuts,
            ...collectionShortcuts,
            ...(modeSpecificShortcuts[this.collection.mode] || {})
        };
    }

    /**
     * Get available actions for current photo
     */
    getAvailableActions() {
        const baseActions = [
            { id: 'star', label: 'Star Rating', icon: '⭐' },
            { id: 'select', label: 'Select/Deselect', icon: '☑️' },
            { id: 'comment', label: 'Add Comment', icon: '💬' },
            { id: 'copy_path', label: 'Copy Path', icon: '📋' },
            { id: 'open_location', label: 'Open Location', icon: '📁' }
        ];

        const modeSpecificActions = {
            album: [
                { id: 'remove_from_album', label: 'Remove from Album', icon: '➖' },
                { id: 'delete_file', label: 'Delete File', icon: '🗑️' }
            ],
            trash: [
                { id: 'restore', label: 'Restore', icon: '↩️' },
                { id: 'delete_permanently', label: 'Delete Permanently', icon: '💀' }
            ],
            date: [
                { id: 'move_to_trash', label: 'Move to Trash', icon: '🗑️' },
                { id: 'add_to_album', label: 'Add to Album', icon: '📚' }
            ]
        };

        return [
            ...baseActions,
            ...(modeSpecificActions[this.collection.mode] || [])
        ];
    }

    /**
     * Get display title for single photo mode
     */
    getDisplayTitle() {
        const nav = this.getNavigationInfo();
        const collectionTitle = this.collection.getTitle();
        return `${this.photo.name} (${nav.currentIndex + 1}/${nav.totalPhotos}) - ${collectionTitle}`;
    }

    /**
     * Get info panel data
     */
    getInfoPanelData() {
        return {
            fileName: this.photo.name,
            filePath: this.photo.originalPath,
            displayPath: this.photo.displayPath(),
            star: this.photo.star,
            comment: this.photo.comment,
            hasComment: !!this.photo.comment,
            isVideo: this.photo.isVideo(),
            extension: this.photo.getExtension(),
            inTrash: this.photo.inTrashBin,
            inAlbum: this.photo.inAlbum,
            albumId: this.photo.albumId,
            collectionMode: this.collection.mode,
            collectionTitle: this.collection.getTitle()
        };
    }

    /**
     * Update current photo
     */
    withPhoto(updatedPhoto) {
        // Also update the photo in the collection
        const updatedPhotos = this.collection.photos.map((photo, index) => 
            index === this.currentIndex ? updatedPhoto : photo
        );
        const updatedCollection = this.collection.withPhotos(updatedPhotos);
        
        return new SinglePhotoDisplay(updatedPhoto, updatedCollection, this.currentIndex);
    }

    /**
     * Get thumbnail navigation data
     */
    getThumbnailNavigation() {
        const visibleRange = 10; // Show 10 thumbnails at a time
        const startIndex = Math.max(0, this.currentIndex - Math.floor(visibleRange / 2));
        const endIndex = Math.min(this.collection.photos.length, startIndex + visibleRange);
        
        return {
            visiblePhotos: this.collection.photos.slice(startIndex, endIndex),
            startIndex,
            endIndex,
            currentRelativeIndex: this.currentIndex - startIndex,
            canScrollLeft: startIndex > 0,
            canScrollRight: endIndex < this.collection.photos.length
        };
    }

    /**
     * Factory method to create from collection and index
     */
    static fromCollection(collection, index = 0) {
        if (!collection.photos || collection.photos.length === 0) {
            return null;
        }
        
        const safeIndex = Math.max(0, Math.min(index, collection.photos.length - 1));
        const photo = collection.photos[safeIndex];
        
        return new SinglePhotoDisplay(photo, collection, safeIndex);
    }
}