/**
 * useViewModeHelpers - Hook for ViewMode-related helper functions
 *
 * Provides computed properties and helper functions based on the current
 * ViewMode, reducing duplicate logic across components.
 */
import { useMemo, useCallback } from 'react';

/**
 * Hook for ViewMode helper functions and computed properties
 *
 * @param {ViewMode} viewModeObj - The ViewMode instance
 * @returns {Object} Helper functions and computed properties
 */
export function useViewModeHelpers(viewModeObj) {
    /**
     * Whether the current mode is read-only (no modifications allowed)
     */
    const isReadOnlyMode = useMemo(() => {
        if (!viewModeObj) return false;
        return viewModeObj.isTrashMode() || viewModeObj.isImportMode();
    }, [viewModeObj]);

    /**
     * Whether photos can be added to albums in current mode
     */
    const canAddToAlbum = useMemo(() => {
        if (!viewModeObj) return false;
        return !viewModeObj.isTrashMode() && !viewModeObj.isImportMode();
    }, [viewModeObj]);

    /**
     * Whether photos can be added tags in current mode
     */
    const canAddTags = useMemo(() => {
        if (!viewModeObj) return false;
        return !viewModeObj.isTrashMode() && !viewModeObj.isImportMode();
    }, [viewModeObj]);

    /**
     * Whether photos can be deleted (moved to trash) in current mode
     */
    const canDelete = useMemo(() => {
        if (!viewModeObj) return false;
        return !viewModeObj.isTrashMode() && !viewModeObj.isImportMode();
    }, [viewModeObj]);

    /**
     * Whether photos can be permanently deleted in current mode
     */
    const canPermanentDelete = useMemo(() => {
        if (!viewModeObj) return true;
        return viewModeObj.isTrashMode();
    }, [viewModeObj]);

    /**
     * Whether photos can be restored in current mode
     */
    const canRestore = useMemo(() => {
        if (!viewModeObj) return false;
        return viewModeObj.isTrashMode();
    }, [viewModeObj]);

    /**
     * Whether the star rating can be modified in current mode
     */
    const canModifyStar = useMemo(() => {
        if (!viewModeObj) return false;
        return !viewModeObj.isTrashMode() && !viewModeObj.isImportMode();
    }, [viewModeObj]);

    /**
     * Whether comments can be modified in current mode
     */
    const canModifyComment = useMemo(() => {
        if (!viewModeObj) return false;
        return !viewModeObj.isTrashMode() && !viewModeObj.isImportMode();
    }, [viewModeObj]);

    /**
     * Whether the maintenance tab should be shown
     */
    const shouldShowMaintenanceTab = useMemo(() => {
        if (!viewModeObj) return false;
        return viewModeObj.shouldShowMaintenanceTab?.() || false;
    }, [viewModeObj]);

    /**
     * Whether the filter tab should be shown
     */
    const shouldShowFilterTab = useMemo(() => {
        if (!viewModeObj) return false;
        return viewModeObj.shouldShowFilterTab?.() || false;
    }, [viewModeObj]);

    /**
     * Get an appropriate empty state message based on current mode
     */
    const getEmptyMessage = useCallback(() => {
        if (!viewModeObj) return 'No photos';

        if (viewModeObj.isSearchMode()) return 'No search results found';
        if (viewModeObj.isTrashMode()) return 'Trash is empty';
        if (viewModeObj.isAlbumMode()) return 'No photos in this album';
        if (viewModeObj.isTagMode()) return 'No photos with this tag';
        if (viewModeObj.isAlbumListMode()) return 'No albums';
        if (viewModeObj.isTagListMode()) return 'No tags';
        if (viewModeObj.isImportMode()) return 'No photos to import';
        if (viewModeObj.isRecentMode()) return 'No recent photos';

        return 'No photos for this date';
    }, [viewModeObj]);

    /**
     * Get the display title for the current mode
     */
    const getModeTitle = useCallback(() => {
        if (!viewModeObj) return '';

        if (viewModeObj.isSearchMode()) return 'Search Results';
        if (viewModeObj.isTrashMode()) return 'Trash';
        if (viewModeObj.isAlbumMode()) return viewModeObj.getCollectionName() || 'Album';
        if (viewModeObj.isTagMode()) return viewModeObj.getCollectionName() || 'Tag';
        if (viewModeObj.isAlbumListMode()) return 'Albums';
        if (viewModeObj.isTagListMode()) return 'Tags';
        if (viewModeObj.isImportMode()) return 'Import';
        if (viewModeObj.isRecentMode()) return 'Recent Photos';

        return viewModeObj.date || 'Photos';
    }, [viewModeObj]);

    /**
     * Get available operations for the current mode
     */
    const getAvailableOperations = useMemo(() => {
        if (!viewModeObj) return [];

        const operations = [];

        if (canAddToAlbum) {
            operations.push('addToAlbum', 'createAlbum');
        }

        if (canAddTags) {
            operations.push('addTags');
        }

        if (canDelete) {
            operations.push('moveToTrash');
        }

        if (canPermanentDelete) {
            operations.push('permanentDelete');
        }

        if (canRestore) {
            operations.push('restore');
        }

        if (viewModeObj.isAlbumMode()) {
            operations.push('removeFromAlbum');
        }

        if (viewModeObj.isImportMode()) {
            operations.push('import');
        }

        // Upload to Google Photos is available except in trash/import
        if (!viewModeObj.isTrashMode() && !viewModeObj.isImportMode()) {
            operations.push('uploadToGooglePhotos');
        }

        return operations;
    }, [viewModeObj, canAddToAlbum, canAddTags, canDelete, canPermanentDelete, canRestore]);

    /**
     * Check if a specific operation is available
     */
    const isOperationAvailable = useCallback((operation) => {
        return getAvailableOperations.includes(operation);
    }, [getAvailableOperations]);

    /**
     * Get the current collection context (album or tag)
     */
    const getCollectionContext = useMemo(() => {
        if (!viewModeObj) return null;

        if (viewModeObj.isAlbumMode()) {
            return {
                type: 'album',
                id: viewModeObj.getCollectionId(),
                name: viewModeObj.getCollectionName()
            };
        }

        if (viewModeObj.isTagMode()) {
            return {
                type: 'tag',
                id: viewModeObj.getCollectionId(),
                name: viewModeObj.getCollectionName()
            };
        }

        return null;
    }, [viewModeObj]);

    return {
        // Computed properties
        isReadOnlyMode,
        canAddToAlbum,
        canAddTags,
        canDelete,
        canPermanentDelete,
        canRestore,
        canModifyStar,
        canModifyComment,
        shouldShowMaintenanceTab,
        shouldShowFilterTab,
        getAvailableOperations,
        getCollectionContext,

        // Helper functions
        getEmptyMessage,
        getModeTitle,
        isOperationAvailable
    };
}

export default useViewModeHelpers;
