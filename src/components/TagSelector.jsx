import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import TagChip from './TagChip.jsx';
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
            const tags = await invoke('get_all_tags');
            const formattedTags = tags.map(([id, name, color]) => ({ id, name, color }));
            setAllTags(formattedTags);
            logger.info('TagSelector', 'tags_loaded', 'All tags loaded', { count: formattedTags.length });
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
            await invoke('add_tag_to_photo', {
                photoPath: photoPath,
                tagId: tag.id
            });

            const newSelectedTags = [...selectedTags, tag];
            onTagsChange?.(newSelectedTags);
            
            logger.info('TagSelector', 'tag_added', 'Tag added to photo', { 
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
            await invoke('remove_tag_from_photo', {
                photoPath: photoPath,
                tagId: tagId
            });

            const newSelectedTags = selectedTags.filter(tag => tag.id !== tagId);
            onTagsChange?.(newSelectedTags);
            
            logger.info('TagSelector', 'tag_removed', 'Tag removed from photo', { 
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
            <div className="selected-tags">
                {selectedTags.map(tag => (
                    <TagChip
                        key={tag.id}
                        tag={tag}
                        isRemovable={true}
                        onRemove={handleTagRemove}
                    />
                ))}
                
                <button
                    className="add-tag-button"
                    onClick={handleDropdownToggle}
                    disabled={isLoading}
                    title="Add tag"
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
                            filteredTags.map(tag => (
                                <div
                                    key={tag.id}
                                    className="tag-option"
                                    onClick={() => handleTagSelect(tag)}
                                >
                                    <TagChip tag={tag} />
                                </div>
                            ))
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