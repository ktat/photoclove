import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import { logger } from '../services/LoggerService.js';
import TagInput from './TagInput.jsx';
import './TagSelector.css';

const TagSelector = ({ photoPath, selectedTags = [], onTagsChange }) => {
    const [allTags, setAllTags] = useState([]);
    const [filteredTags, setFilteredTags] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        loadAllTags();
    }, []);

    useEffect(() => {
        filterTags();
    }, [allTags, searchTerm, selectedTags]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadAllTags = async () => {
        try {
            const tags = await UnifiedPhotoCollection.getAllTags();
            setAllTags(tags);
            logger.info('TagSelector', 'tags_loaded', 'All tags loaded using unified collections', { count: tags.length });
        } catch (error) {
            logger.error('TagSelector', 'load_tags_error', 'Failed to load tags', { error: error.toString() });
        }
    };

    const filterTags = () => {
        let filtered = allTags.filter(tag => 
            tag.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedTags.some(selectedTag => selectedTag.id === tag.id)
        );
        setFilteredTags(filtered);
    };

    const handleTagSelect = async (tag) => {
        if (!photoPath) {
            // Just update local state if no photo path
            const newSelectedTags = [...selectedTags, tag];
            onTagsChange?.(newSelectedTags);
            setSearchTerm('');
            setIsDropdownOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            // Find the tag collection and add photo to it
            const tagCollection = new UnifiedPhotoCollection({
                id: tag.id,
                type: 'tag',
                name: tag.name,
                color: tag.color
            });
            await tagCollection.addPhoto(photoPath);

            const newSelectedTags = [...selectedTags, tag];
            onTagsChange?.(newSelectedTags);
            
            logger.info('TagSelector', 'tag_added', 'Tag added to photo using unified collection', { 
                tagId: tag.id, 
                tagName: tag.name,
                photoPath 
            });

            setSearchTerm('');
            setIsDropdownOpen(false);
        } catch (error) {
            logger.error('TagSelector', 'add_tag_error', 'Failed to add tag to photo', { 
                error: error.toString() 
            });
            alert('Failed to add tag: ' + error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagRemove = async (tagId) => {
        if (!photoPath) {
            // Just update local state if no photo path
            const newSelectedTags = selectedTags.filter(tag => tag.id !== tagId);
            onTagsChange?.(newSelectedTags);
            return;
        }

        setIsLoading(true);
        try {
            // Find the tag in allTags to get its full data
            const tag = allTags.find(t => t.id === tagId) || { id: tagId, type: 'tag' };
            const tagCollection = new UnifiedPhotoCollection({
                ...tag,
                type: 'tag'
            });
            await tagCollection.removePhoto(photoPath);

            const newSelectedTags = selectedTags.filter(tag => tag.id !== tagId);
            onTagsChange?.(newSelectedTags);
            
            logger.info('TagSelector', 'tag_removed', 'Tag removed from photo using unified collection', { 
                tagId, 
                photoPath 
            });
        } catch (error) {
            logger.error('TagSelector', 'remove_tag_error', 'Failed to remove tag from photo', { 
                error: error.toString() 
            });
            alert('Failed to remove tag: ' + error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagCreated = (newTag) => {
        setAllTags(prev => [...prev, newTag]);
        handleTagSelect(newTag);
    };

    const handleDropdownToggle = () => {
        setIsDropdownOpen(!isDropdownOpen);
        if (!isDropdownOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    };

    return (
        <div className="tag-selector">
            {/* Selected Tags */}
            <div className="selected-tags" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center'
            }}>
                {selectedTags.map(tag => (
                    <span
                        key={tag.id}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: 'rgba(33, 150, 243, 0.3)',
                            border: '1px solid #2196F3',
                            borderRadius: '16px',
                            fontSize: '13px',
                            color: 'var(--text)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>{tag.name}</span>
                        <button
                            onClick={() => handleTagRemove(tag.id)}
                            disabled={isLoading}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text)',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                padding: '0 0 0 4px',
                                fontSize: '16px',
                                lineHeight: '1',
                                opacity: isLoading ? 0.5 : 0.7
                            }}
                            title="Remove tag"
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = isLoading ? '0.5' : '0.7'}
                        >
                            ×
                        </button>
                    </span>
                ))}

                <button
                    className="add-tag-button"
                    onClick={handleDropdownToggle}
                    disabled={isLoading}
                    title="Add tag"
                    style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        color: 'var(--text)',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        opacity: isLoading ? 0.6 : 1
                    }}
                >
                    {isLoading ? '...' : '+'}
                </button>
            </div>

            {/* Dropdown */}
            {isDropdownOpen && (
                <div className="tag-dropdown" ref={dropdownRef}>
                    <div className="tag-search">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tags..."
                            className="tag-search-input"
                        />
                    </div>

                    <div className="tag-options">
                        {filteredTags.length > 0 ? (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                padding: '4px'
                            }}>
                                {filteredTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        className="tag-option-pill"
                                        onClick={() => handleTagSelect(tag)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                            backgroundColor: 'var(--bg-elevated)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '16px',
                                            transition: 'all 0.2s',
                                            fontSize: '13px',
                                            color: 'var(--text)',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#374151';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                                        }}
                                    >
                                        {tag.name} ({tag.photoCount || 0})
                                    </button>
                                ))}
                            </div>
                        ) : searchTerm ? (
                            <div className="tag-no-results">
                                No tags found for "{searchTerm}"
                            </div>
                        ) : (
                            <div className="tag-no-results">
                                All tags are already selected
                            </div>
                        )}
                    </div>

                    <div className="tag-create-section">
                        <div className="tag-create-divider">or create new tag</div>
                        <TagInput onTagCreated={handleTagCreated} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagSelector;