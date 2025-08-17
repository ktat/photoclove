import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';

/**
 * Custom hook for managing photo operations (albums, tags, deletion)
 * Extracted from PhotosList.jsx to reduce component complexity
 */
export function usePhotoOperations({ 
    selectedAlbums, 
    setSelectedAlbums, 
    selectedTags, 
    setSelectedTags,
    handleError,
    addFooterMessage,
    loadAlbums,
    loadTags,
    currentAlbumId,
    toggleAlbumListMode,
    isTrashMode
}) {
    
    // Album selection handlers
    const handleAlbumSelection = useCallback((albumId, isSelected) => {
        logger.debug('PhotosList', 'album_selection_changed', 'Album selection changed', {
            albumId,
            isSelected,
            currentSelection: selectedAlbums.length
        });

        if (isSelected) {
            setSelectedAlbums(prev => [...prev, albumId]);
        } else {
            setSelectedAlbums(prev => prev.filter(id => id !== albumId));
        }
    }, [selectedAlbums.length, setSelectedAlbums]);

    const clearAlbumSelection = useCallback(() => {
        logger.debug('PhotosList', 'album_selection_cleared', 'Cleared album selection', {
            previousCount: selectedAlbums.length
        });
        setSelectedAlbums([]);
    }, [selectedAlbums.length, setSelectedAlbums]);

    // Tag selection handlers
    const handleTagSelection = useCallback((tagId, isSelected) => {
        logger.debug('PhotosList', 'tag_selection_changed', 'Tag selection changed', {
            tagId,
            isSelected,
            currentSelection: selectedTags.length
        });

        if (isSelected) {
            setSelectedTags(prev => [...prev, tagId]);
        } else {
            setSelectedTags(prev => prev.filter(id => id !== tagId));
        }
    }, [selectedTags.length, setSelectedTags]);

    const clearTagSelection = useCallback(() => {
        logger.debug('PhotosList', 'tag_selection_cleared', 'Cleared tag selection', {
            previousCount: selectedTags.length
        });
        setSelectedTags([]);
    }, [selectedTags.length, setSelectedTags]);

    // Delete selected albums
    const deleteSelectedAlbums = useCallback(async () => {
        if (selectedAlbums.length === 0) return;

        try {
            // Show async confirmation dialog before proceeding
            const confirmMessage = `Are you sure you want to delete ${selectedAlbums.length} album${selectedAlbums.length > 1 ? 's' : ''}?\n\nThis will remove ${selectedAlbums.length > 1 ? 'them' : 'it'} but keep all photos in your library.`;
            const confirmed = await confirm(confirmMessage, 'Delete Albums');
            
            if (!confirmed) {
                logger.info('PhotosList', 'delete_albums_cancelled', 'Album deletion cancelled by user', {
                    albumIds: selectedAlbums,
                    count: selectedAlbums.length
                });
                return;
            }

            logger.info('PhotosList', 'delete_albums_start', 'Deleting selected albums', {
                albumIds: selectedAlbums,
                count: selectedAlbums.length
            });

            for (const albumId of selectedAlbums) {
                await invoke("delete_album", { id: albumId });
            }

            // Clear the unified collection service cache to ensure other components refresh
            unifiedCollectionService.clearCache();
            
            // Refresh albums list and clear selection
            loadAlbums();
            clearAlbumSelection();

            addFooterMessage(`${selectedAlbums.length} album${selectedAlbums.length > 1 ? 's' : ''} deleted`);

            logger.info('PhotosList', 'albums_deleted', 'Albums deleted successfully', {
                count: selectedAlbums.length
            });
        } catch (error) {
            handleError(error, 'Delete albums', { albumIds: selectedAlbums });
        }
    }, [selectedAlbums, loadAlbums, clearAlbumSelection, addFooterMessage, handleError]);

    // Delete selected tags
    const deleteSelectedTags = useCallback(async () => {
        if (selectedTags.length === 0) return;

        try {
            // Show async confirmation dialog before proceeding
            const confirmMessage = `Are you sure you want to delete ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}?\n\nThis will remove ${selectedTags.length > 1 ? 'them' : 'it'} from all photos.`;
            const confirmed = await confirm(confirmMessage, 'Delete Tags');
            
            if (!confirmed) {
                logger.info('PhotosList', 'delete_tags_cancelled', 'Tag deletion cancelled by user', {
                    tagIds: selectedTags,
                    count: selectedTags.length
                });
                return;
            }

            logger.info('PhotosList', 'delete_tags_start', 'Deleting selected tags', {
                tagIds: selectedTags,
                count: selectedTags.length
            });

            for (const tagId of selectedTags) {
                await invoke("delete_tag", { tagId });
            }

            // Clear the unified collection service cache to ensure other components refresh
            unifiedCollectionService.clearCache();
            
            // Refresh tags list and clear selection
            loadTags();
            clearTagSelection();

            addFooterMessage(`${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} deleted`);

            logger.info('PhotosList', 'tags_deleted', 'Tags deleted successfully', {
                count: selectedTags.length
            });
        } catch (error) {
            handleError(error, 'Delete tags', { tagIds: selectedTags });
        }
    }, [selectedTags, loadTags, clearTagSelection, addFooterMessage, handleError]);

    // Handle album deletion (navigation logic)
    const handleAlbumDelete = useCallback((deletedAlbumId) => {
        // Handle album deletion - navigate back to album list
        if (deletedAlbumId === currentAlbumId) {
            // Navigate back to album list
            toggleAlbumListMode();
        }
        // Refresh albums list
        loadAlbums();
        
        logger.info('PhotosList', 'album_deleted_navigation', 'Navigated after album deletion', { 
            deletedAlbumId, 
            currentAlbumId 
        });
    }, [currentAlbumId, toggleAlbumListMode, loadAlbums]);

    // Photo deletion operations
    const permanentlyDeletePhoto = useCallback((photoPath) => {
        invoke("delete_permanently", { pathStr: photoPath }).then((result) => {
            logger.info('PhotosList', 'permanent_delete_success', 'Photo permanently deleted', { 
                path: photoPath, 
                result 
            });
            // Note: Caller should handle UI updates (remove from list, etc.)
        }).catch((error) => {
            handleError(error, 'Permanently delete photo', { path: photoPath });
        });
    }, [handleError]);

    const deletePhoto = useCallback((photoPath) => {
        // If in trash mode, permanently delete instead of moving to trash
        if (isTrashMode) {
            permanentlyDeletePhoto(photoPath);
            return;
        }

        // Otherwise move to trash (implementation would be here)
        logger.info('PhotosList', 'move_to_trash', 'Moving photo to trash', { path: photoPath });
        // Note: This would need the actual trash implementation
    }, [isTrashMode, permanentlyDeletePhoto]);

    return {
        // Album operations
        handleAlbumSelection,
        clearAlbumSelection,
        deleteSelectedAlbums,
        handleAlbumDelete,
        
        // Tag operations
        handleTagSelection,
        clearTagSelection,
        deleteSelectedTags,
        
        // Photo operations
        permanentlyDeletePhoto,
        deletePhoto,
        
        // Selection state (for convenience)
        selectedAlbumsCount: selectedAlbums.length,
        selectedTagsCount: selectedTags.length,
        hasSelectedAlbums: selectedAlbums.length > 0,
        hasSelectedTags: selectedTags.length > 0
    };
}

export default usePhotoOperations;