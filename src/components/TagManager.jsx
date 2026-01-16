import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import classNames from 'classnames';
import { logger } from '../services/LoggerService.js';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';
import TagChip from './TagChip.jsx';
import TagInput from './TagInput.jsx';
import styles from './TagManager.module.css';

const STORAGE_KEY = 'photoclove-tag-view-mode';

const TagManager = () => {
    const [tags, setTags] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name'); // 'name' or 'created'
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem(STORAGE_KEY) || 'list';
    });

    useEffect(() => {
        loadTags();
    }, []);

    // Persist viewMode to localStorage
    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        localStorage.setItem(STORAGE_KEY, mode);
        logger.info('TagManager', 'view_mode_changed', 'Tag view mode changed', { mode });
    };

    const loadTags = async () => {
        setIsLoading(true);
        try {
            const tagsResult = await invoke('get_photos_unified', {
                request: {
                    type: 'search',
                    search_type: 'all_tags'
                }
            });
            const result = JSON.parse(tagsResult);
            // Parse as collection objects (id, name, color, photo_count)
            const formattedTags = result.map(tag => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                photoCount: tag.photo_count || 0
            }));
            setTags(formattedTags);
            logger.info('TagManager', 'tags_loaded', 'Tags loaded successfully', {
                count: formattedTags.length
            });
        } catch (error) {
            logger.error('TagManager', 'load_tags_error', 'Failed to load tags', {
                error: error.toString()
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagCreated = (newTag) => {
        setTags(prev => [...prev, newTag]);
        
        // Clear the unified collection service cache to ensure other components refresh
        unifiedCollectionService.clearCache();
        
        logger.info('TagManager', 'tag_created', 'New tag created', { 
            id: newTag.id,
            name: newTag.name 
        });
    };

    const handleTagDelete = async (tagId) => {
        const tag = tags.find(t => t.id === tagId);
        const confirmMessage = `Are you sure you want to delete the tag "${tag?.name}"? This will remove it from all photos.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const deleted = await invoke('delete_tag', { tagId });
            
            if (deleted) {
                setTags(prev => prev.filter(t => t.id !== tagId));
                
                // Clear the unified collection service cache to ensure other components refresh
                unifiedCollectionService.clearCache();
                
                logger.info('TagManager', 'tag_deleted', 'Tag deleted successfully', { 
                    tagId,
                    tagName: tag?.name 
                });
            }
        } catch (error) {
            logger.error('TagManager', 'delete_tag_error', 'Failed to delete tag', { 
                tagId,
                error: error.toString() 
            });
            alert('Failed to delete tag: ' + error);
        }
    };

    const filteredAndSortedTags = tags
        .filter(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === 'count') {
                return b.photoCount - a.photoCount;
            }
            return b.id - a.id; // Assuming higher ID = more recent
        });

    // Calculate font size for tag cloud based on photo count
    const calculateTagSize = (photoCount) => {
        const minSize = 12;
        const maxSize = 28;
        const counts = tags.map(t => t.photoCount);
        const maxPhotoCount = Math.max(...counts, 1);
        const minPhotoCount = Math.min(...counts, 0);

        if (maxPhotoCount === minPhotoCount) {
            return (minSize + maxSize) / 2;
        }
        const ratio = (photoCount - minPhotoCount) / (maxPhotoCount - minPhotoCount);
        return minSize + ratio * (maxSize - minSize);
    };

    // Sort tags for cloud view (larger tags in center)
    const getCloudSortedTags = () => {
        const sorted = [...filteredAndSortedTags].sort((a, b) => b.photoCount - a.photoCount);
        // Interleave: place large tags at center by alternating left/right placement
        const result = [];
        for (let i = 0; i < sorted.length; i++) {
            if (i % 2 === 0) {
                result.push(sorted[i]);
            } else {
                result.unshift(sorted[i]);
            }
        }
        return result;
    };

    const handleTagSearch = async (tagIds) => {
        try {
            const result = await invoke('get_photos_unified', {
                request: {
                    type: "search",
                    search_type: "tag",
                    query: tagIds.join(','),
                    page: 1,
                    limit: 9999,
                    offset: 0
                }
            });

            const data = JSON.parse(result);
            const photos = data.photos || [];

            logger.info('TagManager', 'tag_search', 'Photos found with tags', {
                tagIds,
                photoCount: photos.length
            });

            // You could emit an event here or use a callback to show search results
            alert(`Found ${photos.length} photos with the selected tag${tagIds.length > 1 ? 's' : ''}`);
        } catch (error) {
            logger.error('TagManager', 'tag_search_error', 'Failed to search photos by tags', {
                tagIds,
                error: error.toString()
            });
        }
    };

    if (isLoading) {
        return (
            <div className={styles.tagManager}>
                <div className={styles.tagManagerLoading}>Loading tags...</div>
            </div>
        );
    }

    return (
        <div className={styles.tagManager}>
            <div className={styles.tagManagerHeader}>
                <h3>Tag Management</h3>
                <p className={styles.tagManagerDescription}>
                    Manage your photo tags. Create new tags, delete unused ones, or search for photos by tag.
                </p>
            </div>

            <div className={styles.tagManagerCreate}>
                <h4>Create New Tag</h4>
                <TagInput onTagCreated={handleTagCreated} />
            </div>

            <div className={styles.tagManagerList}>
                <div className={styles.tagManagerControls}>
                    <div className={styles.tagSearchControl}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tags..."
                            className={styles.tagSearchField}
                        />
                    </div>
                    <div className={styles.tagSortControl}>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className={styles.tagSortSelect}
                        >
                            <option value="name">Sort by Name</option>
                            <option value="count">Sort by Count</option>
                            <option value="created">Sort by Created</option>
                        </select>
                    </div>
                    <div className={styles.viewModeToggle}>
                        <button
                            className={classNames(styles.viewModeButton, { [styles.viewModeActive]: viewMode === 'list' })}
                            onClick={() => handleViewModeChange('list')}
                            title="List view"
                        >
                            ☰
                        </button>
                        <button
                            className={classNames(styles.viewModeButton, { [styles.viewModeActive]: viewMode === 'cloud' })}
                            onClick={() => handleViewModeChange('cloud')}
                            title="Cloud view"
                        >
                            ☁
                        </button>
                    </div>
                </div>

                <div className={styles.tagCountInfo}>
                    {filteredAndSortedTags.length} of {tags.length} tags
                    {searchTerm && ` matching "${searchTerm}"`}
                </div>

                {viewMode === 'list' ? (
                    <div className={styles.tagList}>
                        {filteredAndSortedTags.length > 0 ? (
                            filteredAndSortedTags.map(tag => (
                                <div key={tag.id} className={styles.tagItem}>
                                    <div className={styles.tagItemInfo}>
                                        <TagChip tag={tag} />
                                        <span className={styles.tagPhotoCount}>({tag.photoCount})</span>
                                    </div>
                                    <div className={styles.tagItemActions}>
                                        <button
                                            className={classNames(styles.tagActionButton, styles.tagSearchButton)}
                                            onClick={() => handleTagSearch([tag.id])}
                                            title="Search photos with this tag"
                                        >
                                            🔍
                                        </button>
                                        <button
                                            className={classNames(styles.tagActionButton, styles.tagDeleteButton)}
                                            onClick={() => handleTagDelete(tag.id)}
                                            title="Delete this tag"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : searchTerm ? (
                            <div className={styles.tagEmptyState}>
                                No tags found matching "{searchTerm}"
                            </div>
                        ) : (
                            <div className={styles.tagEmptyState}>
                                No tags created yet. Create your first tag above!
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={styles.tagCloud}>
                        {filteredAndSortedTags.length > 0 ? (
                            getCloudSortedTags().map(tag => (
                                <span
                                    key={tag.id}
                                    className={styles.tagCloudItem}
                                    style={{
                                        fontSize: `${calculateTagSize(tag.photoCount)}px`,
                                        backgroundColor: tag.color || 'var(--color-bg-surface)'
                                    }}
                                    onClick={() => handleTagSearch([tag.id])}
                                    title={`${tag.name} (${tag.photoCount} photos)`}
                                >
                                    {tag.name}
                                    <span className={styles.tagCloudCount}>({tag.photoCount})</span>
                                </span>
                            ))
                        ) : searchTerm ? (
                            <div className={styles.tagEmptyState}>
                                No tags found matching "{searchTerm}"
                            </div>
                        ) : (
                            <div className={styles.tagEmptyState}>
                                No tags created yet. Create your first tag above!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {tags.length > 0 && (
                <div className={styles.tagManagerStats}>
                    <h4>Statistics</h4>
                    <div className={styles.tagStatsGrid}>
                        <div className={styles.tagStat}>
                            <span className={styles.tagStatNumber}>{tags.length}</span>
                            <span className={styles.tagStatLabel}>Total Tags</span>
                        </div>
                        <div className={styles.tagStat}>
                            <span className={styles.tagStatNumber}>
                                {tags.filter(tag => tag.color).length}
                            </span>
                            <span className={styles.tagStatLabel}>Colored Tags</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagManager;