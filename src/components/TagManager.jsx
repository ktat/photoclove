import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import TagChip from './TagChip.jsx';
import TagInput from './TagInput.jsx';
import './TagManager.css';

const TagManager = () => {
    const [tags, setTags] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name'); // 'name' or 'created'

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        setIsLoading(true);
        try {
            const result = await invoke('get_all_tags');
            const formattedTags = result.map(([id, name, color]) => ({ id, name, color }));
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
            return b.id - a.id; // Assuming higher ID = more recent
        });

    const handleTagSearch = async (tagIds) => {
        try {
            const photoIds = await invoke('search_photos_by_tags', { tagIds });
            logger.info('TagManager', 'tag_search', 'Photos found with tags', { 
                tagIds,
                photoCount: photoIds.length 
            });
            
            // You could emit an event here or use a callback to show search results
            alert(`Found ${photoIds.length} photos with the selected tag${tagIds.length > 1 ? 's' : ''}`);
        } catch (error) {
            logger.error('TagManager', 'tag_search_error', 'Failed to search photos by tags', { 
                tagIds,
                error: error.toString() 
            });
        }
    };

    if (isLoading) {
        return (
            <div className="tag-manager">
                <div className="tag-manager-loading">Loading tags...</div>
            </div>
        );
    }

    return (
        <div className="tag-manager">
            <div className="tag-manager-header">
                <h3>Tag Management</h3>
                <p className="tag-manager-description">
                    Manage your photo tags. Create new tags, delete unused ones, or search for photos by tag.
                </p>
            </div>

            <div className="tag-manager-create">
                <h4>Create New Tag</h4>
                <TagInput onTagCreated={handleTagCreated} />
            </div>

            <div className="tag-manager-list">
                <div className="tag-manager-controls">
                    <div className="tag-search-control">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tags..."
                            className="tag-search-field"
                        />
                    </div>
                    <div className="tag-sort-control">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="tag-sort-select"
                        >
                            <option value="name">Sort by Name</option>
                            <option value="created">Sort by Created</option>
                        </select>
                    </div>
                </div>

                <div className="tag-count-info">
                    {filteredAndSortedTags.length} of {tags.length} tags
                    {searchTerm && ` matching "${searchTerm}"`}
                </div>

                <div className="tag-list">
                    {filteredAndSortedTags.length > 0 ? (
                        filteredAndSortedTags.map(tag => (
                            <div key={tag.id} className="tag-item">
                                <TagChip tag={tag} />
                                <div className="tag-item-actions">
                                    <button
                                        className="tag-action-button tag-search-button"
                                        onClick={() => handleTagSearch([tag.id])}
                                        title="Search photos with this tag"
                                    >
                                        🔍
                                    </button>
                                    <button
                                        className="tag-action-button tag-delete-button"
                                        onClick={() => handleTagDelete(tag.id)}
                                        title="Delete this tag"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : searchTerm ? (
                        <div className="tag-empty-state">
                            No tags found matching "{searchTerm}"
                        </div>
                    ) : (
                        <div className="tag-empty-state">
                            No tags created yet. Create your first tag above!
                        </div>
                    )}
                </div>
            </div>

            {tags.length > 0 && (
                <div className="tag-manager-stats">
                    <h4>Statistics</h4>
                    <div className="tag-stats-grid">
                        <div className="tag-stat">
                            <span className="tag-stat-number">{tags.length}</span>
                            <span className="tag-stat-label">Total Tags</span>
                        </div>
                        <div className="tag-stat">
                            <span className="tag-stat-number">
                                {tags.filter(tag => tag.color).length}
                            </span>
                            <span className="tag-stat-label">Colored Tags</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagManager;