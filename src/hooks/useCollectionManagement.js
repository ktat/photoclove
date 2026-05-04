/**
 * useCollectionManagement Hook
 *
 * Manages album and tag collections (PhotoCollections).
 * Extracted from PhotosList.jsx (Phase 2 of refactoring #129)
 *
 * Responsibilities:
 * - Album creation and management
 * - Tag creation and management
 * - Mode-specific data loading
 * - Album/Tag name synchronization
 * - Album/Tag filtering by search term
 */

import { useCallback, useEffect, useMemo } from 'react';
import { logger } from '../services/LoggerService.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { PhotoCollection } from '../domain/PhotoCollection.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';

/**
 * Collection management hook for albums and tags
 * @param {Object} params
 * @param {Object} params.appConfig - Application configuration
 * @param {string} params.viewMode - Current view mode
 * @param {string} params.currentAlbumId - Current album ID
 * @param {string} params.currentTagId - Current tag ID
 * @param {Array} params.albumsList - Albums list
 * @param {Array} params.tagsList - Tags list
 * @param {string} params.albumSearchTerm - Album search filter
 * @param {string} params.tagSearchTerm - Tag search filter
 * @param {number} params.sortOfPhotos - Current sort value
 * @param {Function} params.setCurrentAlbumName - Set current album name
 * @param {Function} params.setCurrentTagName - Set current tag name
 * @param {Function} params.setFilteredAlbums - Set filtered albums
 * @param {Function} params.setFilteredTags - Set filtered tags
 * @param {Function} params.setShowAlbumCreationModal - Show/hide album creation modal
 * @param {Function} params.setPhotoCollection - Set photo collection
 * @param {Function} params.loadAlbums - Load albums list
 * @param {Function} params.loadAlbumPhotos - Load photos for album
 * @param {Function} params.loadTags - Load tags list
 * @param {Function} params.loadTagPhotos - Load photos for tag
 * @param {Function} params.openTag - Open tag view
 * @param {Function} params.openAlbum - Open album view
 * @param {Function} params.logOperation - Log operation
 * @param {Function} params.handleError - Error handler
 * @returns {Object} Collection management functions
 */
export function useCollectionManagement({
    appConfig,
    viewMode,
    currentAlbumId,
    currentTagId,
    albumsList,
    tagsList,
    albumSearchTerm,
    tagSearchTerm,
    sortOfPhotos,
    setCurrentAlbumName,
    setCurrentTagName,
    setFilteredAlbums,
    setFilteredTags,
    setShowAlbumCreationModal,
    setPhotoCollection,
    loadAlbums,
    loadAlbumPhotos,
    loadTags,
    loadTagPhotos,
    openTag,
    openAlbum,
    logOperation,
    handleError
}) {
    /**
     * Handle tag click to switch to tag view.
     * Photo loading is now driven by useViewModeSync (cache lookup -> backend
     * load), so we don't trigger loadTagPhotos here anymore.
     */
    const handleTagClick = useCallback((tag) => {
        logOperation.click('tag', {
            tagId: tag.id,
            tagName: tag.name
        });

        openTag(tag.id);
        setCurrentTagName(tag.name);
    }, [openTag, logOperation, setCurrentTagName]);

    /**
     * Handle new tag creation
     */
    const handleNewTagClick = useCallback(async () => {
        try {
            const tagName = prompt("Enter tag name:");
            if (!tagName || tagName.trim() === '') {
                return;
            }

            // Color feature removed - tags now use default styling
            // const tagColor = prompt("Enter tag color (hex code, e.g., #ff0000) or leave empty:");
            // const color = tagColor && tagColor.trim() !== '' ? tagColor.trim() : null;

            logger.info('useCollectionManagement', 'create_tag_start', 'Creating new tag via unified collection service', {
                tagName: tagName.trim()
            });

            const newTag = await unifiedCollectionService.createCollection('tag', {
                name: tagName.trim()
                // color field removed - tags now use default styling
            });

            logger.info('useCollectionManagement', 'create_tag_success', 'Tag created successfully', {
                tagId: newTag.id,
                tagName: newTag.name
            });

            // Reload tags to show the new tag
            loadTags();

        } catch (error) {
            handleError(error, 'Create tag');
        }
    }, [handleError, loadTags]);

    /**
     * Handle new album creation (opens modal)
     */
    const handleNewAlbumClick = useCallback(() => {
        logger.info('useCollectionManagement', 'new_album_click', 'Opening album creation modal from grid', {
            currentMode: viewMode
        });
        setShowAlbumCreationModal(true);
    }, [viewMode, setShowAlbumCreationModal]);

    /**
     * Handle album creation from modal
     */
    const createEmptyAlbum = useCallback(async (albumData) => {
        try {
            logger.info('useCollectionManagement', 'create_empty_album_start', 'Creating empty album via unified collection service', {
                albumName: albumData.name,
                hasDescription: !!albumData.description
            });

            const newAlbum = await unifiedCollectionService.createCollection('album', {
                name: albumData.name,
                description: albumData.description || ''
            });

            logger.info('useCollectionManagement', 'create_empty_album_success', 'Empty album created successfully', {
                albumId: newAlbum.id,
                albumName: newAlbum.name
            });

            // Close modal
            setShowAlbumCreationModal(false);

            // Reload albums to show the new album
            loadAlbums();

            // Don't navigate to the new album - it's empty
            // User can click on it from the album list if they want to add photos

        } catch (error) {
            handleError(error, 'Create album', { albumName: albumData.name });
        }
    }, [handleError, loadAlbums, openAlbum, setShowAlbumCreationModal, setCurrentAlbumName]);

    /**
     * Mode-to-loader function mapping
     */
    const modeLoaders = useMemo(() => ({
        [VIEW_MODES.ALBUM_LIST]: () => loadAlbums(),
        [VIEW_MODES.TAG_LIST]: () => loadTags(),
        [VIEW_MODES.TRASH]: async () => {
            // Wait for config to be loaded
            if (!appConfig) {
                logger.warn('useCollectionManagement', 'trash_mode_config_not_ready', 'Config not loaded yet, skipping trash load');
                return;
            }

            const trashCollection = PhotoCollection.createTrashCollection([], appConfig, parseInt(sortOfPhotos || 0));
            setPhotoCollection(trashCollection);

            // Fetch trash photos
            try {
                const updatedCollection = await trashCollection.fetchPhotos(1, 1000, {
                    star: -1,
                    hasComment: false,
                    extension: 'all'
                });

                logger.info('useCollectionManagement', 'trash_mode_loader_success', 'Trash collection loaded', {
                    photoCount: updatedCollection.photos.length
                });

                setPhotoCollection(updatedCollection);
            } catch (error) {
                handleError(error, 'Load trash collection');
            }
        },
        // ALBUM/TAG modes intentionally have NO modeLoader entry: photo loading
        // is now driven by useViewModeSync (cache lookup -> backend load)
        // exclusively. A second eager load here races with that path and
        // bypasses onLoadSuccess (no cache write, no isFetched flip).
    }), [loadAlbums, loadTags, appConfig, sortOfPhotos, setPhotoCollection, handleError]);

    /**
     * Execute mode-specific loader functions
     */
    useEffect(() => {
        const loader = modeLoaders[viewMode];
        if (loader) {
            loader();
        }

        // Clear names when not in specific modes
        // Keep album name when in burst group (opened from album)
        if (viewMode !== VIEW_MODES.ALBUM && viewMode !== VIEW_MODES.IN_BURST_GROUP) {
            setCurrentAlbumName('');
        }
        // Keep tag name when in burst group (opened from tag)
        if (viewMode !== VIEW_MODES.TAG && viewMode !== VIEW_MODES.IN_BURST_GROUP) {
            setCurrentTagName('');
        }
    }, [viewMode, modeLoaders, setCurrentAlbumName, setCurrentTagName]);

    /**
     * Set album name based on current selection
     */
    useEffect(() => {
        if (viewMode === VIEW_MODES.ALBUM && currentAlbumId && albumsList.length > 0) {
            const currentAlbum = albumsList.find(album => album.id === currentAlbumId);
            if (currentAlbum) {
                setCurrentAlbumName(currentAlbum.name);
            }
        }
    }, [viewMode, currentAlbumId, albumsList, setCurrentAlbumName]);

    /**
     * Set tag name based on current selection
     */
    useEffect(() => {
        if (viewMode === VIEW_MODES.TAG && currentTagId && tagsList.length > 0) {
            const currentTag = tagsList.find(tag => tag.id === currentTagId);
            if (currentTag) {
                setCurrentTagName(currentTag.name);
            }
        }
    }, [viewMode, currentTagId, tagsList, setCurrentTagName]);

    /**
     * Filter albums by search term
     */
    useEffect(() => {
        if (albumsList.length === 0) {
            setFilteredAlbums([]);
            return;
        }

        if (!albumSearchTerm.trim()) {
            setFilteredAlbums(albumsList);
            return;
        }

        const filtered = albumsList.filter(album =>
            album.name.toLowerCase().includes(albumSearchTerm.toLowerCase())
        );
        setFilteredAlbums(filtered);
    }, [albumsList, albumSearchTerm, setFilteredAlbums]);

    /**
     * Filter tags by search term
     */
    useEffect(() => {
        if (tagsList.length === 0) {
            setFilteredTags([]);
            return;
        }

        if (!tagSearchTerm.trim()) {
            setFilteredTags(tagsList);
            return;
        }

        const filtered = tagsList.filter(tag =>
            tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase())
        );
        setFilteredTags(filtered);
    }, [tagsList, tagSearchTerm, setFilteredTags]);

    return {
        // Tag operations
        handleTagClick,
        handleNewTagClick,

        // Album operations
        handleNewAlbumClick,
        createEmptyAlbum,

        // Mode loaders (exposed for potential direct use)
        modeLoaders
    };
}
